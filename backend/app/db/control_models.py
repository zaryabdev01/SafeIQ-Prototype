"""Control-plane tables: shared, cross-tenant by nature.

Mirrors docs/architecture/multi-tenant-schema.md's control-plane schema,
plus two lookup indexes (`user_directory`, `invite_index`) that exist
purely so an unauthenticated request carrying an email or an invite token
can be routed to the right tenant schema, without any tenant table ever
being queried across schemas.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import ControlBase, utcnow


class Organisation(ControlBase):
    __tablename__ = "organisations"
    __table_args__ = {"schema": "control"}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    sector: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tenant_schema: Mapped[str] = mapped_column(String(63), unique=True)
    kyc_verified_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class InternalUser(ControlBase):
    """SafeIQ's own cross-tenant support account holders - out of scope
    for Milestone 2's auth flows, modelled here for schema completeness
    only (matches multi-tenant-schema.md)."""

    __tablename__ = "internal_users"
    __table_args__ = {"schema": "control"}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    two_factor_enabled: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class VideoAudience(enum.StrEnum):
    """Matches the frontend's VideoAudience union (frontend/src/lib/types.ts)."""

    organisation = "organisation"
    employee = "employee"
    all = "all"


class OnboardingVideo(ControlBase):
    """Milestone 3 (Onboarding CMS), tasks 21-22. One shared catalogue,
    curated by SafeIQ Internal support staff (`created_by` -> internal_users)
    and read by every tenant - hence control-plane, not per-tenant.

    `media_url` is a directly playable URL: either an external link (Vimeo
    etc.) set by the operator, or - once MEDIA_STORAGE_BACKEND=s3 - a URL
    derived from `media_key`, the object key of a file uploaded through the
    presigned-upload flow. `media_key` is null for external links."""

    __tablename__ = "onboarding_videos"
    __table_args__ = {"schema": "control"}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(2000))
    thumbnail_gradient: Mapped[str] = mapped_column(String(80))
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    audience: Mapped[VideoAudience] = mapped_column(
        SAEnum(VideoAudience, name="videoaudience", schema="control"), default=VideoAudience.all
    )
    order_index: Mapped[int] = mapped_column(default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("control.internal_users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class UserDirectoryEntry(ControlBase):
    """email -> (org, user) index so an unauthenticated login request can
    be told which organisation(s) an email belongs to, without a
    cross-schema query - see GET /auth/organisations."""

    __tablename__ = "user_directory"
    __table_args__ = (UniqueConstraint("email", "org_id", name="uq_user_directory_email_org"), {"schema": "control"})

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), index=True)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("control.organisations.id"))
    user_id: Mapped[uuid.UUID]  # lives in the tenant schema - not an FK, different schema
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class InviteIndexEntry(ControlBase):
    """invite token -> org index, so an unauthenticated invite-accept
    request can be routed to the right tenant schema before we know
    anything else about the invitee."""

    __tablename__ = "invite_index"
    __table_args__ = {"schema": "control"}

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("control.organisations.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
