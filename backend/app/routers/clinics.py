# backend/app/routers/clinics.py

import random
import string
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Doctor
from app.models.billing import Subscription
from app.models.clinic import Clinic, ClinicInvite

router = APIRouter()        # protected routes — require_auth applied at include_router
public_router = APIRouter()  # unauthenticated routes (signup)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def _check_signup_rate(ip: str) -> None:
    """Rate limit clinic signups: 3 attempts per 10-minute window, keyed by IP in Redis."""
    from app.services.redis_client import get_client
    try:
        redis = get_client()
        key = f"signup_rate:{ip}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 600)  # 10 minutes
        if count > 3:
            raise HTTPException(
                status_code=429,
                detail="Too many signup attempts. Please wait 10 minutes.",
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Redis unavailable — fail open (don't block signups)


def _gen_invite_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _require_admin(request: Request) -> None:
    if getattr(request.state, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


# ── Schemas ────────────────────────────────────────────────────────────────────

class CreateClinicRequest(BaseModel):
    clinic_name: str
    plan_type: str = "solo"  # solo | clinic
    admin_name: str
    admin_specialty: str
    admin_email: str
    admin_password: str
    admin_medical_reg_no: str


class UpdateClinicRequest(BaseModel):
    name: str


class GenerateInviteRequest(BaseModel):
    email_hint: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _validate_password(password: str) -> None:
    import re
    if not re.match(r'^(?=.*[a-zA-Z])(?=.*\d).{8,}$', password):
        raise HTTPException(
            status_code=422,
            detail="Password must be at least 8 characters with at least one letter and one number.",
        )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@public_router.post("/")
async def create_clinic(
    body: CreateClinicRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Self-serve clinic signup. Rate-limited. No auth required."""
    await _check_signup_rate(request.client.host)
    _validate_password(body.admin_password)

    name_stripped = body.clinic_name.strip()
    if len(name_stripped) < 2 or len(name_stripped) > 100:
        raise HTTPException(status_code=422, detail="Clinic name must be 2–100 characters.")
    if body.plan_type not in ("solo", "clinic"):
        raise HTTPException(status_code=422, detail="plan_type must be 'solo' or 'clinic'.")

    email = body.admin_email.lower().strip()
    existing = (await db.execute(
        select(Doctor).where(func.lower(Doctor.email) == email)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    clinic = Clinic(name=name_stripped, plan_type=body.plan_type)
    db.add(clinic)
    await db.flush()

    reg_no = body.admin_medical_reg_no.strip()
    if not reg_no:
        raise HTTPException(status_code=422, detail="Medical registration number is required.")

    doctor = Doctor(
        name=body.admin_name,
        specialty=body.admin_specialty,
        email=email,
        hashed_password=pwd_context.hash(body.admin_password),
        clinic_id=clinic.id,
        role="admin",
        is_active=True,
        medical_registration_number=reg_no,
    )
    db.add(doctor)

    # Auto-start 30-day Solo trial for every new clinic
    trial_end = datetime.now(timezone.utc) + timedelta(days=30)
    db.add(Subscription(
        clinic_id=clinic.id,
        plan="solo",
        status="trialing",
        trial_ends_at=trial_end,
    ))

    await db.commit()
    await db.refresh(doctor)
    await db.refresh(clinic)

    from app.routers.auth import _make_doctor_token
    return {"token": _make_doctor_token(doctor), "expires_in": 86400, "clinic_id": str(clinic.id)}


@router.get("/me")
async def get_clinic(request: Request, db: AsyncSession = Depends(get_db)):
    """Get current clinic details."""
    clinic_id = getattr(request.state, "clinic_id", None)
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with this account")

    clinic = await db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    doctor_count = (await db.execute(
        select(func.count()).select_from(Doctor).where(
            Doctor.clinic_id == clinic_id, Doctor.is_active == True
        )
    )).scalar_one()

    return {
        "id":           str(clinic.id),
        "name":         clinic.name,
        "plan_type":    clinic.plan_type,
        "created_at":   clinic.created_at.isoformat() if clinic.created_at else None,
        "doctor_count": doctor_count,
    }


@router.patch("/me")
async def update_clinic(
    body: UpdateClinicRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Update clinic name. Admin only."""
    _require_admin(request)
    clinic_id = getattr(request.state, "clinic_id", None)
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with this account")

    name_stripped = body.name.strip()
    if len(name_stripped) < 2 or len(name_stripped) > 100:
        raise HTTPException(status_code=422, detail="Clinic name must be 2–100 characters.")

    clinic = await db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.name = name_stripped
    await db.commit()

    doctor_count = (await db.execute(
        select(func.count()).select_from(Doctor).where(
            Doctor.clinic_id == clinic_id, Doctor.is_active == True
        )
    )).scalar_one()

    return {
        "id":           str(clinic.id),
        "name":         clinic.name,
        "plan_type":    clinic.plan_type,
        "created_at":   clinic.created_at.isoformat() if clinic.created_at else None,
        "doctor_count": doctor_count,
    }


@router.get("/me/doctors")
async def list_clinic_doctors(request: Request, db: AsyncSession = Depends(get_db)):
    """List all doctors in the clinic. Admin only."""
    _require_admin(request)
    clinic_id = getattr(request.state, "clinic_id", None)
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with this account")

    result = await db.execute(
        select(Doctor)
        .where(Doctor.clinic_id == clinic_id)
        .order_by(Doctor.created_at.asc())
    )
    doctors = result.scalars().all()

    return [
        {
            "id":         str(d.id),
            "name":       d.name,
            "specialty":  d.specialty,
            "email":      d.email,
            "role":       d.role,
            "is_active":  d.is_active,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in doctors
    ]


@router.post("/me/invites")
async def generate_invite(
    body: GenerateInviteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generate a single-use invite code. Admin only."""
    _require_admin(request)
    clinic_id = getattr(request.state, "clinic_id", None)
    doctor_id = getattr(request.state, "doctor_id", None)
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with this account")

    # Generate a unique code (retry on collision — vanishingly rare)
    for _ in range(5):
        code = _gen_invite_code()
        collision = (await db.execute(
            select(ClinicInvite).where(ClinicInvite.invite_code == code)
        )).scalar_one_or_none()
        if not collision:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique invite code")

    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)
    invite = ClinicInvite(
        clinic_id=clinic_id,
        invite_code=code,
        created_by=doctor_id,
        email_hint=body.email_hint,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()

    invite_url = f"{settings.frontend_url}/join?code={code}"
    return {
        "invite_code": code,
        "invite_url":  invite_url,
        "expires_at":  expires_at.isoformat(),
    }


@router.delete("/me/doctors/{target_doctor_id}")
async def deactivate_doctor(
    target_doctor_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Soft-deactivate a doctor. Admin only. Cannot deactivate yourself."""
    _require_admin(request)
    clinic_id = getattr(request.state, "clinic_id", None)
    my_doctor_id = getattr(request.state, "doctor_id", None)

    if target_doctor_id == my_doctor_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    doctor = await db.get(Doctor, target_doctor_id)
    if not doctor or doctor.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Doctor not found in your clinic")

    doctor.is_active = False
    await db.commit()
    return {"id": str(target_doctor_id), "is_active": False}


@router.post("/me/setup-link/{target_doctor_id}")
async def generate_setup_link(
    target_doctor_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generate a one-time password setup link for a doctor with no password. Admin only."""
    _require_admin(request)
    clinic_id = getattr(request.state, "clinic_id", None)

    doctor = await db.get(Doctor, target_doctor_id)
    if not doctor or doctor.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Doctor not found in your clinic")
    if doctor.hashed_password:
        raise HTTPException(status_code=400, detail="Doctor already has a password set")

    from datetime import timedelta, timezone
    from jose import jwt
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    setup_token = jwt.encode(
        {"doctor_id": str(doctor.id), "purpose": "setup", "exp": exp},
        settings.secret_key,
        algorithm="HS256",
    )
    setup_url = f"{settings.frontend_url}/setup-password?token={setup_token}"
    return {"setup_url": setup_url, "expires_in": 3600}
