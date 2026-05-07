# Import all models so SQLAlchemy registers them with Base.metadata
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.note import ClinicalNote, NoteAuditLog

__all__ = ["Doctor", "Patient", "Session", "Transcript", "ClinicalNote", "NoteAuditLog"]
