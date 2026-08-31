"""SafeIQ Internal console auth (control.internal_users).

Integration tests - need a real Postgres for the control schema (see
conftest.postgres_available).
"""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import delete

from app.core.security import hash_password
from app.db.control_models import InternalUser
from app.db.session import ControlSessionLocal
from tests.helpers import signup_organisation_and_login

_PASSWORD = "correct horse battery staple"


@pytest_asyncio.fixture
async def internal_user(postgres_available: bool) -> InternalUser:
    email = f"support-{uuid.uuid4().hex[:8]}@safeiq.io"
    async with ControlSessionLocal() as session:
        user = InternalUser(name="Jordan Reyes", email=email, password_hash=hash_password(_PASSWORD))
        session.add(user)
        await session.commit()
        await session.refresh(user)
    yield user
    async with ControlSessionLocal() as session:
        await session.execute(delete(InternalUser).where(InternalUser.email == email))
        await session.commit()


async def test_login_returns_a_usable_token(client: AsyncClient, internal_user: InternalUser) -> None:
    login = await client.post("/internal/auth/login", json={"email": internal_user.email, "password": _PASSWORD})
    assert login.status_code == 200, login.text
    tokens = login.json()
    assert tokens["token_type"] == "bearer"

    me = await client.get("/internal/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == internal_user.email
    assert body["name"] == "Jordan Reyes"


async def test_login_rejects_wrong_password(client: AsyncClient, internal_user: InternalUser) -> None:
    login = await client.post("/internal/auth/login", json={"email": internal_user.email, "password": "nope"})
    assert login.status_code == 401


async def test_login_rejects_unknown_email(client: AsyncClient, postgres_available: bool) -> None:
    login = await client.post("/internal/auth/login", json={"email": "ghost@safeiq.io", "password": _PASSWORD})
    assert login.status_code == 401


async def test_internal_me_rejects_a_tenant_token(client: AsyncClient, postgres_available: bool) -> None:
    """A normal org access token must not open the internal console."""
    admin = await signup_organisation_and_login(client, org_name="Scope Test Org", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    me = await client.get("/internal/me", headers={"Authorization": f"Bearer {admin['access_token']}"})
    assert me.status_code == 403


async def test_internal_token_is_rejected_by_the_tenant_api(client: AsyncClient, internal_user: InternalUser) -> None:
    """And the reverse: an internal token must not call tenant routes."""
    login = await client.post("/internal/auth/login", json={"email": internal_user.email, "password": _PASSWORD})
    internal_token = login.json()["access_token"]

    me = await client.get("/me", headers={"Authorization": f"Bearer {internal_token}"})
    assert me.status_code == 403


async def test_internal_me_requires_a_token(client: AsyncClient) -> None:
    assert (await client.get("/internal/me")).status_code == 401
