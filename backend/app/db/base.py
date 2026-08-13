from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase


def utcnow() -> datetime:
    return datetime.now(UTC)


# Every `Mapped[datetime]` column across the app uses tz-aware Python datetimes
# (see utcnow() above) - mapping datetime -> DateTime(timezone=True) here once
# means every model gets a matching, tz-aware Postgres column automatically,
# instead of relying on each column to remember `DateTime(timezone=True)`
# individually (a naive/aware mismatch made asyncpg reject inserts outright).
_TIMEZONE_AWARE_TYPE_MAP = {datetime: DateTime(timezone=True)}


class ControlBase(DeclarativeBase):
    """Shared, cross-tenant tables: the organisation registry and the
    lookup indexes that let an unauthenticated request (login, invite
    accept) find which tenant schema to talk to. See
    docs/architecture/multi-tenant-schema.md 'Control-plane schema'."""

    type_annotation_map = _TIMEZONE_AWARE_TYPE_MAP


class TenantBase(DeclarativeBase):
    """Tables declared once against a placeholder 'tenant' schema and
    translated to the real tenant_<org_id> schema per request via
    SQLAlchemy's schema_translate_map (see app/db/session.py). This is
    what makes cross-tenant access structurally impossible rather than a
    query-discipline convention - see ADR-003."""

    type_annotation_map = _TIMEZONE_AWARE_TYPE_MAP
