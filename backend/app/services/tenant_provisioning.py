"""Provisions a brand-new, fully isolated Postgres schema for an
organisation - the concrete implementation of ADR-003's schema-per-tenant
model and ADR-002's per-tenant namespace isolation principle applied at
the relational layer.

Simplification flagged honestly: this uses `metadata.create_all` against
the new schema rather than running a per-schema Alembic migration chain,
to keep Milestone 2 achievable. It creates every *current* tenant table
correctly for a *new* tenant. What it does not yet do is propagate a
*future* schema change to every *existing* tenant automatically - that
needs a real per-schema migration runner, flagged as follow-up work (see
backend/README.md "Known simplifications").
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import TenantBase
from app.db.control_models import Organisation
from app.db.session import engine
from app.models import tenant as tenant_models  # noqa: F401  (registers tables on TenantBase.metadata)

_SAFE_SCHEMA = re.compile(r"^[a-z][a-z0-9_]*$")


def schema_name_for(org_id: uuid.UUID) -> str:
    return f"tenant_{org_id.hex}"


async def provision_tenant_schema(schema_name: str) -> None:
    if not _SAFE_SCHEMA.match(schema_name):
        raise ValueError(f"Unsafe schema name: {schema_name!r}")

    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))

    tenant_engine = engine.execution_options(schema_translate_map={"tenant": schema_name})
    async with tenant_engine.begin() as conn:
        await conn.run_sync(TenantBase.metadata.create_all)

    # Insert-only enforcement on the audit ledger (ADR-005 / security-compliance-design.md #4).
    # Caveat: REVOKE has no effect on the table's *owner* role, which is whatever role ran this
    # migration - Postgres always lets an owner do anything. This blocks any other role from
    # tampering, but true enforcement against the app's own runtime connection needs a second,
    # deliberately-restricted DB role for normal request traffic (distinct from the
    # provisioning/migration role). That role split is flagged as follow-up hardening, not done
    # here, so don't present this REVOKE alone as a complete tamper-evidence guarantee yet.
    async with engine.begin() as conn:
        await conn.execute(text(f'REVOKE UPDATE, DELETE ON "{schema_name}".audit_ledger FROM PUBLIC'))


async def create_organisation(control_db: AsyncSession, *, name: str, sector: str | None) -> Organisation:
    org = Organisation(id=uuid.uuid4(), name=name, sector=sector, tenant_schema="")
    org.tenant_schema = schema_name_for(org.id)
    control_db.add(org)
    await control_db.flush()

    await provision_tenant_schema(org.tenant_schema)
    return org
