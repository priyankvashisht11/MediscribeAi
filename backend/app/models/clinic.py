import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    plan_type: Mapped[str] = mapped_column(String(20), default="solo")  # solo | clinic
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    doctors: Mapped[list["Doctor"]] = relationship("Doctor", back_populates="clinic")


class ClinicInvite(Base):
    __tablename__ = "clinic_invites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), nullable=False)
    invite_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), nullable=False)
    email_hint: Mapped[str] = mapped_column(String(255), nullable=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
