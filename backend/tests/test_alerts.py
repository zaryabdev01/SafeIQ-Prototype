"""Milestone 4 Phase 3 - the staged Alert model (task 108, 6-stage
lifecycle). Integration tests against a real Postgres (see
conftest.postgres_available). Run with:
docker compose up -d db && pytest tests/test_alerts.py
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


async def _create_alert(client: AsyncClient, admin_headers: dict, *, subject_user_id: str, **overrides: object) -> dict:
    body: dict[str, object] = {"subject_user_id": subject_user_id}
    body.update(overrides)
    response = await client.post("/alerts", json=body, headers=admin_headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_alert_stage_depends_on_keyword(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Alert Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)

    with_keyword = await _create_alert(client, admin_headers, subject_user_id=employee["user_id"], keyword="help")
    assert with_keyword["stage"] == "keyword_detected"
    assert len(with_keyword["stage_transitions"]) == 1
    assert with_keyword["stage_transitions"][0]["from_stage"] is None

    without_keyword = await _create_alert(client, admin_headers, subject_user_id=employee["user_id"])
    assert without_keyword["stage"] == "signal_generated"


async def test_forward_only_stage_machine_rejects_backward_transition(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Alert Org B", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    alert = await _create_alert(client, admin_headers, subject_user_id=employee["user_id"], keyword="help")

    forward = await client.post(
        f"/alerts/{alert['id']}/advance", json={"to_stage": "context_assessment"}, headers=admin_headers
    )
    assert forward.status_code == 200, forward.text
    assert forward.json()["stage"] == "context_assessment"

    backward = await client.post(
        f"/alerts/{alert['id']}/advance", json={"to_stage": "signal_generated"}, headers=admin_headers
    )
    assert backward.status_code == 400

    same_stage = await client.post(
        f"/alerts/{alert['id']}/advance", json={"to_stage": "context_assessment"}, headers=admin_headers
    )
    assert same_stage.status_code == 400


async def test_outcome_stage_requires_outcome_and_closes_alert(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Alert Org C", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    alert = await _create_alert(client, admin_headers, subject_user_id=employee["user_id"], keyword="help")

    for stage in ("context_assessment", "alert_level_set", "human_review"):
        step = await client.post(f"/alerts/{alert['id']}/advance", json={"to_stage": stage}, headers=admin_headers)
        assert step.status_code == 200, step.text

    missing_outcome = await client.post(f"/alerts/{alert['id']}/advance", json={"to_stage": "outcome"}, headers=admin_headers)
    assert missing_outcome.status_code == 400

    closed = await client.post(
        f"/alerts/{alert['id']}/advance", json={"to_stage": "outcome", "outcome": "resolved"}, headers=admin_headers
    )
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert body["status"] == "closed"
    assert body["outcome"] == "resolved"
    assert body["closed_at"] is not None


async def test_transitions_are_ordered_and_audited(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Alert Org D", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    alert = await _create_alert(client, admin_headers, subject_user_id=employee["user_id"], keyword="help")

    await client.post(f"/alerts/{alert['id']}/advance", json={"to_stage": "context_assessment"}, headers=admin_headers)
    await client.post(f"/alerts/{alert['id']}/advance", json={"to_stage": "alert_level_set"}, headers=admin_headers)

    fetched = await client.get(f"/alerts/{alert['id']}", headers=admin_headers)
    assert fetched.status_code == 200
    transitions = fetched.json()["stage_transitions"]
    assert [t["to_stage"] for t in transitions] == ["keyword_detected", "context_assessment", "alert_level_set"]
    assert transitions == sorted(transitions, key=lambda t: t["created_at"])

    audit = await client.get("/audit", headers=admin_headers)
    event_types = {entry["event_type"] for entry in audit.json()}
    assert "alert.created" in event_types
    assert "alert.advanced" in event_types


async def test_patch_blocked_after_human_review(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Alert Org E", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    alert = await _create_alert(client, admin_headers, subject_user_id=employee["user_id"], keyword="help")

    before = await client.patch(f"/alerts/{alert['id']}", json={"severity": "high"}, headers=admin_headers)
    assert before.status_code == 200, before.text

    for stage in ("context_assessment", "alert_level_set", "human_review"):
        await client.post(f"/alerts/{alert['id']}/advance", json={"to_stage": stage}, headers=admin_headers)

    after = await client.patch(f"/alerts/{alert['id']}", json={"severity": "critical"}, headers=admin_headers)
    assert after.status_code == 409


async def test_employee_cannot_create_alert(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Alert Org F", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)
    employee_headers = {"Authorization": f"Bearer {employee['access_token']}"}

    response = await client.post("/alerts", json={"subject_user_id": employee["user_id"]}, headers=employee_headers)
    assert response.status_code == 403


async def test_alerts_are_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    admin_a = await signup_organisation_and_login(client, org_name="Alert Iso A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_b = await signup_organisation_and_login(client, org_name="Alert Iso B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")
    admin_a_headers = {"Authorization": f"Bearer {admin_a['access_token']}"}
    admin_b_headers = {"Authorization": f"Bearer {admin_b['access_token']}"}
    employee_a = await _invite_and_accept(client, admin_a_headers)
    alert = await _create_alert(client, admin_a_headers, subject_user_id=employee_a["user_id"])

    response = await client.get(f"/alerts/{alert['id']}", headers=admin_b_headers)
    assert response.status_code == 404
