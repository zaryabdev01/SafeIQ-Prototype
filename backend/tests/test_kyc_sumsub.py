"""Unit tests for the Sumsub KYC adapter - no real network (httpx.MockTransport)."""

from __future__ import annotations

import hashlib
import hmac

import httpx
import pytest

from app.services.kyc import SumsubKycProvider, review_answer_to_status, verify_webhook_signature


def test_review_answer_to_status() -> None:
    assert review_answer_to_status("GREEN") == "approved"
    assert review_answer_to_status("green") == "approved"
    assert review_answer_to_status("RED") == "rejected"
    assert review_answer_to_status(None) == "pending"
    assert review_answer_to_status("UNKNOWN") == "pending"


def test_verify_webhook_signature() -> None:
    secret = "webhook-secret"
    body = b'{"type":"applicantReviewed","reviewResult":{"reviewAnswer":"GREEN"}}'
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    assert verify_webhook_signature(body, digest, secret) is True
    assert verify_webhook_signature(body, digest, "other-secret") is False
    assert verify_webhook_signature(body, "deadbeef", secret) is False
    assert verify_webhook_signature(b"tampered", digest, secret) is False


async def test_start_verification_creates_applicant_and_sdk_token() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        assert request.headers["X-App-Token"] == "app-tok"
        assert request.headers["X-App-Access-Sig"]
        assert request.headers["X-App-Access-Ts"]
        if request.url.path == "/resources/applicants":
            assert request.url.params["levelName"] == "id-and-liveness"
            return httpx.Response(200, json={"id": "APPLICANT-1"})
        if request.url.path == "/resources/accessTokens":
            assert request.url.params["userId"] == "org-1:user-1"
            return httpx.Response(200, json={"token": "SDK-TOKEN", "userId": "org-1:user-1"})
        return httpx.Response(404)

    provider = SumsubKycProvider(
        app_token="app-tok",
        secret_key="secret",
        base_url="https://api.sumsub.com",
        level_name="id-and-liveness",
        transport=httpx.MockTransport(handler),
    )
    session = await provider.start_verification(user_id="org-1:user-1", full_name="Ann Example", email="ann@example.com")

    assert session.provider == "sumsub"
    assert session.session_id == "APPLICANT-1"
    assert session.status == "pending"
    assert session.sdk_token == "SDK-TOKEN"
    assert calls == ["/resources/applicants", "/resources/accessTokens"]


async def test_get_status_maps_green_to_approved() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/resources/applicants/APPLICANT-1/status"
        return httpx.Response(200, json={"reviewResult": {"reviewAnswer": "GREEN"}, "reviewStatus": "completed"})

    provider = SumsubKycProvider(
        app_token="app-tok", secret_key="secret", base_url="https://api.sumsub.com", level_name="lvl",
        transport=httpx.MockTransport(handler),
    )
    assert await provider.get_status("APPLICANT-1") == "approved"


def test_requires_credentials() -> None:
    with pytest.raises(ValueError):
        SumsubKycProvider(app_token="", secret_key="", base_url="https://api.sumsub.com", level_name="lvl")
