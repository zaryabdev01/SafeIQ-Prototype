"""onboarding videos: optional category

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-01

Milestone 3 follow-up: a free-text category on control.onboarding_videos
so the org/employee onboarding page can offer a "Categories" filter
alongside the audience one. Nullable - existing rows stay uncategorised.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("onboarding_videos", sa.Column("category", sa.String(80), nullable=True), schema="control")


def downgrade() -> None:
    op.drop_column("onboarding_videos", "category", schema="control")
