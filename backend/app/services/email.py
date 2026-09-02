"""Pluggable email sending.

- `console` (dev default) logs the email instead of sending it.
- `smtp` sends over real SMTP (interim provider is Gmail SMTP; the production
  target is AWS SES over its SMTP interface - same class, different host/creds).

Routes depend on `get_email_sender` via FastAPI's Depends so tests can override
it with a recording double instead of hitting the network/log.
"""

from __future__ import annotations

import logging
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage
from email.utils import make_msgid

import anyio

from app.core.config import get_settings

logger = logging.getLogger("safeiq.email")


class EmailSender(ABC):
    @abstractmethod
    async def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None: ...


class ConsoleEmailSender(EmailSender):
    """Dev-only: logs the email instead of sending it."""

    async def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        logger.info("EMAIL to=%s subject=%r html=%s\n%s", to, subject, html is not None, body)


class SmtpEmailSender(EmailSender):
    """Sends plain-text mail over SMTP. `smtplib` is blocking, so the actual
    send runs in a worker thread to keep the event loop free."""

    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        from_email: str,
        from_name: str,
        use_tls: bool,
    ) -> None:
        if not host or not from_email:
            raise ValueError("SMTP_HOST and SMTP_FROM_EMAIL are required when EMAIL_BACKEND=smtp")
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._from_email = from_email
        self._from_name = from_name
        self._use_tls = use_tls

    def _send_sync(self, *, to: str, subject: str, body: str, html: str | None) -> None:
        domain = self._from_email.rsplit("@", 1)[-1] or "safeiq.local"
        message = EmailMessage()
        message["From"] = f"{self._from_name} <{self._from_email}>"
        message["To"] = to
        message["Subject"] = subject
        message["Reply-To"] = self._from_email
        message["Message-ID"] = make_msgid(domain=domain)
        # Improves inbox placement for transactional mail; a mailto target is
        # a valid List-Unsubscribe per RFC 8058 when there's no HTTP endpoint.
        message["List-Unsubscribe"] = f"<mailto:{self._from_email}?subject=unsubscribe>"
        message.set_content(body)
        if html is not None:
            message.add_alternative(html, subtype="html")

        with smtplib.SMTP(self._host, self._port, timeout=30) as server:
            if self._use_tls:
                server.starttls()
            if self._username:
                server.login(self._username, self._password)
            server.send_message(message)

    async def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        await anyio.to_thread.run_sync(lambda: self._send_sync(to=to, subject=subject, body=body, html=html))
        logger.info("EMAIL sent to=%s subject=%r via smtp", to, subject)


def get_email_sender() -> EmailSender:
    settings = get_settings()
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    if settings.email_backend == "smtp":
        return SmtpEmailSender(
            host=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            from_email=settings.smtp_from_email,
            from_name=settings.smtp_from_name,
            use_tls=settings.smtp_use_tls,
        )
    raise NotImplementedError(
        f"Email backend '{settings.email_backend}' isn't implemented - use 'console' or 'smtp'."
    )
