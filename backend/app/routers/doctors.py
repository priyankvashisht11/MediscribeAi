from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class DoctorResponse(BaseModel):
    id: UUID
    name: str
    specialty: str
    email: str


MOCK_DOCTORS = [
    DoctorResponse(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        name="Dr. Ananya Sharma",
        specialty="General Physician",
        email="ananya@mediscribe.dev",
    ),
    DoctorResponse(
        id=UUID("00000000-0000-0000-0000-000000000002"),
        name="Dr. Rajesh Kumar",
        specialty="Pediatrics",
        email="rajesh@mediscribe.dev",
    ),
    DoctorResponse(
        id=UUID("00000000-0000-0000-0000-000000000003"),
        name="Dr. Priya Singh",
        specialty="Dermatology",
        email="priya@mediscribe.dev",
    ),
    DoctorResponse(
        id=UUID("00000000-0000-0000-0000-000000000004"),
        name="Dr. Amit Verma",
        specialty="Cardiology",
        email="amit@mediscribe.dev",
    ),
    DoctorResponse(
        id=UUID("00000000-0000-0000-0000-000000000005"),
        name="Dr. Sunita Rao",
        specialty="Gynecology",
        email="sunita@mediscribe.dev",
    ),
]


@router.get("/", response_model=list[DoctorResponse])
async def list_doctors():
    return MOCK_DOCTORS


@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: UUID):
    for d in MOCK_DOCTORS:
        if d.id == doctor_id:
            return d
    return MOCK_DOCTORS[0]
