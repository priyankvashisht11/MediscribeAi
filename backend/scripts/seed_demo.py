#!/usr/bin/env python3
"""
seed_demo.py — Populate Chartr with 3 realistic demo sessions.

Usage (from project root):
  docker compose exec backend python scripts/seed_demo.py

The script is idempotent: running it twice does not create duplicates.
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.models import Session as SessionModel, Transcript, ClinicalNote, NoteAuditLog
from app.models.patient import Patient

# ─── Doctor UUIDs (must match _seed_mock_doctors in main.py) ─────────────────
DR_ANANYA  = UUID("00000000-0000-0000-0000-000000000001")  # General Physician
DR_RAJESH  = UUID("00000000-0000-0000-0000-000000000002")  # Pediatrics
DR_PRIYA   = UUID("00000000-0000-0000-0000-000000000003")  # Dermatology

# ─── Demo session definitions ─────────────────────────────────────────────────
DEMO_SESSIONS = [
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000001"),
        "doctor_id": DR_ANANYA,
        "patient_name": "Ramesh Kumar",
        "patient_age": 52,
        "patient_gender": "Male",
        "duration_seconds": 487,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=3),
        "transcript": [
            ("doctor",  "Good morning Mr. Ramesh, please sit down. What brings you in today?"),
            ("patient", "Doctor sahab, mujhe kaafi dino se sir dard ho raha hai, aur BP bhi high hai last check mein."),
            ("doctor",  "I see. How long has the headache been there?"),
            ("patient", "About two weeks. Mostly in the morning, back of the head."),
            ("doctor",  "Any nausea, vomiting, visual changes?"),
            ("patient", "No vomiting but sometimes blurred vision for a few minutes."),
            ("doctor",  "Are you on any medications currently?"),
            ("patient", "Haan, amlodipine 5mg le raha hoon, ek saal se."),
            ("doctor",  "Any family history of hypertension or heart disease?"),
            ("patient", "Father ko tha. 60 mein heart attack aaya tha unhe."),
            ("doctor",  "Let me check your BP. It's reading 158 over 96. That's elevated."),
            ("doctor",  "I'm going to increase the amlodipine to 10mg and add telmisartan 40mg."),
            ("doctor",  "I also want you to get an ECG and lipid profile done today."),
            ("patient", "Theek hai doctor. Kuch aur karna hai?"),
            ("doctor",  "Salt restriction, no more than 2 grams per day. Follow up in two weeks."),
            ("doctor",  "If you have severe headache or chest pain, come immediately to the emergency."),
        ],
        "note": {
            "chief_complaint": "Headache for 2 weeks, predominantly occipital, worse in the morning. Associated with occasional transient blurring of vision.",
            "history_of_present_illness": "52-year-old male presenting with 2-week history of occipital headache, worst in the mornings. Reports occasional blurring of vision lasting a few minutes. No nausea or vomiting. Previously diagnosed with hypertension, currently on amlodipine 5mg for 1 year.",
            "past_medical_history": "Hypertension (diagnosed approximately 1 year ago)",
            "medications": "Amlodipine 5mg once daily",
            "allergies": "Not documented in this consultation.",
            "review_of_systems": "Neurological: occipital headache, transient blurred vision. Cardiovascular: elevated BP. Gastrointestinal: no nausea/vomiting.",
            "subjective": "52-year-old male with known hypertension presenting with 2-week occipital headache and transient visual blurring on amlodipine 5mg. Father had MI at 60.",
            "objective": "Blood Pressure: 158/96 mmHg (elevated). BP measured in clinic: 158/96 mmHg.",
            "physical_examination": "BP measured in clinic: 158/96 mmHg",
            "assessment": "1. Uncontrolled hypertension (I10)\n2. Hypertensive headache",
            "plan": "1. Amlodipine increased from 5mg to 10mg once daily\n2. Telmisartan 40mg once daily — new addition\n3. ECG (today)\n4. Fasting lipid profile (today)\n5. Salt restriction: maximum 2g per day\n6. Follow up in 2 weeks. Emergency if severe headache or chest pain.",
            "follow_up": "Review in 2 weeks. Emergency attendance if severe headache or chest pain.",
            "icd_codes": [
                {"code": "I10", "description": "Essential (primary) hypertension"},
                {"code": "G44.309", "description": "Post-traumatic headache, unspecified, not intractable"},
            ],
            "confidence_score": 0.91,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000002"),
        "doctor_id": DR_ANANYA,
        "patient_name": "Sushma Devi",
        "patient_age": 64,
        "patient_gender": "Female",
        "duration_seconds": 623,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=1, minutes=30),
        "transcript": [
            ("doctor",  "Mrs. Sushma, good morning. I've reviewed your previous echo report. How are you feeling?"),
            ("patient", "Doctor, thoda breathlessness ho raha hai last 3-4 dino se. Seedhi nahi chal pa rahi."),
            ("doctor",  "How many steps before you get breathless?"),
            ("patient", "Ghar mein hi, 10-15 kadam mein ruk jaati hoon."),
            ("doctor",  "Any ankle swelling? Chest pain? Palpitations?"),
            ("patient", "Ankle thoda suja hua hai, haan. Chest pain nahi. Dil thoda tez lagta hai kabhi kabhi."),
            ("doctor",  "When did you last take your furosemide?"),
            ("patient", "Kal subah. Roz leta hoon."),
            ("doctor",  "Let me examine you. JVP is elevated. Bibasal crepitations on auscultation. Bilateral pitting ankle oedema 2+."),
            ("doctor",  "This looks like decompensated heart failure. I'm going to double the furosemide dose temporarily."),
            ("doctor",  "Furosemide 80mg once daily for 5 days, then back to 40mg."),
            ("patient", "Kuch aur?"),
            ("doctor",  "Salt restriction very strictly. Less than 1.5 grams per day. Fluid restriction — less than 1.5 litres."),
            ("doctor",  "I want a BNP, renal function test, electrolytes today. Echo repeat in 4 weeks."),
            ("doctor",  "Come back in 5 days. If breathlessness worsens or you cannot lie flat, go to emergency directly."),
        ],
        "note": {
            "chief_complaint": "Breathlessness on minimal exertion for 3-4 days. Unable to walk more than 10-15 steps without stopping.",
            "history_of_present_illness": "64-year-old female with known cardiac history presenting with progressive breathlessness over 3-4 days. Functional capacity severely reduced — symptomatic after 10-15 steps. Reports associated bilateral ankle swelling and intermittent palpitations. No chest pain. Currently on furosemide (last dose yesterday morning).",
            "past_medical_history": "Known cardiac disease (previous echo on file). On furosemide — consistent with heart failure management.",
            "medications": "Furosemide 40mg once daily",
            "allergies": "Not documented in this consultation.",
            "review_of_systems": "Respiratory: progressive dyspnoea on minimal exertion. Cardiovascular: palpitations, ankle oedema, elevated JVP. No chest pain.",
            "subjective": "64-year-old female with known cardiac disease presenting with decompensated heart failure — progressive dyspnoea, elevated JVP, bibasal crepitations, bilateral 2+ ankle oedema.",
            "objective": "JVP elevated. Bibasal crepitations on auscultation. Bilateral pitting ankle oedema 2+.",
            "physical_examination": "JVP elevated. Bibasal crepitations on auscultation. Bilateral pitting ankle oedema 2+.",
            "assessment": "1. Decompensated heart failure (I50.9)",
            "plan": "1. Furosemide increased to 80mg once daily for 5 days, then revert to 40mg once daily\n2. BNP (today)\n3. Renal function test (today)\n4. Serum electrolytes (today)\n5. Echocardiogram (repeat in 4 weeks)\n6. Salt restriction < 1.5g/day. Fluid restriction < 1.5L/day.\n7. Review in 5 days. Emergency if breathlessness worsens or cannot lie flat.",
            "follow_up": "Review in 5 days. Emergency attendance if breathlessness worsens or patient cannot lie flat.",
            "icd_codes": [
                {"code": "I50.9", "description": "Heart failure, unspecified"},
            ],
            "confidence_score": 0.88,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000003"),
        "doctor_id": DR_RAJESH,
        "patient_name": "Aryan Sharma",
        "patient_age": 7,
        "patient_gender": "Male",
        "duration_seconds": 312,
        "created_at": datetime.now(timezone.utc) - timedelta(minutes=25),
        "transcript": [
            ("doctor",  "Hello, please come in. So what's going on with little Aryan?"),
            ("patient", "Doctor, isko kal raat se bukhaar hai. 102 degree aaya tha."),
            ("doctor",  "Any cough, cold, runny nose?"),
            ("patient", "Haan thodi si naak beh rahi hai. Khaana nahi kha raha."),
            ("doctor",  "Any ear pain? Does he pull his ears?"),
            ("patient", "Nahi, kaan nahi pakda usne."),
            ("doctor",  "Let me have a look. Throat is red, mild tonsillar hypertrophy. Ears are clear. Chest is clear."),
            ("doctor",  "This looks like viral URTI. No need for antibiotics."),
            ("doctor",  "Give paracetamol 250mg every 6 hours if fever above 38 degrees."),
            ("patient", "Koi syrup dena hai?"),
            ("doctor",  "Yes, cetirizine 2.5ml once at night for the runny nose. Plenty of fluids. Light diet."),
            ("doctor",  "Come back if fever persists beyond 3 days or if he develops rash or difficulty breathing."),
        ],
        "note": {
            "chief_complaint": "Fever since last night, maximum 102°F. Associated runny nose and poor appetite.",
            "history_of_present_illness": "7-year-old male brought by parent with 1-day history of fever (max 102°F). Associated rhinorrhoea and decreased appetite. No ear pain or ear pulling reported. No cough.",
            "past_medical_history": "Not documented in this consultation.",
            "medications": "None currently",
            "allergies": "Not documented in this consultation.",
            "review_of_systems": "ENT: rhinorrhoea, pharyngeal erythema. Fever 102°F. Appetite reduced. No ear pain. No cough.",
            "subjective": "7-year-old male with 1-day history of fever and rhinorrhoea consistent with viral URTI.",
            "objective": "Temperature: 102°F (reported by parent). Throat: erythematous, mild tonsillar hypertrophy. Ears: clear bilaterally. Chest: clear on auscultation.",
            "physical_examination": "Throat: erythematous, mild tonsillar hypertrophy. Ears: clear bilaterally. Chest: clear on auscultation.",
            "assessment": "1. Viral upper respiratory tract infection (J06.9)",
            "plan": "1. Paracetamol 250mg every 6 hours if temperature > 38°C\n2. Cetirizine 2.5ml once daily at night for rhinorrhoea\n3. Adequate oral hydration. Light diet.\n4. Return if fever persists beyond 3 days, or if rash or difficulty breathing develops.",
            "follow_up": "Return if fever persists beyond 3 days, or if rash or difficulty breathing develops.",
            "icd_codes": [
                {"code": "J06.9", "description": "Acute upper respiratory infection, unspecified"},
            ],
            "confidence_score": 0.85,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": False,
        },
    },
]


async def seed(db: AsyncSession):
    seeded = 0
    for demo in DEMO_SESSIONS:
        existing = await db.get(SessionModel, demo["id"])
        if existing:
            print(f"  Session {demo['patient_name']} already exists — skipping")
            continue

        now = demo["created_at"]
        ended_at = now + timedelta(seconds=demo["duration_seconds"])

        # Create or retrieve patient record
        patient_result = await db.execute(
            select(Patient).where(Patient.name == demo["patient_name"])
        )
        patient = patient_result.scalar_one_or_none()
        if not patient:
            patient = Patient(
                id=uuid4(),
                name=demo["patient_name"],
                age=demo["patient_age"],
                gender=demo["patient_gender"],
            )
            db.add(patient)
            await db.flush()

        # Create session
        session = SessionModel(
            id=demo["id"],
            doctor_id=demo["doctor_id"],
            patient_id=patient.id,
            patient_consent_given=True,
            consent_timestamp=now,
            status="completed",
            started_at=now,
            ended_at=ended_at,
            created_at=now,
        )
        db.add(session)
        await db.flush()

        # Create transcript chunks
        chunk_interval_ms = (demo["duration_seconds"] * 1000) // max(len(demo["transcript"]), 1)
        for i, (speaker, text) in enumerate(demo["transcript"]):
            chunk = Transcript(
                id=uuid4(),
                session_id=demo["id"],
                speaker=speaker,
                text=text,
                start_time_ms=i * chunk_interval_ms,
                confidence=0.87 + (i % 3) * 0.03,
                created_at=now + timedelta(milliseconds=i * chunk_interval_ms),
            )
            db.add(chunk)

        # Create clinical note
        note_id = uuid4()
        note_data = demo["note"]
        is_finalized = note_data["is_finalized"]
        note = ClinicalNote(
            id=note_id,
            session_id=demo["id"],
            status="finalized" if is_finalized else "ready",
            chief_complaint=note_data["chief_complaint"],
            history_of_present_illness=note_data["history_of_present_illness"],
            past_medical_history=note_data["past_medical_history"],
            medications=note_data["medications"],
            allergies=note_data["allergies"],
            review_of_systems=note_data["review_of_systems"],
            subjective=note_data["subjective"],
            objective=note_data["objective"],
            physical_examination=note_data["physical_examination"],
            assessment=note_data["assessment"],
            plan=note_data["plan"],
            follow_up=note_data["follow_up"],
            icd_codes=note_data["icd_codes"],
            confidence_score=note_data["confidence_score"],
            generated_by=note_data["generated_by"],
            is_finalized=is_finalized,
            finalized_at=ended_at + timedelta(minutes=2) if is_finalized else None,
            created_at=ended_at,
        )
        db.add(note)

        # Audit: generated
        db.add(NoteAuditLog(
            id=uuid4(),
            note_id=note_id,
            changed_by=demo["doctor_id"],
            change_type="generated",
            snapshot={
                "confidence_score": note_data["confidence_score"],
                "chunk_count": len(demo["transcript"]),
                "seeded": True,
            },
            created_at=ended_at + timedelta(seconds=30),
        ))

        # Audit: finalized (if applicable)
        if is_finalized:
            db.add(NoteAuditLog(
                id=uuid4(),
                note_id=note_id,
                changed_by=demo["doctor_id"],
                change_type="finalized",
                snapshot={"finalized_at": (ended_at + timedelta(minutes=2)).isoformat()},
                created_at=ended_at + timedelta(minutes=2),
            ))

        await db.commit()
        seeded += 1
        print(f"  ✓ Seeded: {demo['patient_name']} ({demo['duration_seconds']}s)")

    return seeded


async def main():
    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with AsyncSessionLocal() as db:
        print("Seeding demo data...")
        n = await seed(db)
        print(f"Done. {n} sessions seeded (0 = already existed).")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
