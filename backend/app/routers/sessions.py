# backend/app/routers/sessions.py

import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Doctor, Patient, Session, Transcript
from app.services.diarization import resolve_doctor_patient
from app.services.note_generator import format_transcript_for_llm
from app.services.session_state import get_session_segments, get_speaker_map

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    doctor_id: UUID
    patient_name: str | None = None
    patient_age: int | None = None


class SessionResponse(BaseModel):
    id: UUID
    doctor_id: UUID
    status: str
    patient_name: str | None
    created_at: datetime
    started_at: datetime | None = None
    duration_seconds: int | None = None


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TranscriptChunk(BaseModel):
    id: UUID
    speaker: str
    text: str
    start_time_ms: int | None
    confidence: float | None
    created_at: datetime

    class Config:
        from_attributes = True


class SpeakerCorrectionRequest(BaseModel):
    speaker: str


class FlipAllSpeakersRequest(BaseModel):
    pass  # no body needed — flip doctor↔patient for the whole session


def _build_response(s: Session, p: Patient | None) -> SessionResponse:
    duration = None
    if s.started_at and s.ended_at:
        duration = int((s.ended_at - s.started_at).total_seconds())
    return SessionResponse(
        id=s.id,
        doctor_id=s.doctor_id,
        status=s.status,
        patient_name=p.name if p else None,
        created_at=s.created_at,
        started_at=s.started_at,
        duration_seconds=duration,
    )


# ── Endpoints (specific paths BEFORE /{session_id} — FastAPI matches in order) ─

@router.get("/stats/summary")
async def get_session_stats(
    doctor_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    # Total sessions
    total_q = select(func.count()).select_from(Session)
    if doctor_id:
        total_q = total_q.where(Session.doctor_id == doctor_id)
    total = (await db.execute(total_q)).scalar_one()

    # By status
    status_q = select(Session.status, func.count().label("cnt")).group_by(Session.status)
    if doctor_id:
        status_q = status_q.where(Session.doctor_id == doctor_id)
    status_counts = {row.status: row.cnt for row in (await db.execute(status_q))}

    # Today's sessions in IST (UTC+5:30)
    utc_now = datetime.now(timezone.utc)
    ist_today_start = datetime.combine(
        (utc_now + timedelta(hours=5, minutes=30)).date(), datetime.min.time()
    ).replace(tzinfo=timezone.utc) - timedelta(hours=5, minutes=30)
    today_q = select(func.count()).select_from(Session).where(Session.created_at >= ist_today_start)
    if doctor_id:
        today_q = today_q.where(Session.doctor_id == doctor_id)
    today_count = (await db.execute(today_q)).scalar_one()

    # Avg duration (completed only) — computed from started_at / ended_at
    avg_q = select(
        func.avg(func.extract("epoch", Session.ended_at - Session.started_at))
    ).where(
        Session.status == "completed",
        Session.started_at.isnot(None),
        Session.ended_at.isnot(None),
    )
    if doctor_id:
        avg_q = avg_q.where(Session.doctor_id == doctor_id)
    avg_duration = (await db.execute(avg_q)).scalar_one()

    # Finalized notes
    from app.models import ClinicalNote
    fin_q = select(func.count()).select_from(ClinicalNote).where(ClinicalNote.is_finalized == True)
    finalized_notes = (await db.execute(fin_q)).scalar_one()

    return {
        "total_sessions": total,
        "today_sessions": today_count,
        "recording_now": status_counts.get("recording", 0),
        "completed_sessions": status_counts.get("completed", 0),
        "idle_sessions": status_counts.get("idle", 0),
        "avg_duration_seconds": round(avg_duration or 0),
        "finalized_notes": finalized_notes,
    }


@router.get("/active", response_model=list[SessionResponse])
async def get_active_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Session, Patient)
        .join(Patient, Session.patient_id == Patient.id, isouter=True)
        .where(Session.status.in_(["recording", "idle"]))
        .order_by(Session.created_at.desc())
    )
    return [_build_response(s, p) for s, p in result.all()]


@router.get("/", response_model=SessionListResponse)
async def list_sessions(
    doctor_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Session, Patient)
        .join(Patient, Session.patient_id == Patient.id, isouter=True)
        .order_by(Session.created_at.desc())
    )
    if doctor_id:  query = query.where(Session.doctor_id == doctor_id)
    if status:     query = query.where(Session.status == status)
    if search:     query = query.where(Patient.name.ilike(f"%{search}%"))
    if date_from:  query = query.where(Session.created_at >= date_from)
    if date_to:    query = query.where(Session.created_at <= date_to)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).all()

    return {
        "items": [_build_response(s, p) for s, p in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Session, Patient)
        .join(Patient, Session.patient_id == Patient.id, isouter=True)
        .where(Session.id == session_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return _build_response(*row)


@router.post("/", response_model=SessionResponse)
async def create_session(body: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    name = body.patient_name or "Anonymous Patient"
    age = body.patient_age

    # ── Patient dedup: name (case-insensitive) + age ───────────────────────────
    # age < 12 → exact age match (a 6yo and 7yo "Arjun" are different patients)
    # age >= 12 → ±1 year tolerance for birthday drift
    patient = None
    if age is not None:
        if age < 12:
            result = await db.execute(
                select(Patient).where(
                    func.lower(Patient.name) == name.lower(),
                    Patient.age == age,
                )
            )
        else:
            result = await db.execute(
                select(Patient).where(
                    func.lower(Patient.name) == name.lower(),
                    Patient.age >= age - 1,
                    Patient.age <= age + 1,
                )
            )
        patient = result.scalar_one_or_none()

    if patient is None:
        patient = Patient(id=uuid.uuid4(), name=name, age=age)
        db.add(patient)
        try:
            await db.flush()
        except Exception:
            await db.rollback()
            # Race condition — another request created the same patient; re-fetch
            if age is not None and age < 12:
                result = await db.execute(
                    select(Patient).where(
                        func.lower(Patient.name) == name.lower(),
                        Patient.age == age,
                    )
                )
            elif age is not None:
                result = await db.execute(
                    select(Patient).where(
                        func.lower(Patient.name) == name.lower(),
                        Patient.age >= age - 1,
                        Patient.age <= age + 1,
                    )
                )
            else:
                result = await db.execute(
                    select(Patient).where(func.lower(Patient.name) == name.lower())
                )
            patient = result.scalar_one()

    session = Session(
        id=uuid.uuid4(),
        doctor_id=body.doctor_id,
        patient_id=patient.id,
        status="recording",
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return _build_response(session, patient)


@router.patch("/{session_id}/end")
async def end_session(
    session_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    End a session: set status='completed', trigger SOAP note generation.
    Reads transcript from Redis NOW (while WebSocket is still open) to avoid
    the race condition where ws.py clears Redis after WebSocket disconnect.
    """
    result = await db.execute(
        select(Session, Patient)
        .join(Patient, Session.patient_id == Patient.id, isouter=True)
        .where(Session.id == session_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    session, patient = row

    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()

    # Read transcript from Redis immediately — before WebSocket closes and clears it
    segments = await get_session_segments(str(session_id))
    speaker_map = await get_speaker_map(str(session_id))
    chunks = [
        {
            "text": seg.get("text", ""),
            "speaker": resolve_doctor_patient(seg.get("raw_speaker"), speaker_map),
            "start": seg.get("start", 0),
        }
        for seg in segments
        if seg.get("text", "").strip()
    ]
    transcript_text = format_transcript_for_llm(chunks)

    # Resolve doctor name and specialty from DB
    doctor = await db.get(Doctor, session.doctor_id)
    doctor_name = doctor.name if doctor else "Doctor"
    specialty = doctor.specialty if doctor else "General Medicine"
    patient_name = patient.name if patient else "Patient"
    session_date = session.created_at.strftime("%d %B %Y") if session.created_at else datetime.now().strftime("%d %B %Y")

    # Create note placeholder and trigger background generation
    from app.models import ClinicalNote
    from app.routers.notes import _run_generation_task

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

    background_tasks.add_task(
        _run_generation_task,
        session_id=session_id,
        note_id=placeholder.id,
        transcript_text=transcript_text,
        patient_name=patient_name,
        doctor_name=doctor_name,
        specialty=specialty,
        session_date=session_date,
    )

    return {
        "status": "completed",
        "session_id": str(session_id),
        "note_generation": "triggered",
        "note_id": str(placeholder.id),
    }


@router.get("/{session_id}/transcript", response_model=list[TranscriptChunk])
async def get_session_transcript(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Returns all transcript chunks for a session, ordered by start_time_ms."""
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(
        select(Transcript)
        .where(Transcript.session_id == session_id)
        .order_by(Transcript.start_time_ms.asc())
    )
    return result.scalars().all()


@router.patch("/{session_id}/flip-all-speakers")
async def flip_all_speakers(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Swap all doctor↔patient speaker labels for the entire session transcript."""
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(Transcript).where(Transcript.session_id == session_id)
    )
    chunks = result.scalars().all()

    flip = {"doctor": "patient", "patient": "doctor"}
    updated = 0
    for chunk in chunks:
        new_speaker = flip.get(chunk.speaker, chunk.speaker)
        if new_speaker != chunk.speaker:
            chunk.speaker = new_speaker
            updated += 1

    await db.commit()
    return {"session_id": str(session_id), "updated_chunks": updated}


@router.patch("/{session_id}/transcript/{chunk_id}/speaker")
async def correct_speaker(
    session_id: UUID,
    chunk_id: UUID,
    body: SpeakerCorrectionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Correct speaker attribution on a single transcript chunk."""
    if body.speaker not in ("doctor", "patient", "unknown"):
        raise HTTPException(status_code=400, detail="speaker must be doctor, patient, or unknown")
    chunk = await db.get(Transcript, chunk_id)
    if not chunk or chunk.session_id != session_id:
        raise HTTPException(status_code=404, detail="Chunk not found")
    chunk.speaker = body.speaker
    await db.commit()
    return {"id": str(chunk_id), "speaker": body.speaker, "updated": True}
