"""Integration tests against a real Postgres (see conftest.postgres_available).
Run with: docker compose up -d db && pytest tests/test_auth_flow.py
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import signup_organisation_and_login


async def test_signup_verify_kyc_login_happy_path(client: AsyncClient, postgres_available: bool) -> None:
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    result = await signup_organisation_and_login(client, org_name="Acme Fostering", email=email)

    me = await client.get("/me", headers={"Authorization": f"Bearer {result['access_token']}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == email
    assert body["team_role"] == "super_admin"
    assert body["email_verified"] is True
    assert body["kyc_status"] == "approved"


async def test_wrong_otp_is_rejected(client: AsyncClient, postgres_available: bool) -> None:
    from tests.helpers import override_email_sender

    override_email_sender()
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    signup = await client.post(
        "/auth/signup/organisation",
        json={"organisation_name": "Wrong Code Org", "full_name": "Admin", "email": email, "password": "correct horse battery staple"},
    )
    assert signup.status_code == 201

    verify = await client.post("/auth/verify-otp", json={"onboarding_token": signup.json()["onboarding_token"], "code": "000000"})
    assert verify.status_code == 400


async def test_login_before_email_verification_is_rejected(client: AsyncClient, postgres_available: bool) -> None:
    from tests.helpers import override_email_sender

    override_email_sender()
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    signup = await client.post(
        "/auth/signup/organisation",
        json={"organisation_name": "Unverified Org", "full_name": "Admin", "email": email, "password": "correct horse battery staple"},
    )
    org_id = signup.json()["org_id"]

    login = await client.post("/auth/login", json={"email": email, "password": "correct horse battery staple", "organisation_id": org_id})
    assert login.status_code == 403


async def test_invite_flow_binds_employee_to_inviting_org(client: AsyncClient, postgres_available: bool) -> None:
    admin_email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    admin = await signup_organisation_and_login(client, org_name="Invite Test Org", email=admin_email)
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    employee_email = f"employee-{uuid.uuid4().hex[:8]}@example.com"
    create = await client.post("/invites", json={"email": employee_email, "role": "employee"}, headers=headers)
    assert create.status_code == 201, create.text
    invite = create.json()

    preview = await client.get(f"/invites/{invite['token']}")
    assert preview.status_code == 200
    assert preview.json()["organisation_name"] == "Invite Test Org"

    accept = await client.post(
        f"/invites/{invite['token']}/accept",
        json={"full_name": "New Employee", "password": "correct horse battery staple"},
    )
    assert accept.status_code == 200, accept.text
    employee_tokens = accept.json()

    me = await client.get("/me", headers={"Authorization": f"Bearer {employee_tokens['access_token']}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == employee_email
    assert body["team_role"] == "employee"

    # the org admin's /team list should now include the new employee
    team = await client.get("/team", headers=headers)
    assert team.status_code == 200
    emails = [member["email"] for member in team.json()]
    assert employee_email in emails
