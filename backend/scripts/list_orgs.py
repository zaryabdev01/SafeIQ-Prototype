"""List every organisation in the control plane - id, name, tenant schema,
created date, and how many directory entries (members) point at it.

    python -m scripts.list_orgs
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import func, select

from app.db.control_models import Organisation, UserDirectoryEntry
from app.db.session import ControlSessionLocal


async def _run() -> None:
    async with ControlSessionLocal() as session:
        rows = (
            await session.execute(
                select(UserDirectoryEntry.org_id, func.count()).group_by(UserDirectoryEntry.org_id)
            )
        ).all()
        counts: dict[uuid.UUID, int] = {row[0]: row[1] for row in rows}
        orgs = (await session.execute(select(Organisation).order_by(Organisation.created_at))).scalars().all()

    if not orgs:
        print("(no organisations)")
        return
    for org in orgs:
        created = org.created_at.date().isoformat() if org.created_at else "?"
        print(f"{org.id}  {created}  members={counts.get(org.id, 0):<3}  {org.name}")
    print(f"\n{len(orgs)} organisation(s)")


if __name__ == "__main__":
    asyncio.run(_run())
