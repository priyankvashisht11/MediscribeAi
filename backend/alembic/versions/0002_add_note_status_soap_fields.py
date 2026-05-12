"""add_note_status_soap_fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-08

Add status, subjective, objective, missing_information, generated_by,
finalized_at columns to clinical_notes (Sprint 3).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clinical_notes", sa.Column("status", sa.String(20), server_default="ready", nullable=False))
    op.add_column("clinical_notes", sa.Column("subjective", sa.Text, nullable=True))
    op.add_column("clinical_notes", sa.Column("objective", sa.Text, nullable=True))
    op.add_column("clinical_notes", sa.Column("missing_information", postgresql.JSONB, nullable=True))
    op.add_column("clinical_notes", sa.Column("generated_by", sa.String(50), server_default="", nullable=True))
    op.add_column("clinical_notes", sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("clinical_notes", "finalized_at")
    op.drop_column("clinical_notes", "generated_by")
    op.drop_column("clinical_notes", "missing_information")
    op.drop_column("clinical_notes", "objective")
    op.drop_column("clinical_notes", "subjective")
    op.drop_column("clinical_notes", "status")
