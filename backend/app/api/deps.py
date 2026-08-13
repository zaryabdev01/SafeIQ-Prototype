from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import tenant_session
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


def require_role(*roles: TeamRole):
    """FastAPI dependency factory: `Depends(require_role(TeamRole.super_admin))`."""

    async def _dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role doesn't permit this action")
        return current_user

    return _dependency
