"""Unit tests for the SMTP email backend - no real network (smtplib.SMTP is faked)."""

from __future__ import annotations

import pytest

import app.services.email as email_mod
from app.services.email import SmtpEmailSender


class _FakeSMTP:
    instances: list[_FakeSMTP] = []

    def __init__(self, host: str, port: int, timeout: int | None = None) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.started_tls = False
        self.login_args: tuple[str, str] | None = None
        self.sent: list = []
        _FakeSMTP.instances.append(self)

    def __enter__(self) -> _FakeSMTP:
        return self

    def __exit__(self, *exc: object) -> bool:
        return False

    def starttls(self) -> None:
        self.started_tls = True

    def login(self, username: str, password: str) -> None:
        self.login_args = (username, password)

    def send_message(self, message: object) -> None:
        self.sent.append(message)


async def test_smtp_sender_starts_tls_logs_in_and_sends(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(email_mod.smtplib, "SMTP", _FakeSMTP)
    _FakeSMTP.instances.clear()

    sender = SmtpEmailSender(
        host="smtp.example.com",
        port=587,
        username="u@example.com",
        password="pw",
        from_email="from@example.com",
        from_name="SafeIQ",
        use_tls=True,
    )
    await sender.send(to="dest@example.com", subject="Your SafeIQ verification code", body="Your verification code is 123456.")

    smtp = _FakeSMTP.instances[-1]
    assert (smtp.host, smtp.port) == ("smtp.example.com", 587)
    assert smtp.started_tls is True
    assert smtp.login_args == ("u@example.com", "pw")
    assert len(smtp.sent) == 1
    message = smtp.sent[0]
    assert message["To"] == "dest@example.com"
    assert message["From"] == "SafeIQ <from@example.com>"
    assert "123456" in message.get_content()


async def test_smtp_sender_skips_login_without_username(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(email_mod.smtplib, "SMTP", _FakeSMTP)
    _FakeSMTP.instances.clear()

    sender = SmtpEmailSender(
        host="smtp.example.com", port=25, username="", password="", from_email="from@example.com", from_name="SafeIQ", use_tls=False
    )
    await sender.send(to="dest@example.com", subject="Hi", body="body")

    smtp = _FakeSMTP.instances[-1]
    assert smtp.started_tls is False
    assert smtp.login_args is None


def test_smtp_sender_requires_host_and_from() -> None:
    with pytest.raises(ValueError):
        SmtpEmailSender(host="", port=587, username="", password="", from_email="", from_name="SafeIQ", use_tls=True)
