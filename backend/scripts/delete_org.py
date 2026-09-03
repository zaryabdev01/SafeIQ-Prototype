"""Hard-delete an organisation and everything tied to it - its isolated
tenant schema plus the control-plane rows that point at it. Use for
pruning test / accidentally-duplicated organisations.

    python -m scripts.delete_org --org-id <uuid>
    python -m scripts.delete_org --org-id <uuid> --dry-run

Irreversible. The shared catalogue (control.onboarding_videos) and
control.internal_users are never touched.
"""

from __future__ import annotations

import argparse
import asyncio
import uuid

from sqlalchemy import delete, text

from app.db.control_models import InviteIndexEntry, Organisation, UserDirectoryEntry
from app.db.session import ControlSessionLocal, engine


async def _run(*, org_id: uuid.UUID, dry_run: bool) -> None:
    async with ControlSessionLocal() as session:
        org = await session.get(Organisation, org_id)
        if org is None:
            print(f"no organisation {org_id}")
            return
        print(f"organisation: {org.name!r}  schema: {org.tenant_schema}")
        if dry_run:
            print("  [dry-run] would drop the schema and delete control rows")
            return

        await session.execute(delete(UserDirectoryEntry).where(UserDirectoryEntry.org_id == org_id))
        await session.execute(delete(InviteIndexEntry).where(InviteIndexEntry.org_id == org_id))
        await session.delete(org)
        await session.commit()

    schema = org.tenant_schema
    if schema and schema.startswith("tenant_"):
        async with engine.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
    print(f"deleted {org.name!r} ({org_id}) and dropped {schema}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--org-id", required=True, type=uuid.UUID)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(_run(org_id=args.org_id, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
