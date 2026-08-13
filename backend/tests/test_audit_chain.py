"""Pure hash-chain math - no database involved. Builds AuditLedgerEntry
instances in memory (never persisted) to exercise the same
`record_event`/`verify_chain` logic the API uses, so this stays a fast,
always-runnable check of ADR-005's actual tamper-evidence property."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.models.tenant import AuditLedgerEntry
from app.services.audit import GENESIS_HASH, _entry_hash, _hash, verify_chain


def _make_chain(n: int) -> list[AuditLedgerEntry]:
    entries: list[AuditLedgerEntry] = []
    prev_hash = GENESIS_HASH
    for i in range(n):
        subject_id = uuid.uuid4()
        content_hash = _hash(f"content-{i}")
        created_at = datetime(2026, 1, 1, tzinfo=UTC)
        entry_hash = _entry_hash(prev_hash, "test.event", subject_id, content_hash, created_at)
        entries.append(
            AuditLedgerEntry(
                id=i + 1,
                event_type="test.event",
                subject_id=subject_id,
                content_hash=content_hash,
                prev_hash=prev_hash,
                entry_hash=entry_hash,
                created_at=created_at,
            )
        )
        prev_hash = entry_hash
    return entries


def test_valid_chain_verifies() -> None:
    assert verify_chain(_make_chain(5)) is True


def test_empty_chain_is_valid() -> None:
    assert verify_chain([]) is True


def test_tampered_content_breaks_verification() -> None:
    entries = _make_chain(5)
    entries[2].content_hash = _hash("tampered")
    assert verify_chain(entries) is False


def test_reordered_chain_breaks_verification() -> None:
    entries = _make_chain(5)
    entries[1], entries[2] = entries[2], entries[1]
    assert verify_chain(entries) is False


def test_deleted_entry_breaks_verification() -> None:
    entries = _make_chain(5)
    del entries[2]
    assert verify_chain(entries) is False
