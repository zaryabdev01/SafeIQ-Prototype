"""Integration tests against a real Postgres (see conftest.postgres_available).
Run with: docker compose up -d db && pytest tests/test_team_profile.py
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import signup_organisation_and_login


async def _invite_and_accept_employee(client: AsyncClient, admin_headers: dict) -> dict:
    email = f"emp-{uuid.uuid4().hex[:8]}@example.com"
    invite = await client.post("/invites", json={"email": email, "role": "employee"}, headers=admin_headers)
    accept = await client.post(
        f"/invites/{invite.json()['token']}/accept", json={"full_name": "Team Member", "password": "correct horse battery staple"}
    )
    tokens = accept.json()
    me = await client.get("/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    return {"user_id": me.json()["id"], "access_token": tokens["access_token"]}


async def test_get_single_team_member_profile(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept_employee(client, admin_headers)

    response = await client.get(f"/team/{employee['user_id']}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["id"] == employee["user_id"]


async def test_add_and_list_notes(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Org B", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept_employee(client, admin_headers)

    created = await client.post(
        f"/team/{employee['user_id']}/notes", json={"text": "Completed manual handling refresher."}, headers=admin_headers
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["text"] == "Completed manual handling refresher."
    assert body["author_name"] == "Test Admin"

    listing = await client.get(f"/team/{employee['user_id']}/notes", headers=admin_headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1


async def test_employee_cannot_manage_notes(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Org C", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept_employee(client, admin_headers)
    employee_headers = {"Authorization": f"Bearer {employee['access_token']}"}

    response = await client.post(f"/team/{employee['user_id']}/notes", json={"text": "hi"}, headers=employee_headers)
    assert response.status_code == 403


async def test_add_list_and_delete_alert_rule(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Org D", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept_employee(client, admin_headers)

    created = await client.post(
        f"/team/{employee['user_id']}/alert-rules",
        json={"category": "Missed check-in", "severity": "high", "notify_email": "supervisor@example.com"},
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    rule = created.json()
    assert rule["severity"] == "high"

    listing = await client.get(f"/team/{employee['user_id']}/alert-rules", headers=admin_headers)
    assert len(listing.json()) == 1

    deleted = await client.delete(f"/team/{employee['user_id']}/alert-rules/{rule['id']}", headers=admin_headers)
    assert deleted.status_code == 204

    listing_after = await client.get(f"/team/{employee['user_id']}/alert-rules", headers=admin_headers)
    assert listing_after.json() == []


async def test_alert_rule_not_found_for_wrong_subject(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Org E", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee_a = await _invite_and_accept_employee(client, admin_headers)
    employee_b = await _invite_and_accept_employee(client, admin_headers)

    created = await client.post(
        f"/team/{employee_a['user_id']}/alert-rules",
        json={"category": "x", "severity": "low", "notify_email": "supervisor@example.com"},
        headers=admin_headers,
    )
    rule_id = created.json()["id"]

    # deleting via the wrong subject's URL must not succeed
    response = await client.delete(f"/team/{employee_b['user_id']}/alert-rules/{rule_id}", headers=admin_headers)
    assert response.status_code == 404


async def test_notes_are_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    admin_a = await signup_organisation_and_login(client, org_name="Isolation Profile A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_b = await signup_organisation_and_login(client, org_name="Isolation Profile B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")
    admin_a_headers = {"Authorization": f"Bearer {admin_a['access_token']}"}
    admin_b_headers = {"Authorization": f"Bearer {admin_b['access_token']}"}

    employee_a = await _invite_and_accept_employee(client, admin_a_headers)
    await client.post(f"/team/{employee_a['user_id']}/notes", json={"text": "org A only note"}, headers=admin_a_headers)

    # org B admin has no user with employee_a's id in their own tenant schema
    response = await client.get(f"/team/{employee_a['user_id']}", headers=admin_b_headers)
    assert response.status_code == 404
