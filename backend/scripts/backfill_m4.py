"""One-off maintenance script for Milestone 4 (Team Management).

New tenant schemas get every current table via `metadata.create_all`
(`provision_tenant_schema`) automatically. This script backfills the same
shape onto *existing* tenant schemas, phase by phase, as Milestone 4 model
changes land - `metadata.create_all` is idempotent (only creates tables that
are still missing), so re-running it costs nothing.

Phase 2 (this revision): adds the `rags` and `rag_assignments` tables to
every existing tenant - pure new tables, so a `create_all` pass is all that's
needed. (Phase 1, landing on a separate branch, adds `users.status` /
`users.is_safeguarding_lead` via an ALTER TABLE step here too - when both
phases are merged, this file gains that step back; see that phase's version
of this script.)

    python -m scripts.backfill_m4            # apply
    python -m scripts.backfill_m4 --dry-run  # list target schemas only

Safe to run more than once. One failing tenant schema does not stop the
others - failures are collected and reported at the end.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.db.base import TenantBase
from app.db.control_models import Organisation
from app.db.session import ControlSessionLocal, engine
from app.models import tenant as tenant_models  # noqa: F401  (registers tables on TenantBase.metadata)


async def _backfill_schema(schema: str) -> None:
    tenant_engine = engine.execution_options(schema_translate_map={"tenant": schema})
    async with tenant_engine.begin() as conn:
        await conn.run_sync(TenantBase.metadata.create_all)  # no-op for tables that already exist


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
