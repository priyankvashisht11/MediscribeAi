# backend/app/routers/doctors.py — real DB queries

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Doctor

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


@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    clinic_id = getattr(request.state, "clinic_id", None)
    doc = await db.get(Doctor, doctor_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if clinic_id and doc.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc
