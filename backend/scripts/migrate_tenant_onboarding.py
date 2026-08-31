"""One-off reconciliation for Milestone 3 phase 2.

The onboarding video catalogue moved to `control.onboarding_videos`
(see alembic 0002). Tenant schemas are provisioned by metadata.create_all,
not Alembic, so every *existing* tenant schema still has:

  - an `onboarding_events.video_id` FK -> its own local `onboarding_videos`
    (new code writes control-plane video ids there -> FK violation)
  - the now-unused `onboarding_videos` table and `videoaudience` enum

This script drops all three, per tenant schema. Idempotent - safe to run
more than once, and a no-op for schemas already reconciled or provisioned
after the model change.

    python -m scripts.migrate_tenant_onboarding            # apply
    python -m scripts.migrate_tenant_onboarding --dry-run  # list only
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select, text

from app.db.control_models import Organisation
from app.db.session import ControlSessionLocal, engine

_STATEMENTS = (
    'ALTER TABLE "{schema}".onboarding_events DROP CONSTRAINT IF EXISTS onboarding_events_video_id_fkey',
    'DROP TABLE IF EXISTS "{schema}".onboarding_videos',
    'DROP TYPE IF EXISTS "{schema}".videoaudience',
)


async def _run(*, dry_run: bool) -> None:
    async with ControlSessionLocal() as session:
        schemas = list((await session.execute(select(Organisation.tenant_schema))).scalars().all())

    print(f"{len(schemas)} tenant schema(s) to reconcile")
    for schema in schemas:
        if dry_run:
            print(f"  [dry-run] {schema}")
            continue
        async with engine.begin() as conn:
            for template in _STATEMENTS:
                await conn.execute(text(template.format(schema=schema)))
        print(f"  reconciled {schema}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="list target schemas without altering them")
    args = parser.parse_args()
    asyncio.run(_run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
