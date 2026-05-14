# backend/app/routers/auth.py

import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Doctor

_bearer = HTTPBearer(auto_error=False)

router = APIRouter()

_ALGORITHM = "HS256"
_TOKEN_TTL_HOURS = 24
_PWD_RE = re.compile(r'^(?=.*[a-zA-Z])(?=.*\d).{8,}$')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Token helpers ──────────────────────────────────────────────────────────────

def _make_doctor_token(doctor: Doctor) -> str:
    if not settings.secret_key:
        raise RuntimeError(
            "SECRET_KEY is not configured. "
            "Run: flyctl secrets set SECRET_KEY=$(openssl rand -hex 32) --app mediscribe-api"
        )
    exp = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)
    payload = {
        "sub":       str(doctor.id),
        "doctor_id": str(doctor.id),
        "clinic_id": str(doctor.clinic_id) if doctor.clinic_id else None,
        "role":      doctor.role or "doctor",
        "exp":       exp,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def _make_pin_token() -> str:
    """Legacy PIN-mode token — doctor_id and clinic_id are null (no scoping)."""
    if not settings.secret_key:
        raise RuntimeError("SECRET_KEY is not configured.")
    exp = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)
    payload = {
        "sub":       "pin_user",
        "doctor_id": None,
        "clinic_id": None,
        "role":      None,
        "exp":       exp,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns the payload dict or None on any failure."""
    if not settings.secret_key:
        return None
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
    except JWTError:
        return None


def verify_token(token: str) -> bool:
    """Backwards-compat helper used by WebSocket auth."""
    return decode_token(token) is not None


def _validate_password(password: str) -> None:
    if not _PWD_RE.match(password):
        raise HTTPException(
            status_code=422,
            detail="Password must be at least 8 characters and contain at least one letter and one number.",
        )


# ── Schemas ────────────────────────────────────────────────────────────────────

class PinRequest(BaseModel):
    pin: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    invite_code: str
    name: str
    specialty: str
    email: str
    password: str
    confirm_password: str


class SetupPasswordRequest(BaseModel):
    setup_token: str
    new_password: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/verify-pin")
async def verify_pin(body: PinRequest):
    """Legacy PIN gate — kept for backwards compat with existing demo deployment."""
    if settings.access_pin and body.pin != settings.access_pin:
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    return {"token": _make_pin_token(), "expires_in": _TOKEN_TTL_HOURS * 3600}


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()
    result = await db.execute(
        select(Doctor).where(func.lower(Doctor.email) == email)
    )
    doctor = result.scalar_one_or_none()

    # Same error message for wrong email and wrong password — prevent enumeration
    _BAD_CREDS = "Invalid credentials"

    if not doctor:
        raise HTTPException(status_code=401, detail=_BAD_CREDS)
    if not doctor.hashed_password:
        raise HTTPException(status_code=401, detail="Account not set up — contact your clinic admin")
    if not doctor.is_active:
        raise HTTPException(status_code=403, detail="Account disabled — contact your clinic admin")
    if not pwd_context.verify(body.password, doctor.hashed_password):
        raise HTTPException(status_code=401, detail=_BAD_CREDS)

    return {"token": _make_doctor_token(doctor), "expires_in": _TOKEN_TTL_HOURS * 3600}


@router.get("/me")
async def get_me(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """Bootstrap endpoint — frontend calls on load to hydrate doctor identity."""
    token_str = credentials.credentials if credentials else None
    if not token_str:
        raise HTTPException(status_code=401, detail="Not authenticated")

    claims = decode_token(token_str)
    if not claims or not claims.get("doctor_id"):
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        doctor_id = UUID(claims["doctor_id"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Not authenticated")

    doctor = await db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doctor.is_active:
        raise HTTPException(status_code=403, detail="Account disabled — contact your clinic admin")

    clinic_name = None
    if doctor.clinic_id:
        from app.models.clinic import Clinic
        clinic = await db.get(Clinic, doctor.clinic_id)
        clinic_name = clinic.name if clinic else None

    return {
        "id":          str(doctor.id),
        "name":        doctor.name,
        "specialty":   doctor.specialty,
        "email":       doctor.email,
        "role":        doctor.role,
        "clinic_id":   str(doctor.clinic_id) if doctor.clinic_id else None,
        "clinic_name": clinic_name,
    }


@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Invite-code-based registration for joining an existing clinic."""
    from datetime import timezone as tz
    from app.models.clinic import ClinicInvite

    if body.password != body.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")
    _validate_password(body.password)

    invite = (await db.execute(
        select(ClinicInvite).where(ClinicInvite.invite_code == body.invite_code.upper())
    )).scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=410, detail="This invite link is invalid or has expired. Ask your admin for a new one.")
    if invite.used:
        raise HTTPException(status_code=410, detail="This invite link has already been used. Ask your admin for a new one.")
    if invite.expires_at < datetime.now(tz.utc):
        raise HTTPException(status_code=410, detail="This invite link has expired. Ask your admin for a new one.")

    email = body.email.lower().strip()
    existing = (await db.execute(
        select(Doctor).where(func.lower(Doctor.email) == email)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    doctor = Doctor(
        name=body.name,
        specialty=body.specialty,
        email=email,
        hashed_password=pwd_context.hash(body.password),
        clinic_id=invite.clinic_id,
        role="doctor",
        is_active=True,
    )
    db.add(doctor)
    await db.flush()

    invite.used = True
    invite.used_by = doctor.id
    await db.commit()
    await db.refresh(doctor)

    return {"token": _make_doctor_token(doctor), "expires_in": _TOKEN_TTL_HOURS * 3600}


@router.post("/setup-password")
async def setup_password(body: SetupPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Allow a doctor with null hashed_password to set their password via a setup token."""
    _validate_password(body.new_password)

    claims = decode_token(body.setup_token)
    if not claims or claims.get("purpose") != "setup":
        raise HTTPException(status_code=401, detail="Invalid or expired setup link")

    doctor_id = claims.get("doctor_id")
    if not doctor_id:
        raise HTTPException(status_code=401, detail="Invalid setup token")

    doctor = await db.get(Doctor, UUID(doctor_id))
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor.hashed_password = pwd_context.hash(body.new_password)
    await db.commit()
    return {"token": _make_doctor_token(doctor), "expires_in": _TOKEN_TTL_HOURS * 3600}
