"""Integration tests against a real Postgres (see conftest.postgres_available).
Run with: docker compose up -d db && pytest tests/test_login_history.py
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import signup_organisation_and_login


async def _invite_and_accept_employee(client: AsyncClient, admin_headers: dict, *, email: str | None = None) -> dict:
    email = email or f"emp-{uuid.uuid4().hex[:8]}@example.com"
    invite = await client.post("/invites", json={"email": email, "role": "employee"}, headers=admin_headers)
    accept = await client.post(
        f"/invites/{invite.json()['token']}/accept", json={"full_name": "Team Member", "password": "correct horse battery staple"}
    )
    tokens = accept.json()
    me = await client.get("/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    return {"user_id": me.json()["id"], "email": email, "access_token": tokens["access_token"]}


async def test_login_records_event_and_is_listed(client: AsyncClient, postgres_available: bool) -> None:
    email = f"a-{uuid.uuid4().hex[:8]}@example.com"
    admin = await signup_organisation_and_login(client, org_name="Login History Org A", email=email)
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    listing = await client.get("/team/login-history", headers=admin_headers)
    assert listing.status_code == 200
    events = listing.json()
    assert len(events) == 1
    event = events[0]
    assert event["user_id"] == str(admin["user_id"])
    assert event["user_name"] == "Test Admin"
    assert event["ip"]
    assert event["user_agent"]


async def test_login_history_search_by_name_and_email(client: AsyncClient, postgres_available: bool) -> None:
    admin_email = f"a-{uuid.uuid4().hex[:8]}@example.com"
    admin = await signup_organisation_and_login(client, org_name="Login History Org B", email=admin_email)
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    employee_email = f"emp-{uuid.uuid4().hex[:8]}@example.com"
    employee = await _invite_and_accept_employee(client, admin_headers, email=employee_email)
    login = await client.post(
        "/auth/login", json={"email": employee_email, "password": "correct horse battery staple", "organisation_id": str(admin["org_id"])}
    )
    assert login.status_code == 200

    by_name = await client.get("/team/login-history", params={"q": "Team Member"}, headers=admin_headers)
    assert by_name.status_code == 200
    assert {e["user_id"] for e in by_name.json()} == {employee["user_id"]}

    by_email = await client.get("/team/login-history", params={"q": admin_email}, headers=admin_headers)
    assert by_email.status_code == 200
    assert {e["user_id"] for e in by_email.json()} == {str(admin["user_id"])}


async def test_login_history_filter_by_user_id(client: AsyncClient, postgres_available: bool) -> None:
    admin_email = f"a-{uuid.uuid4().hex[:8]}@example.com"
    admin = await signup_organisation_and_login(client, org_name="Login History Org C", email=admin_email)
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    employee_email = f"emp-{uuid.uuid4().hex[:8]}@example.com"
    employee = await _invite_and_accept_employee(client, admin_headers, email=employee_email)
    login = await client.post(
        "/auth/login", json={"email": employee_email, "password": "correct horse battery staple", "organisation_id": str(admin["org_id"])}
    )
    assert login.status_code == 200

    filtered = await client.get("/team/login-history", params={"user_id": employee["user_id"]}, headers=admin_headers)
    assert filtered.status_code == 200
    events = filtered.json()
    assert len(events) == 1
    assert events[0]["user_id"] == employee["user_id"]


async def test_employee_cannot_list_login_history(client: AsyncClient, postgres_available: bool) -> None:
    admin_email = f"a-{uuid.uuid4().hex[:8]}@example.com"
    admin = await signup_organisation_and_login(client, org_name="Login History Org D", email=admin_email)
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept_employee(client, admin_headers)
    employee_headers = {"Authorization": f"Bearer {employee['access_token']}"}

    response = await client.get("/team/login-history", headers=employee_headers)
    assert response.status_code == 403


async def test_login_history_is_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    admin_a = await signup_organisation_and_login(client, org_name="Login History Iso A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_b = await signup_organisation_and_login(client, org_name="Login History Iso B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")
    admin_b_headers = {"Authorization": f"Bearer {admin_b['access_token']}"}

    listing = await client.get("/team/login-history", headers=admin_b_headers)
    assert listing.status_code == 200
    user_ids = {e["user_id"] for e in listing.json()}
    assert str(admin_a["user_id"]) not in user_ids
