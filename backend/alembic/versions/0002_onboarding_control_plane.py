"""onboarding CMS -> control-plane: control.onboarding_videos

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-31

Milestone 3 phase 2. The onboarding video catalogue moves from a
per-tenant `onboarding_videos` table to a single shared catalogue owned
by SafeIQ Internal (control.internal_users curate it, every tenant reads
it). `onboarding_events` stays per-tenant and is *not* on this Alembic
chain - tenant schemas are provisioned by metadata.create_all; existing
ones are reconciled by scripts/migrate_tenant_onboarding.py.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The videoaudience enum is created implicitly by create_table below
    # (the Enum column carries create_type=True by default).
    op.create_table(
        "onboarding_videos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(2000), nullable=False),
        sa.Column("thumbnail_gradient", sa.String(80), nullable=False),
        sa.Column("media_url", sa.String(500), nullable=True),
        sa.Column("media_key", sa.String(500), nullable=True),
        sa.Column(
            "audience",
            sa.Enum("organisation", "employee", "all", name="videoaudience", schema="control"),
            nullable=False,
            server_default="all",
        ),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("control.internal_users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="control",
    )
    op.create_index(
        "ix_control_onboarding_videos_order", "onboarding_videos", ["order_index"], schema="control"
    )


def downgrade() -> None:
    op.drop_index("ix_control_onboarding_videos_order", table_name="onboarding_videos", schema="control")
    op.drop_table("onboarding_videos", schema="control")
    sa.Enum(name="videoaudience", schema="control").drop(op.get_bind(), checkfirst=True)
