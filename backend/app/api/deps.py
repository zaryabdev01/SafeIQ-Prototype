from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.control_models import InternalUser
from app.db.session import get_control_session_dep, tenant_session
from app.models.tenant import TeamRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


@dataclass
class CurrentUser:
    id: uuid.UUID
    org_id: uuid.UUID
    tenant_schema: str
    role: TeamRole


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> CurrentUser:
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This token cannot be used to call the API")
    if payload.get("scope") == "internal":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "A SafeIQ Internal token cannot be used for tenant API calls")

    return CurrentUser(
        id=uuid.UUID(payload["sub"]),
        org_id=uuid.UUID(payload["org_id"]),
        tenant_schema=payload["tenant_schema"],
        role=TeamRole(payload["role"]),
    )


async def get_tenant_db(current_user: CurrentUser = Depends(get_current_user)) -> AsyncIterator[AsyncSession]:
    session = tenant_session(current_user.tenant_schema)
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


@dataclass
class CurrentInternalUser:
    id: uuid.UUID
    email: str
    name: str


async def get_current_internal_user(
    token: str | None = Depends(oauth2_scheme),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> CurrentInternalUser:
    """Authenticates a SafeIQ Internal console account. Mirrors
    `get_current_user` but resolves against `control.internal_users` and
    requires the `internal` scope - a tenant access token is rejected."""
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    if payload.get("type") != "access" or payload.get("scope") != "internal":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This token is not valid for the SafeIQ Internal console")

    user = await control_db.get(InternalUser, uuid.UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account no longer exists")
    return CurrentInternalUser(id=user.id, email=user.email, name=user.name)


def require_role(*roles: TeamRole):
    """FastAPI dependency factory: `Depends(require_role(TeamRole.super_admin))`."""

    async def _dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role doesn't permit this action")
        return current_user

    return _dependency


def can_view_conversation_content(role: TeamRole, is_safeguarding_lead: bool) -> bool:
    """Milestone 4, task 96. Mirrors
    frontend/src/lib/permissions.ts::canViewConversationContent - a line
    manager sees alert/action summaries, but only a Safeguarding Lead (or an
    org admin) may open raw conversation text. `is_safeguarding_lead` isn't in
    the JWT (it can change after a token was issued), so a caller resolves it
    with a DB lookup rather than trusting a claim - see the Phase 4
    `require_conversation_access` dependency that will wrap this once the
    Conversations tab has real content to gate."""
    return role in (TeamRole.super_admin, TeamRole.administrator) or is_safeguarding_lead
