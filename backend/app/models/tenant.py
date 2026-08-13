"""Tenant-schema tables: everything specific to one organisation.

Declared against the placeholder schema="tenant" (translated per-request
to tenant_<org_id> - see app/db/session.py). Matches
docs/architecture/multi-tenant-schema.md's tenant schema template,
extended with the tables Milestone 2 specifically needs (OTP codes, KYC
records) that weren't yet in that earlier draft.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantBase, utcnow

_TENANT_SCHEMA = {"schema": "tenant"}


class TeamRole(enum.StrEnum):
    """Matches the role hierarchy confirmed in
    docs/architecture/security-compliance-design.md #4."""

    super_admin = "super_admin"
    administrator = "administrator"
    manager = "manager"
    support = "support"
    employee = "employee"


class User(TenantBase):
    __tablename__ = "users"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    team_role: Mapped[TeamRole] = mapped_column(default=TeamRole.employee)
    job_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email_verified: Mapped[bool] = mapped_column(default=False)
    kyc_status: Mapped[str] = mapped_column(String(20), default="not_started")
    two_factor_enabled: Mapped[bool] = mapped_column(default=False)
    ip_lock_enabled: Mapped[bool] = mapped_column(default=False)
    direct_sign_up: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class OtpCode(TenantBase):
    __tablename__ = "otp_codes"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id", ondelete="CASCADE"))
    code_hash: Mapped[str] = mapped_column(String(64))
    purpose: Mapped[str] = mapped_column(String(40), default="email_verification")
    expires_at: Mapped[datetime]
    attempts: Mapped[int] = mapped_column(default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class KycRecord(TenantBase):
    __tablename__ = "kyc_records"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(String(40))
    provider_session_id: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    raw_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Invite(TenantBase):
    __tablename__ = "invites"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    role: Mapped[TeamRole] = mapped_column(default=TeamRole.employee)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | accepted | cancelled
    invited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.users.id"), nullable=True)
    expires_at: Mapped[datetime]
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(nullable=True)


class VideoAudience(enum.StrEnum):
    """Matches the frontend's existing VideoAudience union
    (frontend/src/lib/types.ts) - the onboarding grid already filters on
    this today against mock data."""

    organisation = "organisation"
    employee = "employee"
    all = "all"


class OnboardingVideo(TenantBase):
    """Milestone 3 (Onboarding CMS), task 21. `media_url` is nullable free
    text rather than a real upload pipeline - S3 storage isn't provisioned
    yet (that's Milestone-3-of-the-discovery-plan's environments/IaC work,
    a different numbering to this milestone plan's Milestone 3 - see
    backend/README.md), so this mirrors how the prototype itself only
    ever captured a filename, not a real file."""

    __tablename__ = "onboarding_videos"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(2000))
    thumbnail_gradient: Mapped[str] = mapped_column(String(80))
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    audience: Mapped[VideoAudience] = mapped_column(default=VideoAudience.all)
    order_index: Mapped[int] = mapped_column(default=0)
    duration_seconds: Mapped[int] = mapped_column(default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class OnboardingEventType(enum.StrEnum):
    view = "view"
    share = "share"
    search = "search"


class OnboardingEvent(TenantBase):
    """Analytics foundation for task 27 - every view/share/search against
    the onboarding CMS, queryable per video or in aggregate via
    GET /onboarding/analytics."""

    __tablename__ = "onboarding_events"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    event_type: Mapped[OnboardingEventType]
    video_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.onboarding_videos.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.users.id"), nullable=True)
    query: Mapped[str | None] = mapped_column(String(500), nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class AuditLedgerEntry(TenantBase):
    """Append-only, hash-chained per ADR-005. `provision_tenant_schema`
    revokes UPDATE/DELETE on this table at the DB level - see
    app/services/tenant_provisioning.py for the caveat on what that
    does and doesn't cover yet."""

    __tablename__ = "audit_ledger"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(80))
    subject_id: Mapped[uuid.UUID]
    owner_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64))
    prev_hash: Mapped[str] = mapped_column(String(64))
    entry_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
