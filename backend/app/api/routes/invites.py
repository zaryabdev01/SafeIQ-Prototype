from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_tenant_db, require_role
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.db.control_models import InviteIndexEntry, Organisation, UserDirectoryEntry
from app.db.session import get_control_session_dep, tenant_session
from app.models.tenant import Invite, TeamRole, User
from app.schemas.auth import TokenResponse
from app.schemas.invite import AcceptInviteRequest, CreateInviteRequest, InvitePreview, InviteResponse
from app.services import audit as audit_service
from app.services.email import EmailSender, get_email_sender

router = APIRouter(prefix="/invites", tags=["invites"])

_INVITE_ADMINS = (TeamRole.super_admin, TeamRole.administrator)


def _generate_token() -> str:
    return secrets.token_urlsafe(24)


def _to_response(invite: Invite) -> InviteResponse:
    link = f"{get_settings().magic_link_base_url}/{invite.token}"
    return InviteResponse(
        id=invite.id,
        token=invite.token,
        link=link,
        email=invite.email,
        role=invite.role,
        status=invite.status,
        expires_at=invite.expires_at,
    )


@router.post("", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    payload: CreateInviteRequest,
    current_user: CurrentUser = Depends(require_role(*_INVITE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
    control_db: AsyncSession = Depends(get_control_session_dep),
    email_sender: EmailSender = Depends(get_email_sender),
) -> InviteResponse:
    settings = get_settings()
    invite = Invite(
        email=payload.email.lower() if payload.email else None,
        token=_generate_token(),
        role=payload.role,
        invited_by=current_user.id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.invite_expire_days),
    )
    db.add(invite)
    await db.flush()
    await audit_service.record_event(
        db,
        event_type="invite.created",
        subject_id=invite.id,
        owner_id=current_user.id,
        content={"email": invite.email, "role": invite.role.value},
    )

    control_db.add(InviteIndexEntry(token=invite.token, org_id=current_user.org_id))
    await control_db.commit()

    response = _to_response(invite)
    if invite.email:
        await email_sender.send(to=invite.email, subject="You're invited to join SafeIQ", body=f"Join here: {response.link}")
    return response


@router.get("", response_model=list[InviteResponse])
async def list_invites(
    current_user: CurrentUser = Depends(require_role(*_INVITE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[InviteResponse]:
    result = await db.execute(select(Invite).order_by(Invite.created_at.desc()))
    return [_to_response(invite) for invite in result.scalars().all()]


@router.post("/{token}/resend", response_model=InviteResponse)
async def resend_invite(
    token: str,
    current_user: CurrentUser = Depends(require_role(*_INVITE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
    email_sender: EmailSender = Depends(get_email_sender),
) -> InviteResponse:
    result = await db.execute(select(Invite).where(Invite.token == token))
    invite = result.scalar_one_or_none()
    if invite is None or invite.status != "pending":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found or no longer pending")

    response = _to_response(invite)
    if invite.email:
        await email_sender.send(to=invite.email, subject="Reminder: you're invited to join SafeIQ", body=f"Join here: {response.link}")
    await audit_service.record_event(db, event_type="invite.resent", subject_id=invite.id, owner_id=current_user.id)
    return response


@router.post("/{token}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invite(
    token: str,
    current_user: CurrentUser = Depends(require_role(*_INVITE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    result = await db.execute(select(Invite).where(Invite.token == token))
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")

    invite.status = "cancelled"
    invite.responded_at = datetime.now(UTC)
    await audit_service.record_event(db, event_type="invite.cancelled", subject_id=invite.id, owner_id=current_user.id)
    await db.flush()


@router.get("/{token}", response_model=InvitePreview)
async def preview_invite(token: str, control_db: AsyncSession = Depends(get_control_session_dep)) -> InvitePreview:
    """Unauthenticated by design - the invitee hasn't signed in yet. The
    control-plane index (not the tenant table itself) is what lets this
    resolve which organisation the token belongs to."""
    index = await control_db.get(InviteIndexEntry, token)
    if index is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    org = await control_db.get(Organisation, index.org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")

    tenant_db = tenant_session(org.tenant_schema)
    try:
        result = await tenant_db.execute(select(Invite).where(Invite.token == token))
        invite = result.scalar_one_or_none()
        if invite is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
        return InvitePreview(organisation_name=org.name, role=invite.role, email=invite.email, status=invite.status)
    finally:
        await tenant_db.close()


@router.post("/{token}/accept", response_model=TokenResponse)
async def accept_invite(
    token: str, payload: AcceptInviteRequest, control_db: AsyncSession = Depends(get_control_session_dep)
) -> TokenResponse:
    index = await control_db.get(InviteIndexEntry, token)
    if index is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    org = await control_db.get(Organisation, index.org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")

    tenant_db = tenant_session(org.tenant_schema)
    try:
        result = await tenant_db.execute(select(Invite).where(Invite.token == token))
        invite = result.scalar_one_or_none()
        if invite is None or invite.status != "pending" or invite.expires_at < datetime.now(UTC):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This invite is no longer valid")

        email = (invite.email or (payload.email.lower() if payload.email else None))
        if email is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email is required to accept a shareable invite")

        existing = await tenant_db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists in this organisation")

        user = User(
            name=payload.full_name,
            email=email,
            password_hash=hash_password(payload.password),
            team_role=invite.role,
            email_verified=True,  # the invite email itself is treated as the verification step
        )
        tenant_db.add(user)
        await tenant_db.flush()

        invite.status = "accepted"
        invite.accepted_by = user.id
        invite.responded_at = datetime.now(UTC)

        await audit_service.record_event(tenant_db, event_type="invite.accepted", subject_id=invite.id, owner_id=user.id)
        await audit_service.record_event(
            tenant_db,
            event_type="user.registered",
            subject_id=user.id,
            owner_id=user.id,
            content={"via": "invite", "role": user.team_role.value},
        )
        await tenant_db.commit()
    except HTTPException:
        await tenant_db.rollback()
        raise
    finally:
        await tenant_db.close()

    control_db.add(UserDirectoryEntry(email=user.email, org_id=org.id, user_id=user.id))
    await control_db.commit()

    settings = get_settings()
    access = create_access_token(subject=str(user.id), org_id=str(org.id), tenant_schema=org.tenant_schema, role=user.team_role.value)
    refresh = create_access_token(
        subject=str(user.id),
        org_id=str(org.id),
        tenant_schema=org.tenant_schema,
        role=user.team_role.value,
        token_type="refresh",
        expires_minutes=settings.refresh_token_expire_minutes,
    )
    return TokenResponse(access_token=access, refresh_token=refresh)
