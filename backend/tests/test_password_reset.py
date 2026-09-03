"""Integration tests for the password-reset flow (see conftest.postgres_available)."""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import override_email_sender, signup_organisation_and_login

_PW = "correct horse battery staple"
_NEW_PW = "brand new battery staple horse"


async def test_forgot_then_reset_then_login_with_new_password(client: AsyncClient, postgres_available: bool) -> None:
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    acc = await signup_organisation_and_login(client, org_name="Reset Org", email=email, password=_PW)

    sender = override_email_sender()
    forgot = await client.post("/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200, forgot.text
    org_id = forgot.json()["organisation_id"]
    assert org_id == str(acc["org_id"])
    code = sender.last_otp()

    reset = await client.post(
        "/auth/reset-password",
        json={"email": email, "organisation_id": org_id, "code": code, "new_password": _NEW_PW},
    )
    assert reset.status_code == 204, reset.text

    assert (await client.post("/auth/login", json={"email": email, "password": _PW, "organisation_id": org_id})).status_code == 401
    assert (
        await client.post("/auth/login", json={"email": email, "password": _NEW_PW, "organisation_id": org_id})
    ).status_code == 200


async def test_forgot_password_for_unknown_email_still_returns_ok_and_sends_nothing(
    client: AsyncClient, postgres_available: bool
) -> None:
    sender = override_email_sender()
    response = await client.post("/auth/forgot-password", json={"email": f"nobody-{uuid.uuid4().hex}@example.com"})
    assert response.status_code == 200
    assert response.json()["sent"] is True
    assert sender.sent == []


async def test_reset_password_rejects_a_wrong_code(client: AsyncClient, postgres_available: bool) -> None:
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    acc = await signup_organisation_and_login(client, org_name="Wrong Code Reset Org", email=email, password=_PW)

    override_email_sender()
    await client.post("/auth/forgot-password", json={"email": email})
    reset = await client.post(
        "/auth/reset-password",
        json={"email": email, "organisation_id": str(acc["org_id"]), "code": "000000", "new_password": _NEW_PW},
    )
    assert reset.status_code == 400


async def test_signup_rejects_a_duplicate_organisation_for_the_same_email(
    client: AsyncClient, postgres_available: bool
) -> None:
    override_email_sender()
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    first = await client.post(
        "/auth/signup/organisation",
        json={"organisation_name": "Dedupe Ltd", "full_name": "Admin", "email": email, "password": _PW},
    )
    assert first.status_code == 201

    dupe = await client.post(
        "/auth/signup/organisation",
        json={"organisation_name": "  dedupe ltd ", "full_name": "Admin", "email": email, "password": _PW},
    )
    assert dupe.status_code == 409
