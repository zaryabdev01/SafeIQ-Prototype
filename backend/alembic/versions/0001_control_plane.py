"""control plane: organisations, internal users, directory indexes

Revision ID: 0001
Revises:
Create Date: 2026-08-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organisations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("sector", sa.String(200), nullable=True),
        sa.Column("tenant_schema", sa.String(63), nullable=False, unique=True),
        sa.Column("kyc_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="control",
    )
    op.create_table(
        "internal_users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="control",
    )
    op.create_table(
        "user_directory",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("org_id", sa.Uuid(), sa.ForeignKey("control.organisations.id"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", "org_id", name="uq_user_directory_email_org"),
        schema="control",
    )
    op.create_index("ix_control_user_directory_email", "user_directory", ["email"], schema="control")

    op.create_table(
        "invite_index",
        sa.Column("token", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.Uuid(), sa.ForeignKey("control.organisations.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="control",
    )


def downgrade() -> None:
    op.drop_table("invite_index", schema="control")
    op.drop_index("ix_control_user_directory_email", table_name="user_directory", schema="control")
    op.drop_table("user_directory", schema="control")
    op.drop_table("internal_users", schema="control")
    op.drop_table("organisations", schema="control")
