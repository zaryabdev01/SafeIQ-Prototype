"""Hard-delete organisations and everything tied to them - each org's
isolated tenant schema plus the control-plane rows that point at it. Use
for pruning test / accidentally-duplicated organisations.

    python -m scripts.delete_org --org-id <uuid>
    python -m scripts.delete_org --name "ByteCraft" --name "CAS"     # every org with that exact name
    python -m scripts.delete_org --name "ByteCraft" --dry-run

Irreversible. The shared catalogue (control.onboarding_videos) and
control.internal_users are never touched.
"""

from __future__ import annotations

import argparse
import asyncio
import uuid

from sqlalchemy import delete, func, or_, select, text

from app.db.control_models import InviteIndexEntry, Organisation, UserDirectoryEntry
from app.db.session import ControlSessionLocal, engine


async def _resolve(session, *, org_ids: list[uuid.UUID], names: list[str]) -> list[Organisation]:
    conds = []
    if org_ids:
        conds.append(Organisation.id.in_(org_ids))
    if names:
        conds.append(func.lower(Organisation.name).in_([n.strip().lower() for n in names]))
    if not conds:
        return []
    return list((await session.execute(select(Organisation).where(or_(*conds)))).scalars().all())


async def _run(*, org_ids: list[uuid.UUID], names: list[str], dry_run: bool) -> None:
    async with ControlSessionLocal() as session:
        orgs = await _resolve(session, org_ids=org_ids, names=names)
        if not orgs:
            print("no matching organisations")
            return
        for org in orgs:
            print(f"  {org.id}  {org.name!r}  schema: {org.tenant_schema}")
        if dry_run:
            print(f"[dry-run] would delete {len(orgs)} organisation(s)")
            return

        ids = [o.id for o in orgs]
        await session.execute(delete(UserDirectoryEntry).where(UserDirectoryEntry.org_id.in_(ids)))
        await session.execute(delete(InviteIndexEntry).where(InviteIndexEntry.org_id.in_(ids)))
        for org in orgs:
            await session.delete(org)
        await session.commit()

    for org in orgs:
        if org.tenant_schema and org.tenant_schema.startswith("tenant_"):
            async with engine.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA IF EXISTS "{org.tenant_schema}" CASCADE'))
        print(f"deleted {org.name!r} ({org.id})")
    print(f"done - {len(orgs)} organisation(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--org-id", action="append", default=[], type=uuid.UUID, dest="org_ids")
    parser.add_argument("--name", action="append", default=[], dest="names")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.org_ids and not args.names:
        parser.error("pass at least one --org-id or --name")
    asyncio.run(_run(org_ids=args.org_ids, names=args.names, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
