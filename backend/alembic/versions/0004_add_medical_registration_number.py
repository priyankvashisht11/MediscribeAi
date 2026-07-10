"""add_medical_registration_number

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-26

Add medical_registration_number column to doctors table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "doctors",
        sa.Column("medical_registration_number", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("doctors", "medical_registration_number")
