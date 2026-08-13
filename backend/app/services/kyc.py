"""Pluggable KYC/identity verification. Provider is explicitly TBC with
the client (see the milestone plan's Questions & Concerns, "KYC scope").
`MockKycProvider` auto-approves so the rest of the onboarding flow is
fully testable end to end today; swap in a real Onfido/Jumio adapter
behind the same `KycProvider` interface once the provider is chosen -
nothing else in the auth flow needs to change.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import get_settings


@dataclass
class KycSession:
    provider: str
    session_id: str
    status: str  # pending | approved | rejected
    redirect_url: str | None = None


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


def get_kyc_provider() -> KycProvider:
    settings = get_settings()
    if settings.kyc_provider == "mock":
        return MockKycProvider()
    raise NotImplementedError(f"KYC provider '{settings.kyc_provider}' isn't implemented yet - TBC with client.")
