"""Pluggable email sending. Dev default logs instead of sending - see
solution-architecture-aws-design.md for the intended SES-backed sender.
Routes depend on `get_email_sender` via FastAPI's Depends so tests can
override it with a recording double instead of hitting the network/log.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from app.core.config import get_settings

logger = logging.getLogger("safeiq.email")


class EmailSender(ABC):
    @abstractmethod
    async def send(self, *, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender(EmailSender):
    """Dev-only: logs the email instead of sending it. Swap for a real
    AWS SES-backed sender once credentials/config exist - the interface
    above doesn't change, only this implementation does."""

    async def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info("EMAIL to=%s subject=%r\n%s", to, subject, body)


def get_email_sender() -> EmailSender:
    settings = get_settings()
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    raise NotImplementedError(
        f"Email backend '{settings.email_backend}' isn't implemented yet - see backend/README.md TBC notes."
    )
