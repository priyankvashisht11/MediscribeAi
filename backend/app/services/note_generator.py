# backend/app/services/note_generator.py

import logging
import re

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import settings
from app.services.icd_lookup import search_icd10

logger = logging.getLogger(__name__)


def _strip_think(msg) -> str:
    """Strip <think>…</think> reasoning blocks from r1-1776 output before JSON parsing."""
    content = msg.content if hasattr(msg, "content") else str(msg)
    return re.sub(r"<think>.*?</think>\s*", "", content, flags=re.DOTALL).strip()


# ── Pydantic output schemas ────────────────────────────────────────────────────

class ClinicalEntities(BaseModel):
    chief_complaint: str = Field(description="Patient's main presenting complaint in their own words")
    history_of_present_illness: str = Field(description="Narrative of current illness: onset, duration, severity, associated symptoms")
    past_medical_history: list[str] = Field(default_factory=list, description="Known conditions, previous surgeries, hospitalisations")
    current_medications: list[str] = Field(default_factory=list, description="Medications patient is currently taking")
    allergies: list[str] = Field(default_factory=list, description="Known allergies")
    family_history: str = Field(default="Not mentioned", description="Relevant family history")
    social_history: str = Field(default="Not mentioned", description="Occupation, lifestyle, smoking, alcohol use")
    review_of_systems: list[str] = Field(default_factory=list, description="Additional symptoms mentioned during review")
    vitals_mentioned: dict = Field(default_factory=dict, description="Any vitals mentioned: {bp, hr, temp, spo2, weight, rbs}")
    examination_findings: list[str] = Field(default_factory=list, description="Physical examination findings mentioned")
    diagnoses_mentioned: list[str] = Field(default_factory=list, description="Conditions, diagnoses, or impressions mentioned by doctor")
    investigations_ordered: list[str] = Field(default_factory=list, description="Tests, labs, imaging ordered")
    plan_items: list[str] = Field(default_factory=list, description="Treatment plan, prescriptions, referrals, follow-up")
    follow_up: str = Field(default="As needed", description="Follow-up instructions")


class SOAPNote(BaseModel):
    subjective: str = Field(description="S: Chief complaint and history in narrative form")
    objective: str = Field(description="O: Examination findings, vitals, investigations")
    assessment: str = Field(description="A: Clinical impression and diagnoses")
    plan: str = Field(description="P: Treatment plan, prescriptions, referrals, follow-up")
    chief_complaint: str
    diagnosis_keywords: list[str] = Field(description="2-5 keywords to search ICD-10 codes")
    confidence_score: float = Field(ge=0.0, le=1.0, description="0.0-1.0 confidence in note completeness")
    missing_information: list[str] = Field(default_factory=list, description="Important clinical info not in transcript")


# ── LLM setup ──────────────────────────────────────────────────────────────────

def _get_llm() -> tuple[ChatOpenAI, str]:
    """Return (llm, model_name). Perplexity is primary, OpenAI is fallback."""
    if settings.perplexity_api_key:
        logger.info(f"Using Perplexity model: {settings.perplexity_model}")
        return ChatOpenAI(
            model=settings.perplexity_model,
            temperature=0.1,
            api_key=settings.perplexity_api_key,
            base_url=settings.perplexity_base_url,
            timeout=settings.note_generation_timeout_seconds,
            max_retries=2,
        ), settings.perplexity_model

    if settings.openai_api_key and not settings.openai_api_key.startswith("sk-placeholder"):
        logger.info(f"Using OpenAI model: {settings.openai_model}")
        return ChatOpenAI(
            model=settings.openai_model,
            temperature=0.1,
            api_key=settings.openai_api_key,
            timeout=settings.note_generation_timeout_seconds,
            max_retries=2,
        ), settings.openai_model

    return None, "stub"


# ── Prompts ────────────────────────────────────────────────────────────────────

ENTITY_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a highly accurate medical documentation assistant trained on Indian clinical practice.
Extract structured clinical entities from this doctor-patient conversation transcript.

CRITICAL RULES:
1. Extract ONLY information explicitly stated in the transcript. Do NOT infer or hallucinate.
2. If information is not mentioned, use the default values (empty list, "Not mentioned", etc.)
3. Preserve the doctor's exact clinical language for diagnoses and assessments.
4. For Hinglish transcripts: understand Hindi medical terms. Common terms:
   - "bukhaar" = fever, "sir dard" = headache, "pet dard" = abdominal pain
   - "khoon" = blood, "sugar" = diabetes, "BP" = blood pressure
   - "dawai" = medicine, "test" = investigation, "wapis aana" = follow-up
5. The speaker labelled "doctor" makes clinical decisions. The speaker labelled "patient" describes symptoms.
6. Output valid JSON only. No explanation text.

Return JSON matching this schema exactly:
{schema}
"""),
    ("human", """TRANSCRIPT:
{transcript}

DOCTOR SPECIALTY: {specialty}
SESSION DURATION: {duration_minutes} minutes
"""),
])

SOAP_GENERATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert medical scribe generating clinical documentation for Indian healthcare.
Generate a complete, professional SOAP note from the extracted clinical entities.

CRITICAL RULES:
1. Use ONLY the provided entities — do NOT add clinical information not present.
2. Write in formal medical English. Abbreviations acceptable (c/o, h/o, O/E, Rx, BD, TDS, etc.)
3. The note must be suitable for a medico-legal record under Indian law.
4. Confidence score: reflect how complete the transcript was.
   - 0.9-1.0: all SOAP sections have substantial content
   - 0.7-0.8: most sections filled, minor gaps
   - 0.5-0.6: significant gaps (short session, noisy audio, incomplete history)
   - < 0.5: insufficient information for a reliable note
5. In missing_information, list what a complete note would need but was not mentioned.
6. Output valid JSON only.

Return JSON matching this schema exactly:
{schema}
"""),
    ("human", """CLINICAL ENTITIES:
{entities}

PATIENT NAME: {patient_name}
DOCTOR NAME: {doctor_name}
DATE: {session_date}
"""),
])


# ── Main generation function ───────────────────────────────────────────────────

async def generate_soap_note(
    transcript: str,
    patient_name: str,
    doctor_name: str,
    session_date: str,
    specialty: str = "General Medicine",
    duration_minutes: int = 10,
) -> dict:
    """
    Two-chain LangChain pipeline: entity extraction → SOAP generation → ICD-10 lookup.
    Falls back to stub note if LLM is unavailable or disabled.
    """
    llm, model_name = _get_llm()
    if not settings.note_generation_enabled or llm is None:
        logger.warning(f"Note generation disabled or no LLM key set. Returning stub note.")
        return _stub_note(patient_name, doctor_name)

    # Chain 1: Extract clinical entities
    try:
        entity_chain = ENTITY_EXTRACTION_PROMPT | llm | RunnableLambda(_strip_think) | JsonOutputParser()
        logger.info(f"Extracting clinical entities ({len(transcript)} chars)...")
        entities = await entity_chain.ainvoke({
            "schema": ClinicalEntities.model_json_schema(),
            "transcript": transcript,
            "specialty": specialty,
            "duration_minutes": duration_minutes,
        })
        logger.info(f"Entity extraction done. Chief complaint: {entities.get('chief_complaint', 'unknown')}")
    except Exception as e:
        logger.error(f"Entity extraction failed: {e}")
        return _stub_note(patient_name, doctor_name, error=str(e))

    # Chain 2: Generate SOAP note
    try:
        soap_chain = SOAP_GENERATION_PROMPT | llm | RunnableLambda(_strip_think) | JsonOutputParser()
        logger.info("Generating SOAP note from entities...")
        soap = await soap_chain.ainvoke({
            "schema": SOAPNote.model_json_schema(),
            "entities": entities,
            "patient_name": patient_name,
            "doctor_name": doctor_name,
            "session_date": session_date,
        })
        logger.info(f"SOAP generated. Confidence: {soap.get('confidence_score', 0)}")
    except Exception as e:
        logger.error(f"SOAP generation failed: {e}")
        return _stub_note(patient_name, doctor_name, entities=entities, error=str(e))

    # ICD-10 lookup from diagnosis keywords
    icd_codes, seen, unique_icd = [], set(), []
    for keyword in soap.get("diagnosis_keywords", [])[:5]:
        icd_codes.extend(search_icd10(keyword, limit=2))
    for code in icd_codes:
        if code["code"] not in seen:
            seen.add(code["code"])
            unique_icd.append(code)

    return {
        "subjective": soap.get("subjective", ""),
        "objective": soap.get("objective", ""),
        "assessment": soap.get("assessment", ""),
        "plan": soap.get("plan", ""),
        "chief_complaint": soap.get("chief_complaint", entities.get("chief_complaint", "")),
        "history_of_present_illness": entities.get("history_of_present_illness", ""),
        "icd_codes": unique_icd,
        "confidence_score": float(soap.get("confidence_score", 0.5)),
        "missing_information": soap.get("missing_information", []),
        "raw_entities": entities,
        "generated_by": model_name,
    }


def _stub_note(patient_name: str, doctor_name: str, entities: dict | None = None, error: str | None = None) -> dict:
    return {
        "subjective": f"Patient {patient_name} presented with chief complaint as per transcript.",
        "objective": "Examination findings as documented during session.",
        "assessment": "Clinical assessment pending review.",
        "plan": f"Treatment plan to be completed by Dr. {doctor_name}",
        "chief_complaint": entities.get("chief_complaint", "See transcript") if entities else "See transcript",
        "history_of_present_illness": "",
        "icd_codes": [],
        "confidence_score": 0.1,
        "missing_information": ["Note generated from stub — LLM unavailable" + (f": {error}" if error else "")],
        "raw_entities": entities or {},
        "generated_by": "stub",
    }


def format_transcript_for_llm(chunks: list[dict]) -> str:
    """Format [{text, speaker, start}] chunks into a labelled dialogue string."""
    lines = []
    for chunk in chunks:
        speaker = chunk.get("speaker", "unknown").upper()
        text = chunk.get("text", "").strip()
        if text:
            lines.append(f"{speaker}: {text}")
    return "\n".join(lines)
