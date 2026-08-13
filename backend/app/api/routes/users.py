from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_tenant_db, require_role
from app.models.tenant import TeamRole, User
from app.schemas.user import UpdateRoleRequest, UpdateSettingsRequest, UserProfile
from app.services import audit as audit_service

router = APIRouter(tags=["users"])

_TEAM_MANAGERS = (TeamRole.super_admin, TeamRole.administrator, TeamRole.manager, TeamRole.support)
_ROLE_ADMINS = (TeamRole.super_admin, TeamRole.administrator)


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_tenant_db)) -> User:
    user = await db.get(User, current_user.id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.patch("/me/settings", response_model=UserProfile)
async def update_my_settings(
    payload: UpdateSettingsRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
) -> User:
    user = await db.get(User, current_user.id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    await audit_service.record_event(db, event_type="user.settings_updated", subject_id=user.id, owner_id=user.id, content=updates)
    await db.flush()
    return user


@router.get("/team", response_model=list[UserProfile])
async def list_team(
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at))
    return list(result.scalars().all())


@router.patch("/team/{user_id}/role", response_model=UserProfile)
async def update_role(
    user_id: uuid.UUID,
    payload: UpdateRoleRequest,
    current_user: CurrentUser = Depends(require_role(*_ROLE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    old_role = user.team_role
    user.team_role = payload.role
    await audit_service.record_event(
        db,
        event_type="user.role_changed",
        subject_id=user.id,
        owner_id=current_user.id,
        content={"old_role": old_role.value, "new_role": payload.role.value},
    )
    await db.flush()
    return user
