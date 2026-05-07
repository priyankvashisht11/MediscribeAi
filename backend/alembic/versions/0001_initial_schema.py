"""initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-05-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # doctors
    op.create_table(
        "doctors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("specialty", sa.String(100), nullable=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("language_preference", sa.String(20), server_default="hinglish"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # patients
    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("abha_id", sa.String(50), unique=True, nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("age", sa.Integer, nullable=True),
        sa.Column("gender", sa.String(10), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # sessions
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "doctor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("doctors.id"),
            nullable=False,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), server_default="idle"),
        sa.Column("patient_consent_given", sa.Boolean, server_default="false"),
        sa.Column("consent_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_sessions_doctor_id", "sessions", ["doctor_id"])
    op.create_index("ix_sessions_patient_id", "sessions", ["patient_id"])

    # transcripts
    op.create_table(
        "transcripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id"),
            nullable=False,
        ),
        sa.Column("speaker", sa.String(10), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("start_time_ms", sa.Integer, nullable=True),
        sa.Column("end_time_ms", sa.Integer, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_transcripts_session_id", "transcripts", ["session_id"])

    # clinical_notes
    op.create_table(
        "clinical_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("chief_complaint", sa.Text, nullable=True),
        sa.Column("history_of_present_illness", sa.Text, nullable=True),
        sa.Column("review_of_systems", sa.Text, nullable=True),
        sa.Column("past_medical_history", sa.Text, nullable=True),
        sa.Column("medications", sa.Text, nullable=True),
        sa.Column("allergies", sa.Text, nullable=True),
        sa.Column("physical_examination", sa.Text, nullable=True),
        sa.Column("assessment", sa.Text, nullable=True),
        sa.Column("plan", sa.Text, nullable=True),
        sa.Column("follow_up", sa.Text, nullable=True),
        sa.Column("icd_codes", postgresql.JSONB, nullable=True),
        sa.Column("extracted_entities", postgresql.JSONB, nullable=True),
        sa.Column("confidence_score", sa.Float, nullable=True),
        sa.Column("template_type", sa.String(50), server_default="soap"),
        sa.Column("is_finalized", sa.Boolean, server_default="false"),
        sa.Column("doctor_reviewed", sa.Boolean, server_default="false"),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("ix_clinical_notes_session_id", "clinical_notes", ["session_id"])

    # note_audit_log
    op.create_table(
        "note_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "note_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clinical_notes.id"),
            nullable=False,
        ),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("change_type", sa.String(20), nullable=False),
        sa.Column("snapshot", postgresql.JSONB, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_note_audit_log_note_id", "note_audit_log", ["note_id"])


def downgrade() -> None:
    op.drop_table("note_audit_log")
    op.drop_table("clinical_notes")
    op.drop_table("transcripts")
    op.drop_table("sessions")
    op.drop_table("patients")
    op.drop_table("doctors")
    op.execute("DROP EXTENSION IF EXISTS vector;")
