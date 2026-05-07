from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class NoteResponse(BaseModel):
    id: UUID
    session_id: UUID
    chief_complaint: str | None
    history_of_present_illness: str | None
    review_of_systems: str | None
    past_medical_history: str | None
    medications: str | None
    allergies: str | None
    physical_examination: str | None
    assessment: str | None
    plan: str | None
    follow_up: str | None
    icd_codes: list | None
    confidence_score: float | None
    is_finalized: bool
    template_type: str


@router.get("/{session_id}", response_model=NoteResponse)
async def get_note(session_id: UUID):
    # STUB — returns mock SOAP note
    return NoteResponse(
        id=uuid4(),
        session_id=session_id,
        chief_complaint="Fever and body ache for 2 days",
        history_of_present_illness=(
            "Patient reports high-grade fever (102°F) and generalized body ache. "
            "Mild cold. Took Paracetamol 500mg yesterday."
        ),
        review_of_systems="Mild rhinorrhoea, no chest pain, no breathlessness.",
        past_medical_history="No known chronic illnesses. No prior hospitalizations.",
        medications="Paracetamol 500mg (self-administered yesterday)",
        allergies="NKDA (No Known Drug Allergies)",
        physical_examination=(
            "Temp: 102°F. Pulse: 88 bpm. BP: 118/76 mmHg. "
            "Throat: mildly congested. Chest: clear."
        ),
        assessment="Viral fever, likely acute upper respiratory infection (URI)",
        plan=(
            "Tab Paracetamol 500mg TDS x 5 days. "
            "Tab Cetirizine 10mg OD. "
            "Steam inhalation BD. "
            "Adequate fluids and rest. "
            "Review if not improving in 3 days."
        ),
        follow_up="Review in 3 days or earlier if symptoms worsen.",
        icd_codes=[
            {"code": "J06.9", "description": "Acute upper respiratory infection, unspecified"}
        ],
        confidence_score=0.87,
        is_finalized=False,
        template_type="soap",
    )


@router.patch("/{note_id}/finalize")
async def finalize_note(note_id: UUID):
    return {
        "note_id": str(note_id),
        "is_finalized": True,
        "reviewed_at": datetime.utcnow().isoformat(),
    }
