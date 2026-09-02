"""Unit tests for the HTML email body builder."""

from __future__ import annotations

from app.services.email_templates import render_email


def test_renders_heading_intro_and_button() -> None:
    html = render_email(
        heading="You're invited to SafeIQ",
        intro="An administrator has invited you.",
        cta_label="Accept invitation",
        cta_url="https://app.example/invite/tok123",
    )
    assert "You&#x27;re invited to SafeIQ" in html  # heading is HTML-escaped
    assert "An administrator has invited you." in html
    assert 'href="https://app.example/invite/tok123"' in html
    assert "Accept invitation" in html
    assert "https://app.example/invite/tok123" in html  # also shown as a paste-able link


def test_highlight_block_for_otp_code() -> None:
    html = render_email(heading="Verify your email", intro="Your code:", highlight="482913")
    assert "482913" in html
    assert "letter-spacing" in html  # the code box styling


def test_escapes_injection_in_all_fields() -> None:
    html = render_email(
        heading="<script>h</script>",
        intro="<img src=x onerror=1>",
        cta_label="<b>go</b>",
        cta_url="https://x/?a=1&b=2",
        outro="</td></tr>",
    )
    assert "<script>" not in html
    assert "<img src=x" not in html
    assert "&amp;b=2" in html
