"""Milestone 4 Phase 4 - aggregated profile + Employee×RAG record + activity
(tasks 107, 33). Integration tests against a real Postgres (see
conftest.postgres_available). Run with:
docker compose up -d db && pytest tests/test_team_profile_dashboard.py
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


async def test_profile_payload_shape_and_counts_move(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Dash Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)

    baseline = await client.get(f"/team/{employee['user_id']}/profile", headers=admin_headers)
    assert baseline.status_code == 200, baseline.text
    body = baseline.json()
    assert body["header"]["id"] == employee["user_id"]
    assert body["summary_cards"] == {"assigned_rags": 0, "conversations": 0, "alerts": 0, "open_actions": 0}
    assert body["rag_cards"] == []

    rag = await _create_rag(client, admin_headers)
    await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    await client.post(
        "/alerts", json={"subject_user_id": employee["user_id"], "rag_id": rag["id"], "severity": "high"}, headers=admin_headers
    )
    await client.post(
        "/actions",
        json={
            "title": "Follow up",
            "tier": "recommended_action",
            "priority": "medium",
            "assignee_id": admin["user_id"],
            "subject_user_id": employee["user_id"],
            "rag_id": rag["id"],
        },
        headers=admin_headers,
    )

    updated = await client.get(f"/team/{employee['user_id']}/profile", headers=admin_headers)
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["summary_cards"]["assigned_rags"] == 1
    assert body["summary_cards"]["alerts"] == 1
    assert body["summary_cards"]["open_actions"] == 1
    assert len(body["rag_cards"]) == 1
    card = body["rag_cards"][0]
    assert card["rag_id"] == rag["id"]
    assert card["traffic_light"]["level"] == "red"  # a high-severity open alert
    assert card["traffic_light"]["label"]  # always paired with a label


async def test_employee_rag_tabs_scoped_to_pair(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Dash Org B", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    rag_a = await _create_rag(client, admin_headers, name="RAG A")
    rag_b = await _create_rag(client, admin_headers, name="RAG B")
    await client.post(f"/rags/{rag_a['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    await client.post(f"/rags/{rag_b['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)

    alert_a = await client.post(
        "/alerts", json={"subject_user_id": employee["user_id"], "rag_id": rag_a["id"], "keyword": "help"}, headers=admin_headers
    )
    assert alert_a.status_code == 201

    alerts_a = await client.get(f"/team/{employee['user_id']}/rags/{rag_a['id']}/alerts", headers=admin_headers)
    assert len(alerts_a.json()) == 1
    alerts_b = await client.get(f"/team/{employee['user_id']}/rags/{rag_b['id']}/alerts", headers=admin_headers)
    assert alerts_b.json() == []

    record_a = await client.get(f"/team/{employee['user_id']}/rags/{rag_a['id']}", headers=admin_headers)
    assert record_a.status_code == 200
    assert record_a.json()["assignment_status"] == "active"
    assert record_a.json()["open_alerts"] == 1


async def test_conversations_tab_is_documented_stub(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Dash Org C", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    rag = await _create_rag(client, admin_headers)
    await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)

    response = await client.get(f"/team/{employee['user_id']}/rags/{rag['id']}/conversations", headers=admin_headers)
    assert response.status_code == 200
    assert response.json() == {"items": [], "note": "Available once the chat agent (Milestone 6) ships"}


async def test_audit_log_is_content_free(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Dash Org D", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    rag = await _create_rag(client, admin_headers)
    await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    await client.post(
        "/alerts", json={"subject_user_id": employee["user_id"], "rag_id": rag["id"], "keyword": "help"}, headers=admin_headers
    )

    response = await client.get(f"/team/{employee['user_id']}/rags/{rag['id']}/audit-log", headers=admin_headers)
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 2  # at least rag_assignment.created + alert.created
    for entry in items:
        assert set(entry.keys()) == {"event_type", "owner", "created_at"}
        assert "content" not in entry


async def test_overview_lists_assignment_alert_and_action_events(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Dash Org E", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    rag = await _create_rag(client, admin_headers)
    await client.post(f"/rags/{rag['id']}/assignments", json={"user_id": employee["user_id"]}, headers=admin_headers)
    await client.post(
        "/alerts", json={"subject_user_id": employee["user_id"], "rag_id": rag["id"], "keyword": "help"}, headers=admin_headers
    )
    await client.post(
        "/actions",
        json={
            "title": "Check in",
            "tier": "recommended_action",
            "priority": "medium",
            "assignee_id": admin["user_id"],
            "subject_user_id": employee["user_id"],
            "rag_id": rag["id"],
        },
        headers=admin_headers,
    )

    response = await client.get(f"/team/{employee['user_id']}/rags/{rag['id']}/overview", headers=admin_headers)
    assert response.status_code == 200
    kinds = {item["kind"] for item in response.json()["items"]}
    assert "assignment.created" in kinds
    assert "alert.created" in kinds
    assert "action.created" in kinds


async def test_profile_and_rag_record_are_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    admin_a = await signup_organisation_and_login(client, org_name="Profile Dash Iso A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_b = await signup_organisation_and_login(client, org_name="Profile Dash Iso B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")
    admin_a_headers = {"Authorization": f"Bearer {admin_a['access_token']}"}
    admin_b_headers = {"Authorization": f"Bearer {admin_b['access_token']}"}
    employee_a = await _invite_and_accept(client, admin_a_headers)
    rag_a = await _create_rag(client, admin_a_headers)

    profile_response = await client.get(f"/team/{employee_a['user_id']}/profile", headers=admin_b_headers)
    assert profile_response.status_code == 404

    record_response = await client.get(f"/team/{employee_a['user_id']}/rags/{rag_a['id']}", headers=admin_b_headers)
    assert record_response.status_code == 404


async def test_employee_cannot_view_profile(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Profile Dash Org F", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    employee_headers = {"Authorization": f"Bearer {employee['access_token']}"}

    response = await client.get(f"/team/{employee['user_id']}/profile", headers=employee_headers)
    assert response.status_code == 403
