"""Minimal HTML email body builder - table layout, inline styles, one accent
colour, a bulletproof button. No images (avoids broken-image rendering and
image-based spam scoring) and no template engine. Every sender passes a
plain-text `body` too; this is only the `text/html` alternative.
"""

from __future__ import annotations

import html as _html

_ACCENT = "#4f46e5"
_INK = "#1f2937"
_MUTED = "#6b7280"
_BG = "#f3f4f6"


def render_email(
    *,
    heading: str,
    intro: str,
    highlight: str | None = None,
    cta_label: str | None = None,
    cta_url: str | None = None,
    outro: str | None = None,
) -> str:
    """`highlight` renders a large centred box (used for the OTP code).
    `cta_label` + `cta_url` render a button; the URL is also shown as text
    underneath so it survives clients that strip the button."""
    e = _html.escape
    parts = [
        f'<div style="margin:0;padding:24px 0;background:{_BG};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">',
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;'
        'border:1px solid #e5e7eb;">',
        f'<tr><td style="background:{_ACCENT};padding:16px 28px;color:#ffffff;font-weight:700;font-size:16px;">SafeIQ</td></tr>',
        '<tr><td style="padding:28px;">',
        f'<h1 style="margin:0 0 12px;font-size:20px;color:{_INK};">{e(heading)}</h1>',
        f'<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:{_INK};">{e(intro)}</p>',
    ]
    if highlight:
        parts.append(
            f'<div style="margin:0 0 16px;padding:16px;background:{_BG};border-radius:8px;text-align:center;'
            f'font-size:28px;font-weight:700;letter-spacing:4px;color:{_INK};">{e(highlight)}</div>'
        )
    if cta_label and cta_url:
        parts.append(
            f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr><td '
            f'style="border-radius:8px;background:{_ACCENT};"><a href="{e(cta_url)}" '
            f'style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;'
            f'text-decoration:none;">{e(cta_label)}</a></td></tr></table>'
        )
        parts.append(
            f'<p style="margin:0 0 16px;font-size:12px;color:{_MUTED};word-break:break-all;">'
            f'Or paste this link: <a href="{e(cta_url)}" style="color:{_ACCENT};">{e(cta_url)}</a></p>'
        )
    if outro:
        parts.append(f'<p style="margin:0;font-size:12px;line-height:1.5;color:{_MUTED};">{e(outro)}</p>')
    parts += [
        '</td></tr>',
        f'<tr><td style="padding:16px 28px;background:{_BG};font-size:11px;color:{_MUTED};">'
        'You received this because someone used your address on SafeIQ. '
        'If that wasn\'t expected, you can ignore this message.</td></tr>',
        '</table></td></tr></table></div>',
    ]
    return "".join(parts)
