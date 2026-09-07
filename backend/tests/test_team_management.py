"""Milestone 4 Phase 1 - Safeguarding Lead, archive status, team search + bulk
ops (tasks 96, 105, 106). Integration tests against a real Postgres (see
conftest.postgres_available).
Run with: docker compose up -d db && pytest tests/test_team_management.py
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import override_email_sender, signup_organisation_and_login


async def _invite_and_accept(client: AsyncClient, admin_headers: dict, *, role: str = "employee") -> dict:
    email = f"member-{uuid.uuid4().hex[:8]}@example.com"
    invite = await client.post("/invites", json={"email": email, "role": role}, headers=admin_headers)
    accept = await client.post(
        f"/invites/{invite.json()['token']}/accept", json={"full_name": "Team Member", "password": "correct horse battery staple"}
    )
    tokens = accept.json()
    me = await client.get("/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    return {"user_id": me.json()["id"], "email": email, "access_token": tokens["access_token"]}


async def _event_types(client: AsyncClient, admin_headers: dict) -> set[str]:
    audit = await client.get("/audit", headers=admin_headers)
    assert audit.status_code == 200
    return {entry["event_type"] for entry in audit.json()}


async def test_set_and_unset_safeguarding_lead(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="M4 Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)

    set_true = await client.patch(
        f"/team/{employee['user_id']}/safeguarding-lead", json={"is_safeguarding_lead": True}, headers=admin_headers
    )
    assert set_true.status_code == 200, set_true.text
    assert set_true.json()["is_safeguarding_lead"] is True

    set_false = await client.patch(
        f"/team/{employee['user_id']}/safeguarding-lead", json={"is_safeguarding_lead": False}, headers=admin_headers
    )
    assert set_false.status_code == 200
    assert set_false.json()["is_safeguarding_lead"] is False

    assert "user.safeguarding_lead_changed" in await _event_types(client, admin_headers)


async def test_manager_cannot_set_safeguarding_lead(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="M4 Org B", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    manager = await _invite_and_accept(client, admin_headers, role="manager")
    manager_headers = {"Authorization": f"Bearer {manager['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)

    # Safeguarding Lead is admin-only (_ROLE_ADMINS), stricter than the usual
    # manager/support/admin team-management gate.
    response = await client.patch(
        f"/team/{employee['user_id']}/safeguarding-lead", json={"is_safeguarding_lead": True}, headers=manager_headers
    )
    assert response.status_code == 403


async def test_archive_hides_from_team_list(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="M4 Org C", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee = await _invite_and_accept(client, admin_headers)

    archived = await client.patch(f"/team/{employee['user_id']}/status", json={"status": "archived"}, headers=admin_headers)
    assert archived.status_code == 200, archived.text
    assert archived.json()["status"] == "archived"

    default_list = await client.get("/team", headers=admin_headers)
    assert employee["user_id"] not in {u["id"] for u in default_list.json()}

    with_archived = await client.get("/team", params={"include_archived": True}, headers=admin_headers)
    assert employee["user_id"] in {u["id"] for u in with_archived.json()}

    assert "user.status_changed" in await _event_types(client, admin_headers)


async def test_team_search_filters_by_name_and_email(client: AsyncClient, postgres_available: bool) -> None:
    admin_email = f"a-{uuid.uuid4().hex[:8]}@example.com"
    admin = await signup_organisation_and_login(client, org_name="M4 Org D", email=admin_email)
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee_email = f"findme-{uuid.uuid4().hex[:8]}@example.com"
    email_invite = await client.post("/invites", json={"email": employee_email, "role": "employee"}, headers=admin_headers)
    await client.post(
        f"/invites/{email_invite.json()['token']}/accept",
        json={"full_name": "Team Member", "password": "correct horse battery staple"},
    )

    by_name = await client.get("/team", params={"q": "Team Member"}, headers=admin_headers)
    assert by_name.status_code == 200
    assert {u["email"] for u in by_name.json()} == {employee_email}

    by_email = await client.get("/team", params={"q": admin_email}, headers=admin_headers)
    assert {u["email"] for u in by_email.json()} == {admin_email}


async def test_bulk_status_archives_many_and_skips_unknown(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="M4 Org E", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    employee_a = await _invite_and_accept(client, admin_headers)
    employee_b = await _invite_and_accept(client, admin_headers)
    unknown_id = str(uuid.uuid4())

    response = await client.post(
        "/team/bulk-status",
        json={"user_ids": [employee_a["user_id"], employee_b["user_id"], unknown_id], "status": "archived"},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body["updated"]) == {employee_a["user_id"], employee_b["user_id"]}
    assert body["skipped"] == [unknown_id]

    remaining = await client.get("/team", headers=admin_headers)
    remaining_ids = {u["id"] for u in remaining.json()}
    assert employee_a["user_id"] not in remaining_ids
    assert employee_b["user_id"] not in remaining_ids

    assert "user.bulk_status_changed" in await _event_types(client, admin_headers)


async def test_bulk_resend_and_cancel_invites(client: AsyncClient, postgres_available: bool) -> None:
    sender = override_email_sender()
    admin = await signup_organisation_and_login(client, org_name="M4 Org F", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    invite_a = await client.post(
        "/invites", json={"email": f"bulk-a-{uuid.uuid4().hex[:8]}@example.com", "role": "employee"}, headers=admin_headers
    )
    invite_b = await client.post(
        "/invites", json={"email": f"bulk-b-{uuid.uuid4().hex[:8]}@example.com", "role": "employee"}, headers=admin_headers
    )
    token_a, token_b = invite_a.json()["token"], invite_b.json()["token"]
    sent_before_resend = len(sender.sent)

    resend = await client.post("/invites/bulk-resend", json={"tokens": [token_a, token_b, "not-a-real-token"]}, headers=admin_headers)
    assert resend.status_code == 200, resend.text
    resend_body = resend.json()
    assert set(resend_body["resent"]) == {token_a, token_b}
    assert resend_body["skipped"] == ["not-a-real-token"]
    assert len(sender.sent) == sent_before_resend + 2

    cancel = await client.post("/invites/bulk-cancel", json={"tokens": [token_a, "not-a-real-token"]}, headers=admin_headers)
    assert cancel.status_code == 200, cancel.text
    cancel_body = cancel.json()
    assert cancel_body["cancelled"] == [token_a]
    assert cancel_body["skipped"] == ["not-a-real-token"]

    listing = await client.get("/invites", params={"status": "cancelled"}, headers=admin_headers)
    assert {i["token"] for i in listing.json()} == {token_a}

    event_types = await _event_types(client, admin_headers)
    assert "invite.bulk_resent" in event_types
    assert "invite.bulk_cancelled" in event_types


async def test_invites_search_by_email(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="M4 Org G", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    target_email = f"findme-{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/invites", json={"email": target_email, "role": "employee"}, headers=admin_headers)
    await client.post("/invites", json={"email": f"other-{uuid.uuid4().hex[:8]}@example.com", "role": "employee"}, headers=admin_headers)

    filtered = await client.get("/invites", params={"q": target_email}, headers=admin_headers)
    assert filtered.status_code == 200
    assert {i["email"] for i in filtered.json()} == {target_email}


async def test_new_team_routes_are_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    admin_a = await signup_organisation_and_login(client, org_name="M4 Iso A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_b = await signup_organisation_and_login(client, org_name="M4 Iso B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")
    admin_a_headers = {"Authorization": f"Bearer {admin_a['access_token']}"}
    admin_b_headers = {"Authorization": f"Bearer {admin_b['access_token']}"}
    employee_a = await _invite_and_accept(client, admin_a_headers)

    lead_response = await client.patch(
        f"/team/{employee_a['user_id']}/safeguarding-lead", json={"is_safeguarding_lead": True}, headers=admin_b_headers
    )
    assert lead_response.status_code == 404

    status_response = await client.patch(f"/team/{employee_a['user_id']}/status", json={"status": "archived"}, headers=admin_b_headers)
    assert status_response.status_code == 404

    bulk_response = await client.post(
        "/team/bulk-status", json={"user_ids": [employee_a["user_id"]], "status": "archived"}, headers=admin_b_headers
    )
    assert bulk_response.status_code == 200
    assert bulk_response.json()["skipped"] == [employee_a["user_id"]]
