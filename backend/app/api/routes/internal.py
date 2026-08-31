"""SafeIQ Internal console - cross-tenant support staff (control.internal_users).

Milestone 3 gives these accounts ownership of the onboarding CMS (tasks 21-22);
tenant users only ever consume it (tasks 23-26, in routes/onboarding.py). This
module currently carries just auth - the CMS routes land here in phase 4.

There is no self-service signup for internal accounts by design: create them
with `python -m scripts.seed_internal_user`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentInternalUser, get_current_internal_user
from app.core.security import create_internal_token, verify_password
from app.db.control_models import InternalUser
from app.db.session import get_control_session_dep
from app.schemas.internal import InternalLoginRequest, InternalTokenResponse, InternalUserResponse

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/auth/login", response_model=InternalTokenResponse)
async def internal_login(
    payload: InternalLoginRequest,
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> InternalTokenResponse:
    result = await control_db.execute(select(InternalUser).where(InternalUser.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return InternalTokenResponse(
        access_token=create_internal_token(subject=str(user.id)),
        refresh_token=create_internal_token(subject=str(user.id), token_type="refresh"),
    )


@router.get("/me", response_model=InternalUserResponse)
async def internal_me(current: CurrentInternalUser = Depends(get_current_internal_user)) -> CurrentInternalUser:
    return current
