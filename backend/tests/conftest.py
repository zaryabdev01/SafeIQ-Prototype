from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.db.session import engine
from app.main import app


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def postgres_available() -> bool:
    """Integration tests need a real Postgres (schema-per-tenant relies on
    `CREATE SCHEMA`, which SQLite can't do). Skips cleanly with a clear
    reason instead of erroring when one isn't reachable, so
    `pytest` still runs green in an environment without Docker."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this is a reachability probe
        pytest.skip(f"Postgres not reachable ({exc.__class__.__name__}) - run `docker compose up -d db` first")
        return False
