"""Password hashing (Argon2id) and JWT issuance/verification.

Argon2id is used per security-compliance-design.md's hashing-scheme note.
JWTs are HS256/shared-secret for now; moving to a KMS-backed asymmetric
signer is a production hardening step, not a Milestone 2 requirement.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()

TokenType = Literal["access", "refresh", "onboarding"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def _encode(payload: dict[str, Any]) -> str:
    settings = get_settings()
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def create_access_token(
    *,
    subject: str,
    org_id: str,
    tenant_schema: str,
    role: str,
    token_type: TokenType = "access",
    expires_minutes: int | None = None,
) -> str:
    settings = get_settings()
    default_minutes = {
        "access": settings.access_token_expire_minutes,
        "refresh": settings.refresh_token_expire_minutes,
        "onboarding": settings.onboarding_token_expire_minutes,
    }[token_type]

    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "org_id": org_id,
        "tenant_schema": tenant_schema,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes or default_minutes),
    }
    return _encode(payload)


def create_onboarding_token(*, subject: str, org_id: str, tenant_schema: str) -> str:
    """A narrow-purpose token issued right after signup: only valid for
    continuing onboarding (OTP verification, KYC), never for calling the
    authenticated API - `role` is intentionally omitted since the user
    isn't a confirmed member yet."""
    return create_access_token(subject=subject, org_id=org_id, tenant_schema=tenant_schema, role="", token_type="onboarding")
