"""One-off maintenance script for Milestone 4 (Team Management).

New tenant schemas get every current table via `metadata.create_all`
(`provision_tenant_schema`) automatically. This script backfills the same
shape onto *existing* tenant schemas, phase by phase, as Milestone 4 model
changes land - `metadata.create_all` is idempotent (only creates tables that
are still missing), so re-running it costs nothing.

Phase 1 (this revision): adds `users.status` and `users.is_safeguarding_lead`
to every existing tenant. Later phases (Rag, RagAssignment, Alert, Action, ...)
are pure new tables, so they need no ALTER statement here - only the
`create_all` pass, which this script already runs.

    python -m scripts.backfill_m4            # apply
    python -m scripts.backfill_m4 --dry-run  # list target schemas only

Safe to run more than once. One failing tenant schema does not stop the
others - failures are collected and reported at the end.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select, text

from app.db.base import TenantBase
from app.db.control_models import Organisation
from app.db.session import ControlSessionLocal, engine
from app.models import tenant as tenant_models  # noqa: F401  (registers tables on TenantBase.metadata)

_PHASE_1_COLUMN_STATEMENTS = (
    "ALTER TABLE \"{schema}\".users ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active'",
    'ALTER TABLE "{schema}".users ADD COLUMN IF NOT EXISTS is_safeguarding_lead boolean NOT NULL DEFAULT false',
)


async def _backfill_schema(schema: str) -> None:
    tenant_engine = engine.execution_options(schema_translate_map={"tenant": schema})
    async with tenant_engine.begin() as conn:
        await conn.run_sync(TenantBase.metadata.create_all)  # no-op for tables that already exist

    async with engine.begin() as conn:
        for statement in _PHASE_1_COLUMN_STATEMENTS:
            await conn.execute(text(statement.format(schema=schema)))


async def _run(*, dry_run: bool) -> None:
    async with ControlSessionLocal() as session:
        schemas = list((await session.execute(select(Organisation.tenant_schema))).scalars().all())

    print(f"{len(schemas)} tenant schema(s) to backfill")
    failures: list[str] = []
    for schema in schemas:
        if dry_run:
            print(f"  [dry-run] {schema}")
            continue
        try:
            await _backfill_schema(schema)
            print(f"  backfilled {schema}")
        except Exception as exc:  # noqa: BLE001 - one bad schema must not abort the rest
            print(f"  FAILED {schema}: {exc.__class__.__name__}: {exc}")
            failures.append(schema)

    if failures:
        print(f"{len(failures)} schema(s) failed: {', '.join(failures)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="list target schemas without altering them")
    args = parser.parse_args()
    asyncio.run(_run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
