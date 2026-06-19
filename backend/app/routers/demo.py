from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ClinicalNote, NoteAuditLog, Session as SessionModel, Transcript
from app.models.patient import Patient
from app.models.patient_document import PatientDocument
from scripts.seed_demo import seed

router = APIRouter()

DEMO_SESSION_IDS = [
    UUID("aaaaaaaa-0000-0000-0000-000000000001"),
    UUID("aaaaaaaa-0000-0000-0000-000000000002"),
    UUID("aaaaaaaa-0000-0000-0000-000000000003"),
    # Arjun Mehta — longitudinal demo patient (5 visits)
    UUID("aaaaaaaa-0000-0000-0000-000000000004"),
    UUID("aaaaaaaa-0000-0000-0000-000000000005"),
    UUID("aaaaaaaa-0000-0000-0000-000000000006"),
    UUID("aaaaaaaa-0000-0000-0000-000000000007"),
    UUID("aaaaaaaa-0000-0000-0000-000000000008"),
]

DEMO_PATIENT_NAMES = ["Ramesh Kumar", "Sushma Devi", "Aryan Sharma", "Arjun Mehta"]

ARJUN_PATIENT_ID = UUID("bbbbbbbb-0000-0000-0000-000000000001")

DEMO_DOCUMENT_IDS = [
    UUID("cccccccc-0000-0000-0000-000000000001"),
    UUID("cccccccc-0000-0000-0000-000000000002"),
    UUID("cccccccc-0000-0000-0000-000000000003"),
]


@router.post("/seed")
async def seed_demo(request: Request, db: AsyncSession = Depends(get_db)):
    n = await seed(db)

    # Stamp all demo sessions with the caller's clinic_id
    raw_clinic_id = getattr(request.state, "clinic_id", None)
    if raw_clinic_id:
        clinic_uuid = UUID(str(raw_clinic_id))
        for session_id in DEMO_SESSION_IDS:
            session = await db.get(SessionModel, session_id)
            if session:
                session.clinic_id = clinic_uuid
        # Stamp Arjun's documents with the clinic_id too
        for doc_id in DEMO_DOCUMENT_IDS:
            doc = await db.get(PatientDocument, doc_id)
            if doc:
                doc.clinic_id = clinic_uuid
        # Stamp all demo patients with the caller's clinic_id
        for name in DEMO_PATIENT_NAMES:
            patient_result = await db.execute(select(Patient).where(Patient.name == name))
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient.clinic_id = clinic_uuid
        await db.commit()

    return {"seeded": n, "clinic_id": str(raw_clinic_id) if raw_clinic_id else None}


@router.delete("/seed")
async def unseed_demo(db: AsyncSession = Depends(get_db)):
    removed = 0
    for session_id in DEMO_SESSION_IDS:
        session = await db.get(SessionModel, session_id)
        if not session:
            continue

        note_result = await db.execute(
            select(ClinicalNote).where(ClinicalNote.session_id == session_id)
        )
        note = note_result.scalar_one_or_none()
        if note:
            await db.execute(delete(NoteAuditLog).where(NoteAuditLog.note_id == note.id))
            await db.delete(note)

        await db.execute(delete(Transcript).where(Transcript.session_id == session_id))
        await db.delete(session)
        removed += 1

    # Remove Arjun's documents
    for doc_id in DEMO_DOCUMENT_IDS:
        doc = await db.get(PatientDocument, doc_id)
        if doc:
            await db.delete(doc)

    await db.commit()

    # Remove demo patients if they have no remaining sessions
    for name in DEMO_PATIENT_NAMES:
        patient_result = await db.execute(select(Patient).where(Patient.name == name))
        patient = patient_result.scalar_one_or_none()
        if not patient:
            continue
        sessions_result = await db.execute(
            select(SessionModel).where(SessionModel.patient_id == patient.id)
        )
        if sessions_result.scalar_one_or_none() is None:
            await db.delete(patient)

    await db.commit()
    return {"removed": removed}
