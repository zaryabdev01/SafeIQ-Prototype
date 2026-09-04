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
    # Milestone 4 (Team Management), task 106 - "active"|"archived". Archival is an
    # org-management/reporting state, not a security lock: an archived user's
    # existing tokens keep working. A real deactivation (session revocation / login
    # block) is separate, future work.
    status: Mapped[str] = mapped_column(String(20), default="active")
    # Milestone 4, task 96 - gates raw conversation-content visibility alongside
    # _ROLE_ADMINS. Mirrors frontend/src/lib/permissions.ts::canViewConversationContent.
    is_safeguarding_lead: Mapped[bool] = mapped_column(default=False)
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


class OnboardingEventType(enum.StrEnum):
    view = "view"
    share = "share"
    search = "search"


class OnboardingEvent(TenantBase):
    """Analytics foundation for task 27 - every view/share/search a tenant's
    users perform against the (now SafeIQ-Internal-owned) onboarding CMS.
    Deliberately kept per-tenant: an org admin sees only their own org's
    engagement via GET /onboarding/analytics. The video catalogue itself
    lives in `control.onboarding_videos` (see app/db/control_models.py), so
    `video_id` references a control-plane id - cross-schema, hence no FK,
    same pattern as control's directory indexes."""

    __tablename__ = "onboarding_events"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    event_type: Mapped[OnboardingEventType]
    video_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.users.id"), nullable=True)
    query: Mapped[str | None] = mapped_column(String(500), nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class AlertSeverity(enum.StrEnum):
    """Matches the frontend's existing AlertSeverity union
    (frontend/src/lib/types.ts) - used by custom per-person alert rules
    here, and later by keyword-triggered alert cases once the RAG engine
    (Milestone 5) exists."""

    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TeamNote(TenantBase):
    """Milestone 4 (Team Management), task 31 - a free-text observation
    logged against a team member by a manager/support/admin, e.g. for
    safeguarding case context. Append-only by design (no update/delete
    endpoint) - a note is a timestamped record, not a mutable field."""

    __tablename__ = "team_notes"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    subject_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id", ondelete="CASCADE"))
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    text: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class PersonAlertRule(TenantBase):
    """Milestone 4, task 31 - a custom alert rule scoped to one team
    member (e.g. "notify on missed check-in"), distinct from the
    keyword-triggered RAG alert cases that come with the RAG engine
    (Milestone 5) - this is configuration, not an alert occurrence."""

    __tablename__ = "person_alert_rules"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    subject_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(200))
    severity: Mapped[AlertSeverity] = mapped_column(default=AlertSeverity.medium)
    notify_email: Mapped[str] = mapped_column(String(320))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class LoginEvent(TenantBase):
    """Real login history for Settings 'Account login history' (client
    feedback, 17/08/2026). Deliberately separate from the audit ledger:
    ADR-005 only ever stores a content hash there, never real PII, so it
    structurally cannot answer "what IP did this user log in from" - this
    table holds that detail, written alongside (not instead of) the
    existing `user.logged_in` audit entry in the login route."""

    __tablename__ = "login_events"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id", ondelete="CASCADE"))
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
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
