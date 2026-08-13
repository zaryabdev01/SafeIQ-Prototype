"""Tamper-evident, hash-chained audit ledger (ADR-005).

Only a hash of `content` is ever stored - never the content itself - so a
later GDPR-erasure request never has to touch this table (see
security-compliance-design.md #3): the ledger entry keeps proving *that*
an event happened without holding the personal data that made it
sensitive.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import AuditLedgerEntry

GENESIS_HASH = "0" * 64


def _hash(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _entry_hash(prev_hash: str, event_type: str, subject_id: uuid.UUID | str, content_hash: str, created_at: datetime) -> str:
    return _hash("|".join([prev_hash, event_type, str(subject_id), content_hash, created_at.isoformat()]))


async def record_event(
    db: AsyncSession,
    *,
    event_type: str,
    subject_id: uuid.UUID,
    owner_id: uuid.UUID | None = None,
    content: dict | str | None = None,
) -> AuditLedgerEntry:
    content_hash = _hash(json.dumps(content, sort_keys=True, default=str) if content is not None else "")

    result = await db.execute(select(AuditLedgerEntry.entry_hash).order_by(AuditLedgerEntry.id.desc()).limit(1))
    prev_hash = result.scalar_one_or_none() or GENESIS_HASH

    created_at = datetime.now(UTC)
    entry = AuditLedgerEntry(
        event_type=event_type,
        subject_id=subject_id,
        owner_id=owner_id,
        content_hash=content_hash,
        prev_hash=prev_hash,
        entry_hash=_entry_hash(prev_hash, event_type, subject_id, content_hash, created_at),
        created_at=created_at,
    )
    db.add(entry)
    await db.flush()
    return entry


def verify_chain(entries: list[AuditLedgerEntry]) -> bool:
    """Recomputes the hash chain over an ordered (oldest-first) list of
    entries and confirms none has been altered or removed - the actual
    tamper-evidence check, not just a label on the table."""
    prev_hash = GENESIS_HASH
    for entry in entries:
        expected = _entry_hash(prev_hash, entry.event_type, entry.subject_id, entry.content_hash, entry.created_at)
        if expected != entry.entry_hash:
            return False
        prev_hash = entry.entry_hash
    return True
