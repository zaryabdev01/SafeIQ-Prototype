"""Pluggable KYC / identity verification.

- `mock` (dev default) auto-approves synchronously so the whole onboarding
  flow is testable end to end with no external calls.
- `sumsub` talks to Sumsub (https://sumsub.com). Verification is asynchronous:
  `start_verification` creates an applicant and returns a WebSDK token with
  status "pending"; the real outcome arrives later on the webhook
  (`POST /kyc/webhook`, see app/api/routes/kyc_webhook.py).

Everything is behind the `KycProvider` interface - routes never branch on the
provider name.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

# Sumsub review answers -> our internal status vocabulary.
_REVIEW_ANSWER_TO_STATUS = {"GREEN": "approved", "RED": "rejected"}


@dataclass
class KycSession:
    provider: str
    session_id: str
    status: str  # pending | approved | rejected
    redirect_url: str | None = None
    sdk_token: str | None = None  # Sumsub WebSDK access token, if the provider uses one


class KycProvider(ABC):
    @abstractmethod
    async def start_verification(self, *, user_id: str, full_name: str, email: str) -> KycSession: ...

    @abstractmethod
    async def get_status(self, session_id: str) -> str: ...


class MockKycProvider(KycProvider):
    _sessions: dict[str, str] = {}

    async def start_verification(self, *, user_id: str, full_name: str, email: str) -> KycSession:
        session_id = f"mock-{uuid.uuid4()}"
        self._sessions[session_id] = "approved"
        return KycSession(provider="mock", session_id=session_id, status="approved", redirect_url=None)

    async def get_status(self, session_id: str) -> str:
        return self._sessions.get(session_id, "pending")


def review_answer_to_status(answer: str | None) -> str:
    """Map a Sumsub `reviewResult.reviewAnswer` (GREEN/RED) to our status."""
    return _REVIEW_ANSWER_TO_STATUS.get((answer or "").upper(), "pending")


def verify_webhook_signature(raw_body: bytes, digest_header: str, secret: str, algo: str = "HMAC_SHA256_HEX") -> bool:
    """Sumsub signs each webhook body with the shared webhook secret and sends the
    hex digest in `X-Payload-Digest` (algorithm in `X-Payload-Digest-Alg`)."""
    hash_name = {"HMAC_SHA1_HEX": "sha1", "HMAC_SHA256_HEX": "sha256", "HMAC_SHA512_HEX": "sha512"}.get(algo, "sha256")
    expected = hmac.new(secret.encode("utf-8"), raw_body, hash_name).hexdigest()
    return hmac.compare_digest(expected, (digest_header or "").strip())


class SumsubKycProvider(KycProvider):
    def __init__(
        self,
        *,
        app_token: str,
        secret_key: str,
        base_url: str,
        level_name: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not app_token or not secret_key:
            raise ValueError("SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY are required when KYC_PROVIDER=sumsub")
        self._app_token = app_token
        self._secret_key = secret_key
        self._base_url = base_url.rstrip("/")
        self._level_name = level_name
        self._transport = transport

    def _signed_headers(self, method: str, path_with_query: str, body: bytes) -> dict[str, str]:
        ts = str(int(time.time()))
        message = ts.encode() + method.upper().encode() + path_with_query.encode() + body
        signature = hmac.new(self._secret_key.encode("utf-8"), message, hashlib.sha256).hexdigest()
        return {
            "X-App-Token": self._app_token,
            "X-App-Access-Ts": ts,
            "X-App-Access-Sig": signature,
            "Accept": "application/json",
        }

    async def _request(self, method: str, path_with_query: str, *, json_body: dict | None = None) -> httpx.Response:
        body = b"" if json_body is None else json.dumps(json_body).encode("utf-8")
        headers = self._signed_headers(method, path_with_query, body)
        if json_body is not None:
            headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(base_url=self._base_url, transport=self._transport, timeout=20) as client:
            response = await client.request(method, path_with_query, content=body, headers=headers)
        response.raise_for_status()
        return response

    async def start_verification(self, *, user_id: str, full_name: str, email: str) -> KycSession:
        applicant = await self._request(
            "POST",
            f"/resources/applicants?levelName={self._level_name}",
            json_body={"externalUserId": user_id, "email": email, "fixedInfo": {"firstName": full_name}},
        )
        applicant_id = applicant.json()["id"]

        token_resp = await self._request(
            "POST",
            f"/resources/accessTokens?userId={user_id}&levelName={self._level_name}",
        )
        return KycSession(
            provider="sumsub",
            session_id=applicant_id,
            status="pending",
            redirect_url=None,
            sdk_token=token_resp.json()["token"],
        )

    async def get_status(self, session_id: str) -> str:
        resp = await self._request("GET", f"/resources/applicants/{session_id}/status")
        return review_answer_to_status(resp.json().get("reviewResult", {}).get("reviewAnswer"))


def get_kyc_provider() -> KycProvider:
    settings = get_settings()
    if settings.kyc_provider == "mock":
        return MockKycProvider()
    if settings.kyc_provider == "sumsub":
        return SumsubKycProvider(
            app_token=settings.sumsub_app_token,
            secret_key=settings.sumsub_secret_key,
            base_url=settings.sumsub_base_url,
            level_name=settings.sumsub_level_name,
        )
    raise NotImplementedError(f"KYC provider '{settings.kyc_provider}' isn't implemented - use 'mock' or 'sumsub'.")
