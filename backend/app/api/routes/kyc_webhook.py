"""Sumsub verification-result webhook.

Sumsub verification is asynchronous: `POST /auth/kyc/start` only opens a session,
and the real GREEN/RED outcome is delivered here later. Unauthenticated by design
(Sumsub calls it) but the body is HMAC-verified with the shared webhook secret.

There is no tenant context on the request, so `externalUserId` carries
`"{org_id}:{user_id}"` (set in routes/auth.py) and we resolve the schema from the
control-plane organisation registry.
"""

from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.control_models import Organisation
from app.db.session import get_control_session_dep, tenant_session
from app.models.tenant import KycRecord, User
from app.services import audit as audit_service
from app.services.kyc import review_answer_to_status, verify_webhook_signature

logger = logging.getLogger("safeiq.kyc")

router = APIRouter(prefix="/kyc", tags=["kyc"])

_ACTIONABLE_EVENTS = {"applicantReviewed", "applicantWorkflowCompleted"}


@router.post("/webhook")
async def sumsub_webhook(request: Request, control_db: AsyncSession = Depends(get_control_session_dep)) -> dict:
    raw = await request.body()
    settings = get_settings()

    digest = request.headers.get("x-payload-digest", "")
    algo = request.headers.get("x-payload-digest-alg", "HMAC_SHA256_HEX")
    verified = bool(settings.sumsub_webhook_secret) and verify_webhook_signature(
        raw, digest, settings.sumsub_webhook_secret, algo
    )
    if not verified and not settings.kyc_allow_unverified_webhook_approval:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook signature")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Malformed webhook body") from exc

    event_type = payload.get("type")
    if event_type not in _ACTIONABLE_EVENTS:
        return {"ok": True, "ignored": event_type}

    org_id_str, _, user_id_str = str(payload.get("externalUserId", "")).partition(":")
    try:
        org_id = uuid.UUID(org_id_str)
        user_id = uuid.UUID(user_id_str)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unrecognised externalUserId") from exc

    org = await control_db.get(Organisation, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organisation not found")

    status_value = review_answer_to_status(payload.get("reviewResult", {}).get("reviewAnswer"))
    applicant_id = payload.get("applicantId")

    tenant_db = tenant_session(org.tenant_schema)
    try:
        user = await tenant_db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

        record: KycRecord | None = None
        if applicant_id:
            record = (
                await tenant_db.execute(select(KycRecord).where(KycRecord.provider_session_id == applicant_id))
            ).scalar_one_or_none()
        if record is None:
            record = (
                await tenant_db.execute(
                    select(KycRecord).where(KycRecord.user_id == user_id).order_by(KycRecord.created_at.desc())
                )
            ).scalars().first()
        if record is not None:
            record.status = status_value
            record.raw_result = payload

        user.kyc_status = status_value
        if status_value == "approved":
            await audit_service.record_event(tenant_db, event_type="user.kyc_approved", subject_id=user.id, owner_id=user.id)
        elif status_value == "rejected":
            await audit_service.record_event(tenant_db, event_type="user.kyc_rejected", subject_id=user.id, owner_id=user.id)
        await tenant_db.commit()
    except HTTPException:
        await tenant_db.rollback()
        raise
    finally:
        await tenant_db.close()

    logger.info("KYC webhook: user=%s -> %s", user_id, status_value)
    return {"ok": True, "status": status_value}
