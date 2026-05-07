from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

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


# ── Endpoints (stubs returning mock data) ─────────────────────────────────────

@router.post("/", response_model=SessionResponse)
async def create_session(body: CreateSessionRequest):
    return SessionResponse(
        id=uuid4(),
        doctor_id=body.doctor_id,
        status="idle",
        patient_name=body.patient_name,
        created_at=datetime.utcnow(),
    )


@router.get("/", response_model=list[SessionResponse])
async def list_sessions():
    # TODO: replace with real DB query
    return [
        SessionResponse(
            id=UUID("aaaaaaaa-0000-0000-0000-000000000001"),
            doctor_id=UUID("00000000-0000-0000-0000-000000000001"),
            status="recording",
            patient_name="Ramesh Gupta",
            created_at=datetime.utcnow(),
        ),
        SessionResponse(
            id=UUID("aaaaaaaa-0000-0000-0000-000000000002"),
            doctor_id=UUID("00000000-0000-0000-0000-000000000002"),
            status="completed",
            patient_name="Sunita Devi",
            created_at=datetime.utcnow(),
        ),
        SessionResponse(
            id=UUID("aaaaaaaa-0000-0000-0000-000000000003"),
            doctor_id=UUID("00000000-0000-0000-0000-000000000003"),
            status="idle",
            patient_name="Arjun Mehta",
            created_at=datetime.utcnow(),
        ),
    ]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: UUID):
    return SessionResponse(
        id=session_id,
        doctor_id=UUID("00000000-0000-0000-0000-000000000001"),
        status="recording",
        patient_name="Test Patient",
        created_at=datetime.utcnow(),
    )


@router.patch("/{session_id}/end")
async def end_session(session_id: UUID):
    return {"session_id": str(session_id), "status": "completed"}
