# backend/app/routers/notes.py

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ClinicalNote, NoteAuditLog, Session as SessionModel, Doctor
from app.models.patient import Patient
from app.services.note_generator import generate_soap_note

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class AuditLogEntry(BaseModel):
    id: UUID
    note_id: UUID
    changed_by: UUID | None
    change_type: str
    snapshot: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


def _get_clinic_id(request: Request):
    return getattr(request.state, "clinic_id", None)


async def _verify_session_clinic(session_id: UUID, clinic_id, db: AsyncSession) -> SessionModel:
    """Fetch session and verify clinic ownership. Returns session or raises 404."""
    session = await db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if clinic_id and session.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def _verify_note_clinic(note_id: UUID, clinic_id, db: AsyncSession) -> ClinicalNote:
    """Fetch note, verify it belongs to clinic via session. Returns note or raises 404."""
    note = await db.get(ClinicalNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if clinic_id:
        session = await db.get(SessionModel, note.session_id)
        if not session or session.clinic_id != clinic_id:
            raise HTTPException(status_code=404, detail="Note not found")
    return note


# ── Helpers ────────────────────────────────────────────────────────────────────

def _add_audit(db: AsyncSession, note_id: UUID, doctor_id: UUID | None, change_type: str, snapshot: dict) -> None:
    """Stage an audit log entry without committing. Caller must commit."""
    entry = NoteAuditLog(
        note_id=note_id,
        changed_by=doctor_id,
        change_type=change_type,
        snapshot=snapshot,
    )
    db.add(entry)


async def _cleanup_redis(session_id: str) -> None:
    """Delete all Redis keys for a completed session. Failure is non-fatal."""
    try:
        from app.services.redis_client import get_client
        redis = get_client()
        cursor = 0
        while True:
            cursor, keys = await redis.scan(cursor, match=f"session:{session_id}:*", count=100)
            if keys:
                await redis.delete(*keys)
            if cursor == 0:
                break
        logger.info(f"Redis cleanup done for session {session_id}")
    except Exception as e:
        logger.warning(f"Redis cleanup failed for session {session_id}: {e}")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/{session_id}")
async def get_note(session_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Get the clinical note for a session.
    Returns status='not_started' if no note exists yet.
    Frontend polls this until status != 'generating'.
    """
    await _verify_session_clinic(session_id, _get_clinic_id(request), db)
    result = await db.execute(
        select(ClinicalNote).where(ClinicalNote.session_id == session_id)
    )
    note = result.scalar_one_or_none()

    if not note:
        return {"status": "not_started", "session_id": str(session_id), "note_id": None}

    return {
        "status": note.status,
        "session_id": str(session_id),
        "note_id": str(note.id),
        # SOAP fields
        "subjective": note.subjective or "",
        "objective": note.objective or "",
        "assessment": note.assessment or "",
        "plan": note.plan or "",
        "chief_complaint": note.chief_complaint or "",
        "history_of_present_illness": note.history_of_present_illness or note.subjective or "",
        # AI metadata
        "icd_codes": note.icd_codes or [],
        "confidence_score": note.confidence_score or 0.0,
        "missing_information": note.missing_information or [],
        "generated_by": note.generated_by or "",
        # Finalization
        "is_finalized": note.is_finalized,
        "finalized_at": note.finalized_at.isoformat() if note.finalized_at else None,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.post("/{session_id}/generate")
async def trigger_note_generation(
    session_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger SOAP note generation for a session.
    Returns immediately — frontend polls GET /{session_id} until status='ready'.
    Called when note status is 'not_started' (e.g. from useNote hook).
    """
    await _verify_session_clinic(session_id, _get_clinic_id(request), db)
    doctor_id = getattr(request.state, "doctor_id", None)
    result = await db.execute(
        select(ClinicalNote).where(ClinicalNote.session_id == session_id)
    )
    existing = result.scalar_one_or_none()

    if existing and existing.status == "ready":
        return {"status": "already_generated", "note_id": str(existing.id)}

    if not existing:
        placeholder = ClinicalNote(
            session_id=session_id,
            status="generating",
            subjective="", objective="", assessment="", plan="",
            chief_complaint="", icd_codes=[], confidence_score=0.0,
            missing_information=[], generated_by="pending",
            is_finalized=False,
        )
        db.add(placeholder)
        await db.commit()
        await db.refresh(placeholder)
        note_id = placeholder.id
    else:
        existing.status = "generating"
        await db.commit()
        note_id = existing.id

    background_tasks.add_task(
        _run_generation_task,
        session_id=session_id,
        note_id=note_id,
        transcript_text="",
        patient_name="Patient",
        doctor_name="Doctor",
        specialty="General Medicine",
        session_date=datetime.now().strftime("%d %B %Y"),
        doctor_id=doctor_id,
    )
    return {"status": "generating", "note_id": str(note_id)}


async def _run_generation_task(
    session_id: UUID,
    note_id: UUID,
    transcript_text: str,
    patient_name: str,
    doctor_name: str,
    specialty: str,
    session_date: str,
    doctor_id: UUID | None = None,
) -> None:
    """
    Background task: run LangChain note generation and save result to DB.
    transcript_text is passed directly (read from Redis by the caller before
    WebSocket closes) to avoid race conditions with Redis cleanup.
    """
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            if not transcript_text.strip():
                logger.warning(f"Session {session_id}: empty transcript for note generation")
                await _update_note_status(db, note_id, "error",
                                          error_msg="No transcript available — session may have ended before audio was processed")
                return

            logger.info(f"Starting SOAP generation for session {session_id}")
            note_data = await generate_soap_note(
                transcript=transcript_text,
                patient_name=patient_name,
                doctor_name=doctor_name,
                session_date=session_date,
                specialty=specialty,
                duration_minutes=10,
            )

            result = await db.execute(select(ClinicalNote).where(ClinicalNote.id == note_id))
            note = result.scalar_one_or_none()
            if note:
                note.status = "ready"
                note.subjective = note_data["subjective"]
                note.objective = note_data["objective"]
                note.assessment = note_data["assessment"]
                note.plan = note_data["plan"]
                note.chief_complaint = note_data["chief_complaint"]
                note.history_of_present_illness = note_data.get("history_of_present_illness", "")
                note.icd_codes = note_data["icd_codes"]
                note.confidence_score = note_data["confidence_score"]
                note.missing_information = note_data["missing_information"]
                note.extracted_entities = note_data.get("raw_entities", {})
                note.generated_by = note_data["generated_by"]
                _add_audit(db, note_id, doctor_id, "generated", {
                    "model": note_data["generated_by"],
                    "confidence_score": note_data["confidence_score"],
                    "transcript_char_count": len(transcript_text),
                })
                await db.commit()
                logger.info(f"SOAP note saved for session {session_id}. Confidence: {note_data['confidence_score']}")

        except Exception as e:
            logger.error(f"Note generation failed for session {session_id}: {e}", exc_info=True)
            await _update_note_status(db, note_id, "error", error_msg=str(e))
            return

    # Redis cleanup runs after DB session is closed — non-fatal
    await _cleanup_redis(str(session_id))


async def _update_note_status(db: AsyncSession, note_id: UUID, status: str, error_msg: str = "") -> None:
    result = await db.execute(select(ClinicalNote).where(ClinicalNote.id == note_id))
    note = result.scalar_one_or_none()
    if note:
        note.status = status
        if error_msg:
            note.missing_information = [f"Generation error: {error_msg}"]
        await db.commit()


@router.patch("/{note_id}")
async def update_note(
    note_id: UUID,
    body: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Update SOAP note fields (doctor edits in NoteReview page)."""
    doctor_id = getattr(request.state, "doctor_id", None)
    note = await _verify_note_clinic(note_id, _get_clinic_id(request), db)

    editable_fields = ["subjective", "objective", "assessment", "plan", "chief_complaint"]
    for field in editable_fields:
        if field in body:
            old_value = getattr(note, field) or ""
            new_value = body[field]
            setattr(note, field, new_value)
            _add_audit(db, note_id, doctor_id, "section_edit", {
                "section": field,
                "old_value": old_value,
                "new_value": new_value,
            })

    note.status = "edited"
    await db.commit()
    return {"status": "updated", "note_id": str(note_id)}


@router.post("/{note_id}/finalize")
async def finalize_note(
    note_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Mark note as finalized (signed off by doctor). Returns 400 if already finalized."""
    doctor_id = getattr(request.state, "doctor_id", None)
    note = await _verify_note_clinic(note_id, _get_clinic_id(request), db)
    if note.is_finalized:
        raise HTTPException(status_code=400, detail="Note already finalized")
    note.is_finalized = True
    note.finalized_at = datetime.now(timezone.utc)
    note.status = "finalized"
    _add_audit(db, note_id, doctor_id, "finalized", {
        "finalized_at": note.finalized_at.isoformat(),
    })
    await db.commit()

    # Invalidate patient analysis cache so next GET recalculates
    try:
        session = await db.get(SessionModel, note.session_id)
        if session and session.patient_id:
            from app.services.redis_client import get_client
            redis = get_client()
            await redis.delete(f"patient_analysis:{session.patient_id}")
    except Exception:
        pass

    return {"status": "finalized", "note_id": str(note_id)}


@router.get("/{note_id}/audit", response_model=list[AuditLogEntry])
async def get_audit_log(note_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Return all audit entries for a note, newest first."""
    await _verify_note_clinic(note_id, _get_clinic_id(request), db)
    result = await db.execute(
        select(NoteAuditLog)
        .where(NoteAuditLog.note_id == note_id)
        .order_by(NoteAuditLog.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{note_id}/export/pdf")
async def export_note_pdf(note_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Generate and return an A4 PDF of the clinical note."""
    from app.services.pdf_generator import generate_note_pdf

    note = await _verify_note_clinic(note_id, _get_clinic_id(request), db)

    session = await db.get(SessionModel, note.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    doctor = await db.get(Doctor, session.doctor_id)
    doctor_name = doctor.name if doctor else "Unknown Doctor"

    patient_name = "Unknown"
    patient_age = None
    patient_gender = None
    if session.patient_id:
        patient = await db.get(Patient, session.patient_id)
        if patient:
            patient_name = patient.name
            patient_age = patient.age
            patient_gender = patient.gender

    note_dict = {c.name: getattr(note, c.name) for c in note.__table__.columns}
    session_dict = {c.name: getattr(session, c.name) for c in session.__table__.columns}

    try:
        pdf_bytes = generate_note_pdf(
            note=note_dict,
            session=session_dict,
            doctor_name=doctor_name,
            patient_name=patient_name,
            patient_age=patient_age,
            patient_gender=patient_gender,
        )
    except Exception as e:
        logger.error(f"PDF generation failed for note {note_id}: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    filename = f"chartr_note_{str(note_id)[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _get_note_session_doctor(note_id: UUID, db: AsyncSession):
    """Shared helper — fetch note, session, doctor, patient for PDF endpoints."""
    note = await db.get(ClinicalNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    session = await db.get(SessionModel, note.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    doctor = await db.get(Doctor, session.doctor_id)
    doctor_name = doctor.name if doctor else "Unknown Doctor"
    patient_name, patient_age, patient_gender = "Unknown", None, None
    if session.patient_id:
        patient = await db.get(Patient, session.patient_id)
        if patient:
            patient_name = patient.name
            patient_age = getattr(patient, "age", None)
            patient_gender = getattr(patient, "gender", None)
    note_dict = {c.name: getattr(note, c.name) for c in note.__table__.columns}
    session_dict = {c.name: getattr(session, c.name) for c in session.__table__.columns}
    return note_dict, session_dict, doctor_name, patient_name, patient_age, patient_gender


@router.get("/{note_id}/prescription")
async def export_prescription_pdf(note_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Generate and return a prescription PDF for the given note."""
    from app.services.prescription_generator import generate_prescription_pdf
    await _verify_note_clinic(note_id, _get_clinic_id(request), db)
    note_dict, session_dict, doctor_name, patient_name, patient_age, patient_gender = \
        await _get_note_session_doctor(note_id, db)
    try:
        pdf_bytes = await generate_prescription_pdf(
            note=note_dict, session=session_dict,
            doctor_name=doctor_name, patient_name=patient_name,
            patient_age=patient_age, patient_gender=patient_gender,
        )
    except Exception as e:
        logger.error(f"Prescription PDF failed for note {note_id}: {e}")
        raise HTTPException(status_code=500, detail="Prescription PDF generation failed")
    filename = f"prescription_{str(note_id)[:8]}.pdf"
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{note_id}/instructions")
async def export_instructions_pdf(note_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Generate and return a patient instructions PDF for the given note."""
    from app.services.instructions_generator import generate_instructions_pdf
    await _verify_note_clinic(note_id, _get_clinic_id(request), db)
    note_dict, session_dict, doctor_name, patient_name, patient_age, _ = \
        await _get_note_session_doctor(note_id, db)
    try:
        pdf_bytes = await generate_instructions_pdf(
            note=note_dict, session=session_dict,
            doctor_name=doctor_name, patient_name=patient_name,
            patient_age=patient_age,
        )
    except Exception as e:
        logger.error(f"Instructions PDF failed for note {note_id}: {e}")
        raise HTTPException(status_code=500, detail="Instructions PDF generation failed")
    filename = f"instructions_{str(note_id)[:8]}.pdf"
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
