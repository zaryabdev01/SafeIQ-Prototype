"""Milestone 4 Phase 3 - the shared Action entity (task 108 pipeline +
addendum 113). Integration tests against a real Postgres (see
conftest.postgres_available). Run with:
docker compose up -d db && pytest tests/test_actions.py
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import signup_organisation_and_login


async def _invite_and_accept(client: AsyncClient, admin_headers: dict, *, role: str = "employee") -> dict:
    email = f"member-{uuid.uuid4().hex[:8]}@example.com"
    invite = await client.post("/invites", json={"email": email, "role": role}, headers=admin_headers)
    accept = await client.post(
        f"/invites/{invite.json()['token']}/accept", json={"full_name": "Team Member", "password": "correct horse battery staple"}
    )
    tokens = accept.json()
    me = await client.get("/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    return {"user_id": me.json()["id"], "access_token": tokens["access_token"]}


async def test_action_crud(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Action Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)

    created = await client.post(
        "/actions",
        json={
            "title": "Check in with employee",
            "tier": "recommended_action",
            "priority": "high",
            "assignee_id": admin["user_id"],
            "subject_user_id": employee["user_id"],
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    action = created.json()
    assert action["status"] == "open"
    assert action["completed_at"] is None

    fetched = await client.get(f"/actions/{action['id']}", headers=admin_headers)
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Check in with employee"

    updated = await client.patch(f"/actions/{action['id']}", json={"priority": "urgent"}, headers=admin_headers)
    assert updated.status_code == 200
    assert updated.json()["priority"] == "urgent"

    completed = await client.patch(f"/actions/{action['id']}", json={"status": "completed"}, headers=admin_headers)
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"] is not None

    deleted = await client.delete(f"/actions/{action['id']}", headers=admin_headers)
    assert deleted.status_code == 204
    gone = await client.get(f"/actions/{action['id']}", headers=admin_headers)
    assert gone.status_code == 404


async def _create_action(client: AsyncClient, admin_headers: dict, *, assignee_id: str, **overrides: object) -> dict:
    body = {"title": "Default action", "tier": "recommended_action", "priority": "medium", "assignee_id": assignee_id}
    body.update(overrides)
    response = await client.post("/actions", json=body, headers=admin_headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_action_filters(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Action Org B", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee_a = await _invite_and_accept(client, admin_headers)
    employee_b = await _invite_and_accept(client, admin_headers)

    action_a = await _create_action(
        client,
        admin_headers,
        assignee_id=admin["user_id"],
        title="Follow up A",
        subject_user_id=employee_a["user_id"],
        tier="urgent_action",
    )
    await _create_action(
        client, admin_headers, assignee_id=admin["user_id"], title="Follow up B", subject_user_id=employee_b["user_id"], priority="low"
    )

    by_subject = await client.get("/actions", params={"subject_user_id": employee_a["user_id"]}, headers=admin_headers)
    assert {a["id"] for a in by_subject.json()} == {action_a["id"]}

    by_tier = await client.get("/actions", params={"tier": "urgent_action"}, headers=admin_headers)
    assert {a["id"] for a in by_tier.json()} == {action_a["id"]}

    by_priority = await client.get("/actions", params={"priority": "low"}, headers=admin_headers)
    assert action_a["id"] not in {a["id"] for a in by_priority.json()}

    by_status = await client.get("/actions", params={"status": "open"}, headers=admin_headers)
    assert len(by_status.json()) == 2

    by_q = await client.get("/actions", params={"q": "Follow up A"}, headers=admin_headers)
    assert {a["id"] for a in by_q.json()} == {action_a["id"]}

    by_assignee = await client.get("/actions", params={"assignee_id": admin["user_id"]}, headers=admin_headers)
    assert len(by_assignee.json()) == 2


async def test_employee_cannot_create_action(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Action Org C", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    employee_headers = {"Authorization": f"Bearer {employee['access_token']}"}

    response = await client.post(
        "/actions",
        json={"title": "Should not work", "tier": "recommended_action", "priority": "medium", "assignee_id": admin["user_id"]},
        headers=employee_headers,
    )
    assert response.status_code == 403


async def test_actions_are_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    admin_a = await signup_organisation_and_login(client, org_name="Action Iso A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_b = await signup_organisation_and_login(client, org_name="Action Iso B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")
    admin_a_headers = {"Authorization": f"Bearer {admin_a['access_token']}"}
    admin_b_headers = {"Authorization": f"Bearer {admin_b['access_token']}"}
    action = await _create_action(client, admin_a_headers, assignee_id=admin_a["user_id"])

    response = await client.get(f"/actions/{action['id']}", headers=admin_b_headers)
    assert response.status_code == 404
