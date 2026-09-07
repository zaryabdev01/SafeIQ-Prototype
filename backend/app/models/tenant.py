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
from datetime import date, datetime

from sqlalchemy import JSON, Date, ForeignKey, Index, String, text
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


class RagStatus(enum.StrEnum):
    """Milestone 4 (Team Management), tasks 32/34 - a thin identity/lifecycle
    stub. Milestone 5 (AI Knowledge Base) *extends* this table (ingestion,
    retrieval config, vector-namespace ref, ...); it must not rename `rags`,
    drop `id`/`name`/`status`, or change these values without a coordinated
    migration, since RagAssignment/Alert/Action/RagActivityEvent all FK
    `Rag.id`. See .claude/specs/m4-team-management.md §4.1."""

    draft = "draft"
    published = "published"
    archived = "archived"


class Rag(TenantBase):
    __tablename__ = "rags"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[RagStatus] = mapped_column(default=RagStatus.draft)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class RagAssignment(TenantBase):
    """Milestone 4, tasks 32/34. `access_code` is issued/rotated/revoked here
    but is deliberately not yet an authentication factor - Milestone 6 (chat
    agent) is what will eventually consume it to switch RAG context; see
    backend/README.md "Known simplifications".

    The partial unique index is the DB-level backstop for "at most one active
    assignment per (rag, user)"; the route handler's own check-then-409 is
    what gives a clean error in the (overwhelmingly common) non-race case."""

    __tablename__ = "rag_assignments"
    __table_args__ = (
        Index(
            "ux_rag_assignments_active_rag_user",
            "rag_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        _TENANT_SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    rag_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.rags.id", ondelete="RESTRICT"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id", ondelete="CASCADE"))
    access_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | revoked
    alert_owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.users.id"), nullable=True)
    assigned_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    assigned_at: Mapped[datetime] = mapped_column(default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)


class AlertOutcome(enum.StrEnum):
    resolved = "resolved"
    escalated = "escalated"
    no_action = "no_action"


class AlertStage(enum.StrEnum):
    """Milestone 4, task 108 - the client's 6-stage lifecycle (matches
    frontend/src/lib/types.ts::AlertStage). Order is significant:
    ALERT_STAGE_ORDER below is what forward-only transition validation
    indexes into - a plain tuple, not enum arithmetic, since StrEnum members
    don't support ordering comparisons and mypy wouldn't catch a mistake
    there (see .claude/specs/m4-team-management.md §7)."""

    keyword_detected = "keyword_detected"
    signal_generated = "signal_generated"
    context_assessment = "context_assessment"
    alert_level_set = "alert_level_set"
    human_review = "human_review"
    outcome = "outcome"


ALERT_STAGE_ORDER: tuple[AlertStage, ...] = (
    AlertStage.keyword_detected,
    AlertStage.signal_generated,
    AlertStage.context_assessment,
    AlertStage.alert_level_set,
    AlertStage.human_review,
    AlertStage.outcome,
)


class Alert(TenantBase):
    """Milestone 4, task 108 - the alert *occurrence*, distinct from
    PersonAlertRule (config, already real above) and from the mock
    `AlertCase` (chat-thread type in frontend/src/lib/types.ts - not built
    here). No RAG engine generates these yet: this milestone provides manual
    create + stage transitions so the Phase 4 profile dashboard has real
    data to show; Milestone 5 wires automatic creation from keyword
    detection into the same table."""

    __tablename__ = "alerts"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    subject_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id", ondelete="CASCADE"))
    rag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.rags.id", ondelete="SET NULL"), nullable=True)
    keyword: Mapped[str | None] = mapped_column(String(200), nullable=True)
    stage: Mapped[AlertStage] = mapped_column(default=AlertStage.keyword_detected)
    severity: Mapped[AlertSeverity] = mapped_column(default=AlertSeverity.medium)
    context: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(8), default="open")  # open | closed
    outcome: Mapped[AlertOutcome | None] = mapped_column(nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    closed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.users.id"), nullable=True)


class AlertStageTransition(TenantBase):
    __tablename__ = "alert_stage_transitions"
    __table_args__ = (Index("ix_alert_stage_transitions_alert_created", "alert_id", "created_at"), _TENANT_SCHEMA)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.alerts.id", ondelete="CASCADE"))
    from_stage: Mapped[AlertStage | None] = mapped_column(nullable=True)  # null for the initial row
    to_stage: Mapped[AlertStage]
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class ActionTier(enum.StrEnum):
    """Milestone 4, task 108's 4-stage Actions pipeline (also the shared
    entity referenced by addendum 113 - Milestone 7's org/employee
    dashboards will consume it too)."""

    information_only = "information_only"
    recommended_action = "recommended_action"
    required_review = "required_review"
    urgent_action = "urgent_action"


class ActionPriority(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class ActionStatus(enum.StrEnum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"


class Action(TenantBase):
    __tablename__ = "actions"
    __table_args__ = _TENANT_SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    tier: Mapped[ActionTier] = mapped_column(default=ActionTier.recommended_action)
    priority: Mapped[ActionPriority] = mapped_column(default=ActionPriority.medium)
    status: Mapped[ActionStatus] = mapped_column(default=ActionStatus.open)
    assignee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    subject_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.users.id"), nullable=True)
    rag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.rags.id", ondelete="SET NULL"), nullable=True)
    alert_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant.alerts.id", ondelete="SET NULL"), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenant.users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
