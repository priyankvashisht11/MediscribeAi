from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel

from app.config import settings

router = APIRouter()

_ALGORITHM = "HS256"
_TOKEN_TTL_HOURS = 24


def _make_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)
    payload = {
        "sub": "pin_user",   # Sprint 9 will set this to actual doctor UUID
        "doctor_id": None,   # Sprint 9 will populate from login
        "exp": exp,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def verify_token(token: str) -> bool:
    try:
        jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
        return True
    except Exception:
        return False


class PinRequest(BaseModel):
    pin: str


@router.post("/verify-pin")
async def verify_pin(body: PinRequest):
    # Gate disabled when access_pin is empty
    if settings.access_pin and body.pin != settings.access_pin:
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    return {"token": _make_token(), "expires_in": _TOKEN_TTL_HOURS * 3600}
