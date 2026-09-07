"""Milestone 4 Phase 2 - RAG stub + assignments + access codes (tasks 32, 34).
Integration tests against a real Postgres (see conftest.postgres_available).
Run with: docker compose up -d db && pytest tests/test_rag_assignments.py
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


async def _create_rag(client: AsyncClient, admin_headers: dict, *, name: str = "Wellbeing RAG") -> dict:
    response = await client.post("/rags", json={"name": name}, headers=admin_headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_rag_and_assign_employee(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)
    assert rag["status"] == "draft"
    employee = await _invite_and_accept(client, admin_headers)

    assignment = await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    assert assignment.status_code == 201, assignment.text
    body = assignment.json()
    assert body["status"] == "active"
    assert body["user_id"] == employee["user_id"]
    assert len(body["access_code"]) == 9  # XXXX-XXXX
    assert body["access_code"].endswith(body["access_code_last4"])


async def test_duplicate_active_assignment_is_conflict(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org B", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)
    employee = await _invite_and_accept(client, admin_headers)

    first = await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    assert first.status_code == 201

    second = await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    assert second.status_code == 409


async def test_assignments_listed_from_both_sides(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org C", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)
    employee = await _invite_and_accept(client, admin_headers)
    await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)

    from_rag_side = await client.get(f"/rags/{rag['id']}/assignments", headers=admin_headers)
    assert from_rag_side.status_code == 200
    assert len(from_rag_side.json()) == 1
    assert from_rag_side.json()[0]["user_name"] == "Team Member"
    assert "access_code" not in from_rag_side.json()[0]  # last4 only on list

    from_person_side = await client.get(f"/team/{employee['user_id']}/assignments", headers=admin_headers)
    assert from_person_side.status_code == 200
    assert len(from_person_side.json()) == 1
    assert from_person_side.json()[0]["rag_name"] == rag["name"]


async def test_rotate_code_changes_value_keeps_assignment_id(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org D", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)
    employee = await _invite_and_accept(client, admin_headers)
    created = await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    assignment = created.json()

    rotated = await client.post(f"/rags/{rag['id']}/assignments/{assignment['id']}/rotate-code", headers=admin_headers)
    assert rotated.status_code == 200, rotated.text
    rotated_body = rotated.json()
    assert rotated_body["id"] == assignment["id"]
    assert rotated_body["access_code"] != assignment["access_code"]


async def test_revoke_keeps_row_with_revoked_at(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org E", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)
    employee = await _invite_and_accept(client, admin_headers)
    created = await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    assignment_id = created.json()["id"]

    revoked = await client.patch(
        f"/rags/{rag['id']}/assignments/{assignment_id}", json={"status": "revoked"}, headers=admin_headers
    )
    assert revoked.status_code == 200, revoked.text
    body = revoked.json()
    assert body["status"] == "revoked"
    assert body["revoked_at"] is not None

    still_listed = await client.get(f"/rags/{rag['id']}/assignments", headers=admin_headers)
    assert any(a["id"] == assignment_id for a in still_listed.json())

    # revoking frees the slot for a fresh active assignment to the same person
    reassign = await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    assert reassign.status_code == 201, reassign.text


async def test_delete_rag_with_assignments_is_conflict(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org F", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)
    employee = await _invite_and_accept(client, admin_headers)
    await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)

    deleted = await client.delete(f"/rags/{rag['id']}", headers=admin_headers)
    assert deleted.status_code == 409


async def test_delete_draft_rag_without_assignments_succeeds(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org G", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)

    deleted = await client.delete(f"/rags/{rag['id']}", headers=admin_headers)
    assert deleted.status_code == 204

    fetched = await client.get(f"/rags/{rag['id']}", headers=admin_headers)
    assert fetched.status_code == 404


async def test_employee_cannot_create_rag(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org H", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    employee_headers = {"Authorization": f"Bearer {employee['access_token']}"}

    response = await client.post("/rags", json={"name": "Should not work"}, headers=employee_headers)
    assert response.status_code == 403


async def test_manager_can_assign_but_not_create_rag(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="RAG Org I", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    rag = await _create_rag(client, admin_headers)
    manager = await _invite_and_accept(client, admin_headers, role="manager")
    manager_headers = {"Authorization": f"Bearer {manager['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)

    forbidden = await client.post("/rags", json={"name": "Manager attempt"}, headers=manager_headers)
    assert forbidden.status_code == 403

    allowed = await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=manager_headers)
    assert allowed.status_code == 201, allowed.text


async def test_rag_and_assignments_are_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    admin_a = await signup_organisation_and_login(client, org_name="RAG Iso A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_b = await signup_organisation_and_login(client, org_name="RAG Iso B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")
    admin_a_headers = {"Authorization": f"Bearer {admin_a['access_token']}"}
    admin_b_headers = {"Authorization": f"Bearer {admin_b['access_token']}"}
    rag_a = await _create_rag(client, admin_a_headers)
    employee_a = await _invite_and_accept(client, admin_a_headers)

    not_found = await client.get(f"/rags/{rag_a['id']}", headers=admin_b_headers)
    assert not_found.status_code == 404

    assign_cross_tenant = await client.post(
        f"/rags/{rag_a['id']}/assignments", json={"user_id": employee_a["user_id"]}, headers=admin_b_headers
    )
    assert assign_cross_tenant.status_code == 404

    org_b_assignments = await client.get(f"/team/{employee_a['user_id']}/assignments", headers=admin_b_headers)
    assert org_b_assignments.status_code == 404
