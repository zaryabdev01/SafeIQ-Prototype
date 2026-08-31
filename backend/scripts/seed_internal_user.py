"""Create (or reset the password of) a SafeIQ Internal console account.

`control.internal_users` has no self-service signup by design - these are
SafeIQ's own cross-tenant support staff. Run this once per person:

    python -m scripts.seed_internal_user --email jordan@safeiq.io --name "Jordan Reyes" --password "..."

Re-running with an existing email updates that account's name and password.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.core.security import hash_password
from app.db.control_models import InternalUser
from app.db.session import ControlSessionLocal


async def _run(*, email: str, name: str, password: str) -> None:
    email = email.strip().lower()
    async with ControlSessionLocal() as session:
        existing = (
            await session.execute(select(InternalUser).where(InternalUser.email == email))
        ).scalar_one_or_none()
        if existing is None:
            session.add(InternalUser(email=email, name=name, password_hash=hash_password(password)))
            action = "created"
        else:
            existing.name = name
            existing.password_hash = hash_password(password)
            action = "updated"
        await session.commit()
    print(f"{action} SafeIQ Internal account: {email}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    asyncio.run(_run(email=args.email, name=args.name, password=args.password))


if __name__ == "__main__":
    main()
