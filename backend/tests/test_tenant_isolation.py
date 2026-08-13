"""The one test that matters most architecturally: proves ADR-003's
isolation claim, not just documents it. Run with a real Postgres:
docker compose up -d db && pytest tests/test_tenant_isolation.py
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy import text

from app.db.session import engine
from tests.helpers import signup_organisation_and_login


async def test_two_organisations_get_different_schemas(client: AsyncClient, postgres_available: bool) -> None:
    org_a = await signup_organisation_and_login(client, org_name="Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    org_b = await signup_organisation_and_login(client, org_name="Org B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")

    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT tenant_schema FROM control.organisations WHERE id IN (:a, :b)"),
            {"a": str(org_a["org_id"]), "b": str(org_b["org_id"])},
        )
        schemas = {row[0] for row in result.all()}
    assert len(schemas) == 2, "each organisation must get its own schema, not share one"


async def test_org_a_team_list_never_shows_org_b_users(client: AsyncClient, postgres_available: bool) -> None:
    org_a_email = f"a-{uuid.uuid4().hex[:8]}@example.com"
    org_b_email = f"b-{uuid.uuid4().hex[:8]}@example.com"

    org_a = await signup_organisation_and_login(client, org_name="Isolation Org A", email=org_a_email)
    org_b = await signup_organisation_and_login(client, org_name="Isolation Org B", email=org_b_email)

    team_a = await client.get("/team", headers={"Authorization": f"Bearer {org_a['access_token']}"})
    assert team_a.status_code == 200
    emails_a = {member["email"] for member in team_a.json()}
    assert emails_a == {org_a_email}
    assert org_b_email not in emails_a

    team_b = await client.get("/team", headers={"Authorization": f"Bearer {org_b['access_token']}"})
    emails_b = {member["email"] for member in team_b.json()}
    assert emails_b == {org_b_email}
    assert org_a_email not in emails_b


async def test_audit_ledger_is_per_tenant_and_chain_verifies(client: AsyncClient, postgres_available: bool) -> None:
    org_a = await signup_organisation_and_login(client, org_name="Audit Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {org_a['access_token']}"}

    entries = await client.get("/audit", headers=headers)
    assert entries.status_code == 200
    event_types = [e["event_type"] for e in entries.json()]
    # organisation.created, user.registered, user.email_verified, user.kyc_started,
    # user.kyc_approved, user.logged_in - written by the signup/verify/kyc/login flow itself
    assert "organisation.created" in event_types
    assert "user.logged_in" in event_types

    verification = await client.get("/audit/verify", headers=headers)
    assert verification.status_code == 200
    body = verification.json()
    assert body["valid"] is True
    assert body["entries_checked"] == len(entries.json())
