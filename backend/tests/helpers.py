from __future__ import annotations

import re
import uuid

from httpx import AsyncClient

from app.main import app
from app.services.email import EmailSender, get_email_sender

_OTP_RE = re.compile(r"verification code is (\d{6})")


class RecordingEmailSender(EmailSender):
    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send(self, *, to: str, subject: str, body: str) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body})

    def last_otp(self) -> str:
        for message in reversed(self.sent):
            match = _OTP_RE.search(message["body"])
            if match:
                return match.group(1)
        raise AssertionError("No OTP email was sent")


def override_email_sender() -> RecordingEmailSender:
    sender = RecordingEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: sender
    return sender


async def signup_organisation_and_login(
    client: AsyncClient, *, org_name: str, email: str, password: str = "correct horse battery staple"
) -> dict:
    """Full Milestone 2 happy path: signup -> verify OTP -> KYC -> login.
    Returns {org_id, user_id, access_token, refresh_token}."""
    sender = override_email_sender()

    signup = await client.post(
        "/auth/signup/organisation",
        json={"organisation_name": org_name, "full_name": "Test Admin", "email": email, "password": password},
    )
    assert signup.status_code == 201, signup.text
    signup_body = signup.json()

    otp_code = sender.last_otp()
    verify = await client.post("/auth/verify-otp", json={"onboarding_token": signup_body["onboarding_token"], "code": otp_code})
    assert verify.status_code == 200, verify.text

    kyc = await client.post("/auth/kyc/start", params={"onboarding_token": signup_body["onboarding_token"]})
    assert kyc.status_code == 200, kyc.text
    assert kyc.json()["status"] == "approved"

    login = await client.post("/auth/login", json={"email": email, "password": password, "organisation_id": signup_body["org_id"]})
    assert login.status_code == 200, login.text
    tokens = login.json()

    return {
        "org_id": uuid.UUID(signup_body["org_id"]),
        "user_id": uuid.UUID(signup_body["user_id"]),
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
    }
