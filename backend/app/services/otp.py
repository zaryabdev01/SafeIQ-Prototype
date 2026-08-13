from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from app.core.config import get_settings


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def otp_expiry() -> datetime:
    settings = get_settings()
    return datetime.now(UTC) + timedelta(minutes=settings.otp_expire_minutes)
