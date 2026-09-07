"""Milestone 4 (Team Management), tasks 32/34 - RAG assignment access codes.

Human-usable and unambiguous: drawn from an alphabet with no 0/O/1/I, grouped
4-4 (e.g. "7QF3-K9RM"). Deliberately not yet an authentication factor - see
backend/README.md "Known simplifications" and RagAssignment's docstring in
app/models/tenant.py.
"""

from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import RagAssignment

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_MAX_ATTEMPTS = 5


def generate_access_code() -> str:
    chars = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"{chars[:4]}-{chars[4:]}"


async def generate_unique_access_code(db: AsyncSession) -> str:
    """Regenerates on collision (spec §4.2) - vanishingly unlikely given the
    32^8 keyspace, but cheap to check for since this only ever runs once per
    assignment create/rotate, not on a hot path."""
    for _ in range(_MAX_ATTEMPTS):
        code = generate_access_code()
        existing = await db.execute(select(RagAssignment.id).where(RagAssignment.access_code == code))
        if existing.scalar_one_or_none() is None:
            return code
    raise RuntimeError(f"Could not generate a unique access code after {_MAX_ATTEMPTS} attempts")
