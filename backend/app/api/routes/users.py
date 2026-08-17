from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_tenant_db, require_role
from app.models.tenant import LoginEvent, PersonAlertRule, TeamNote, TeamRole, User
from app.schemas.user import (
    CreateNoteRequest,
    CreatePersonAlertRuleRequest,
    LoginEventResponse,
    PersonAlertRuleResponse,
    TeamNoteResponse,
    UpdateRoleRequest,
    UpdateSettingsRequest,
    UserProfile,
)
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


@router.get("/team/login-history", response_model=list[LoginEventResponse])
async def list_login_history(
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
    q: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 200,
) -> list[LoginEventResponse]:
    """Registered before /team/{user_id} deliberately - FastAPI matches path
    templates in registration order, and this literal segment would
    otherwise be swallowed by that parameterised route."""
    stmt = select(LoginEvent, User.name, User.email).join(User, User.id == LoginEvent.user_id).order_by(LoginEvent.created_at.desc())
    if user_id is not None:
        stmt = stmt.where(LoginEvent.user_id == user_id)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where((func.lower(User.name).like(like)) | (func.lower(User.email).like(like)))
    stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    return [
        LoginEventResponse(
            id=event.id, user_id=event.user_id, user_name=name, ip=event.ip, user_agent=event.user_agent, created_at=event.created_at
        )
        for event, name, _email in result.all()
    ]


@router.get("/team/{user_id}", response_model=UserProfile)
async def get_team_member(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


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


async def _note_response(db: AsyncSession, note: TeamNote) -> TeamNoteResponse:
    author = await db.get(User, note.author_id)
    return TeamNoteResponse(
        id=note.id,
        subject_user_id=note.subject_user_id,
        author_id=note.author_id,
        author_name=author.name if author else "Unknown",
        text=note.text,
        created_at=note.created_at,
    )


@router.get("/team/{user_id}/notes", response_model=list[TeamNoteResponse])
async def list_notes(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[TeamNoteResponse]:
    result = await db.execute(select(TeamNote).where(TeamNote.subject_user_id == user_id).order_by(TeamNote.created_at.desc()))
    return [await _note_response(db, note) for note in result.scalars().all()]


@router.post("/team/{user_id}/notes", response_model=TeamNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    user_id: uuid.UUID,
    payload: CreateNoteRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> TeamNoteResponse:
    subject = await db.get(User, user_id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    note = TeamNote(subject_user_id=user_id, author_id=current_user.id, text=payload.text)
    db.add(note)
    await db.flush()
    await audit_service.record_event(
        db, event_type="team_note.created", subject_id=user_id, owner_id=current_user.id, content={"note_id": str(note.id)}
    )
    return await _note_response(db, note)


@router.get("/team/{user_id}/alert-rules", response_model=list[PersonAlertRuleResponse])
async def list_alert_rules(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[PersonAlertRule]:
    result = await db.execute(
        select(PersonAlertRule).where(PersonAlertRule.subject_user_id == user_id).order_by(PersonAlertRule.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/team/{user_id}/alert-rules", response_model=PersonAlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    user_id: uuid.UUID,
    payload: CreatePersonAlertRuleRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> PersonAlertRule:
    subject = await db.get(User, user_id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    rule = PersonAlertRule(
        subject_user_id=user_id,
        category=payload.category,
        severity=payload.severity,
        notify_email=payload.notify_email,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.flush()
    await audit_service.record_event(
        db,
        event_type="person_alert_rule.created",
        subject_id=user_id,
        owner_id=current_user.id,
        content={"category": rule.category, "severity": rule.severity.value},
    )
    return rule


@router.delete("/team/{user_id}/alert-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    user_id: uuid.UUID,
    rule_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    rule = await db.get(PersonAlertRule, rule_id)
    if rule is None or rule.subject_user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert rule not found")

    await audit_service.record_event(
        db, event_type="person_alert_rule.deleted", subject_id=user_id, owner_id=current_user.id, content={"category": rule.category}
    )
    await db.delete(rule)
    await db.flush()
