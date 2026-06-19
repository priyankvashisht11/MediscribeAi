# backend/app/routers/doctors.py — real DB queries

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ClinicalNote, Doctor, Session as SessionModel

logger = logging.getLogger(__name__)
router = APIRouter()


class DoctorResponse(BaseModel):
    id: UUID
    name: str
    specialty: str
    email: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[DoctorResponse])
async def list_doctors(request: Request, db: AsyncSession = Depends(get_db)):
    clinic_id = getattr(request.state, "clinic_id", None)
    query = select(Doctor).order_by(Doctor.name)
    if clinic_id:
        query = query.where(Doctor.clinic_id == clinic_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/with-stats")
async def list_doctors_with_stats(request: Request, db: AsyncSession = Depends(get_db)):
    clinic_id = getattr(request.state, "clinic_id", None)
    query = select(Doctor).order_by(Doctor.name)
    if clinic_id:
        query = query.where(Doctor.clinic_id == clinic_id)
    result = await db.execute(query)
    doctors = result.scalars().all()

    # Per-doctor stats in bulk
    stats_q = (
        select(
            SessionModel.doctor_id,
            func.count(SessionModel.id).label("session_count"),
            func.count(func.distinct(SessionModel.patient_id)).label("patient_count"),
            func.max(SessionModel.created_at).label("last_session_at"),
        )
        .group_by(SessionModel.doctor_id)
    )
    if clinic_id:
        stats_q = stats_q.where(SessionModel.clinic_id == clinic_id)
    stats_rows = (await db.execute(stats_q)).all()
    stats_map = {str(r.doctor_id): r for r in stats_rows}

    # Finalized notes count per doctor
    notes_q = (
        select(
            SessionModel.doctor_id,
            func.count(ClinicalNote.id).label("finalized_notes"),
        )
        .join(ClinicalNote, ClinicalNote.session_id == SessionModel.id)
        .where(ClinicalNote.is_finalized == True)
        .group_by(SessionModel.doctor_id)
    )
    if clinic_id:
        notes_q = notes_q.where(SessionModel.clinic_id == clinic_id)
    notes_rows = (await db.execute(notes_q)).all()
    notes_map = {str(r.doctor_id): r.finalized_notes for r in notes_rows}

    out = []
    for d in doctors:
        s = stats_map.get(str(d.id))
        out.append({
            "id": str(d.id),
            "name": d.name,
            "specialty": d.specialty,
            "email": d.email,
            "session_count": s.session_count if s else 0,
            "patient_count": s.patient_count if s else 0,
            "finalized_notes": notes_map.get(str(d.id), 0),
            "last_session_at": s.last_session_at.isoformat() if s and s.last_session_at else None,
        })
    return out


@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    clinic_id = getattr(request.state, "clinic_id", None)
    doc = await db.get(Doctor, doctor_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if clinic_id and doc.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc
