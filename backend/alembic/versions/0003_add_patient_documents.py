"""add_patient_documents

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-19

Create patient_documents table for document upload feature.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "patient_documents",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("patient_id", sa.UUID(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("clinic_id", sa.UUID(), sa.ForeignKey("clinics.id"), nullable=True),
        sa.Column("uploaded_by", sa.UUID(), sa.ForeignKey("doctors.id"), nullable=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("doc_type", sa.String(50), nullable=False, server_default="other"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("file_size", sa.Integer, nullable=True),
        sa.Column("file_data", sa.LargeBinary, nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_patient_documents_patient_id", "patient_documents", ["patient_id"])
    op.create_index("ix_patient_documents_uploaded_at", "patient_documents", ["uploaded_at"])


def downgrade() -> None:
    op.drop_index("ix_patient_documents_uploaded_at", "patient_documents")
    op.drop_index("ix_patient_documents_patient_id", "patient_documents")
    op.drop_table("patient_documents")
