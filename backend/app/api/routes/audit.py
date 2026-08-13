from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_tenant_db, require_role
from app.models.tenant import AuditLedgerEntry, TeamRole
from app.schemas.audit import AuditChainVerification, AuditEntryResponse
from app.services.audit import verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])

_AUDIT_READERS = (TeamRole.super_admin, TeamRole.administrator)


@router.get("", response_model=list[AuditEntryResponse])
async def list_audit_entries(
    current_user: CurrentUser = Depends(require_role(*_AUDIT_READERS)),
    db: AsyncSession = Depends(get_tenant_db),
    limit: int = 100,
) -> list[AuditLedgerEntry]:
    result = await db.execute(select(AuditLedgerEntry).order_by(AuditLedgerEntry.id.desc()).limit(limit))
    return list(result.scalars().all())


@router.get("/verify", response_model=AuditChainVerification)
async def verify_audit_chain(
    current_user: CurrentUser = Depends(require_role(*_AUDIT_READERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AuditChainVerification:
    """Recomputes the hash chain for this organisation's whole ledger and
    confirms nothing has been altered - a concrete, demoable proof point
    for ADR-005's tamper-evidence claim, not just a design document."""
    result = await db.execute(select(AuditLedgerEntry).order_by(AuditLedgerEntry.id.asc()))
    entries = list(result.scalars().all())
    return AuditChainVerification(valid=verify_chain(entries), entries_checked=len(entries))
