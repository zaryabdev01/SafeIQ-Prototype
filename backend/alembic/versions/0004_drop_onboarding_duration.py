"""onboarding videos: drop duration_seconds

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-01

The onboarding videos never had a real duration (no probe on upload) and
the client asked for it not to be shown or set. Drop the column.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("onboarding_videos", "duration_seconds", schema="control")


def downgrade() -> None:
    op.add_column(
        "onboarding_videos",
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        schema="control",
    )
