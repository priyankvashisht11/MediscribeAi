import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), nullable=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), nullable=True)

    # idle | recording | processing | completed | error
    status: Mapped[str] = mapped_column(String(20), default="idle")

    patient_consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="sessions")
    patient: Mapped["Patient"] = relationship("Patient", back_populates="sessions")
    transcripts: Mapped[list["Transcript"]] = relationship(
        "Transcript", back_populates="session"
    )
    note: Mapped["ClinicalNote"] = relationship(
        "ClinicalNote", back_populates="session", uselist=False
    )
