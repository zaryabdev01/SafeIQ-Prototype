from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_tenant_db, require_role
from app.db.base import utcnow
from app.models.tenant import Action, ActionPriority, ActionStatus, ActionTier, TeamRole
from app.schemas.action import ActionResponse, CreateActionRequest, UpdateActionRequest
from app.services import audit as audit_service

router = APIRouter(prefix="/actions", tags=["actions"])

_TEAM_MANAGERS = (TeamRole.super_admin, TeamRole.administrator, TeamRole.manager, TeamRole.support)


@router.post("", response_model=ActionResponse, status_code=status.HTTP_201_CREATED)
async def create_action(
    payload: CreateActionRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> Action:
    action = Action(
        title=payload.title,
        description=payload.description,
        tier=payload.tier,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        subject_user_id=payload.subject_user_id,
        rag_id=payload.rag_id,
        alert_id=payload.alert_id,
        due_date=payload.due_date,
        created_by=current_user.id,
    )
    db.add(action)
    await db.flush()
    await audit_service.record_event(
        db,
        event_type="action.created",
        subject_id=action.id,
        owner_id=current_user.id,
        content={"title": action.title, "tier": action.tier},
    )
    return action


@router.get("", response_model=list[ActionResponse])
async def list_actions(
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
    assignee_id: uuid.UUID | None = None,
    subject_user_id: uuid.UUID | None = None,
    rag_id: uuid.UUID | None = None,
    action_status: ActionStatus | None = Query(default=None, alias="status"),
    tier: ActionTier | None = None,
    priority: ActionPriority | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Action]:
    stmt = select(Action).order_by(Action.due_date.nulls_last(), Action.created_at)
    if assignee_id is not None:
        stmt = stmt.where(Action.assignee_id == assignee_id)
    if subject_user_id is not None:
        stmt = stmt.where(Action.subject_user_id == subject_user_id)
    if rag_id is not None:
        stmt = stmt.where(Action.rag_id == rag_id)
    if action_status is not None:
        stmt = stmt.where(Action.status == action_status)
    if tier is not None:
        stmt = stmt.where(Action.tier == tier)
    if priority is not None:
        stmt = stmt.where(Action.priority == priority)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where((func.lower(Action.title).like(like)) | (func.lower(Action.description).like(like)))
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{action_id}", response_model=ActionResponse)
async def get_action(
    action_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> Action:
    action = await db.get(Action, action_id)
    if action is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action not found")
    return action


@router.patch("/{action_id}", response_model=ActionResponse)
async def update_action(
    action_id: uuid.UUID,
    payload: UpdateActionRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> Action:
    action = await db.get(Action, action_id)
    if action is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action not found")

    updates = payload.model_dump(exclude_unset=True)
    new_status = updates.pop("status", None)

    if updates:
        for field, value in updates.items():
            setattr(action, field, value)
        await audit_service.record_event(db, event_type="action.updated", subject_id=action.id, owner_id=current_user.id, content=updates)

    if new_status is not None and new_status != action.status:
        old_status = action.status
        action.status = new_status
        action.completed_at = utcnow() if new_status == ActionStatus.completed else None
        await audit_service.record_event(
            db,
            event_type="action.status_changed",
            subject_id=action.id,
            owner_id=current_user.id,
            content={"old": old_status, "new": new_status},
        )

    await db.flush()
    return action


@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    action = await db.get(Action, action_id)
    if action is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action not found")

    await audit_service.record_event(
        db, event_type="action.deleted", subject_id=action.id, owner_id=current_user.id, content={"title": action.title}
    )
    await db.delete(action)
    await db.flush()
