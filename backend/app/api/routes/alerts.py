from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_tenant_db, require_role
from app.db.base import utcnow
from app.models.tenant import ALERT_STAGE_ORDER, Alert, AlertSeverity, AlertStage, AlertStageTransition, TeamRole
from app.schemas.alert import (
    AdvanceAlertRequest,
    AlertDetailResponse,
    AlertResponse,
    CreateAlertRequest,
    StageTransitionResponse,
    UpdateAlertRequest,
)
from app.services import audit as audit_service

router = APIRouter(prefix="/alerts", tags=["alerts"])

_TEAM_MANAGERS = (TeamRole.super_admin, TeamRole.administrator, TeamRole.manager, TeamRole.support)


async def _detail_response(db: AsyncSession, alert: Alert) -> AlertDetailResponse:
    result = await db.execute(
        select(AlertStageTransition).where(AlertStageTransition.alert_id == alert.id).order_by(AlertStageTransition.created_at)
    )
    transitions = [StageTransitionResponse.model_validate(t) for t in result.scalars().all()]
    return AlertDetailResponse(**AlertResponse.model_validate(alert).model_dump(), stage_transitions=transitions)


@router.post("", response_model=AlertDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: CreateAlertRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AlertDetailResponse:
    """No RAG engine generates these yet, so this milestone infers the
    starting stage from whether a `keyword` was supplied - the same signal
    Milestone 5's automatic keyword detection will eventually use to create
    these itself, into the same table (see Alert's docstring)."""
    initial_stage = AlertStage.keyword_detected if payload.keyword else AlertStage.signal_generated
    alert = Alert(
        subject_user_id=payload.subject_user_id,
        rag_id=payload.rag_id,
        keyword=payload.keyword,
        stage=initial_stage,
        severity=payload.severity,
        context=payload.context,
        created_by=current_user.id,
    )
    db.add(alert)
    await db.flush()

    db.add(AlertStageTransition(alert_id=alert.id, from_stage=None, to_stage=initial_stage, actor_id=current_user.id))
    await audit_service.record_event(
        db,
        event_type="alert.created",
        subject_id=alert.id,
        owner_id=current_user.id,
        content={"subject_user_id": str(alert.subject_user_id), "stage": initial_stage.value},
    )
    await db.flush()
    return await _detail_response(db, alert)


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
    subject_user_id: uuid.UUID | None = None,
    rag_id: uuid.UUID | None = None,
    stage: AlertStage | None = None,
    severity: AlertSeverity | None = None,
    alert_status: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Alert]:
    stmt = select(Alert).order_by(Alert.created_at.desc())
    if subject_user_id is not None:
        stmt = stmt.where(Alert.subject_user_id == subject_user_id)
    if rag_id is not None:
        stmt = stmt.where(Alert.rag_id == rag_id)
    if stage is not None:
        stmt = stmt.where(Alert.stage == stage)
    if severity is not None:
        stmt = stmt.where(Alert.severity == severity)
    if alert_status is not None:
        stmt = stmt.where(Alert.status == alert_status)
    if q and q.strip():
        stmt = stmt.where(func.lower(Alert.keyword).like(f"%{q.strip().lower()}%"))
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{alert_id}", response_model=AlertDetailResponse)
async def get_alert(
    alert_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AlertDetailResponse:
    alert = await db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    return await _detail_response(db, alert)


@router.post("/{alert_id}/advance", response_model=AlertDetailResponse)
async def advance_alert(
    alert_id: uuid.UUID,
    payload: AdvanceAlertRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AlertDetailResponse:
    alert = await db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")

    current_index = ALERT_STAGE_ORDER.index(alert.stage)
    target_index = ALERT_STAGE_ORDER.index(payload.to_stage)
    if target_index <= current_index:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Alerts can only move forward through stages")

    if payload.to_stage == AlertStage.outcome:
        if payload.outcome is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "outcome is required when advancing to the outcome stage")
        alert.outcome = payload.outcome
        alert.status = "closed"
        alert.closed_at = utcnow()
        alert.closed_by = current_user.id

    if payload.severity is not None:
        alert.severity = payload.severity
    if payload.context is not None:
        alert.context = payload.context

    from_stage = alert.stage
    alert.stage = payload.to_stage
    db.add(
        AlertStageTransition(
            alert_id=alert.id, from_stage=from_stage, to_stage=payload.to_stage, note=payload.note, actor_id=current_user.id
        )
    )

    await audit_service.record_event(
        db,
        event_type="alert.advanced",
        subject_id=alert.id,
        owner_id=current_user.id,
        content={
            "from_stage": from_stage.value,
            "to_stage": payload.to_stage.value,
            "outcome": payload.outcome.value if payload.outcome else None,
        },
    )
    await db.flush()
    return await _detail_response(db, alert)


@router.patch("/{alert_id}", response_model=AlertDetailResponse)
async def update_alert(
    alert_id: uuid.UUID,
    payload: UpdateAlertRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AlertDetailResponse:
    alert = await db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")

    if ALERT_STAGE_ORDER.index(alert.stage) >= ALERT_STAGE_ORDER.index(AlertStage.human_review):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This alert has reached human review and can no longer be edited directly - use /advance"
        )

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(alert, field, value)

    await audit_service.record_event(db, event_type="alert.updated", subject_id=alert.id, owner_id=current_user.id, content=updates)
    await db.flush()
    return await _detail_response(db, alert)
