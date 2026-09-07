"""Milestone 4 Phase 4 - aggregated profile + Employee x RAG record +
activity (tasks 107, 33). Read-mostly aggregation over Phase 2 (Rag,
RagAssignment) and Phase 3 (Alert, AlertStageTransition, Action) data.

Deliberate deviation from the spec's §4.3: rather than a denormalised
`RagActivityEvent` feed table written by every Phase 2/3 handler (which
would mean reopening those already-reviewed phases), the `.../overview`
timeline below is a live aggregation query across the three source tables.
At this data volume (one member's history in one RAG) that's a simpler
consistency story than keeping a fourth table in sync, at the cost of one
endpoint doing three queries instead of one - a trade worth calling out
explicitly, not smuggling in silently.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_tenant_db, require_role
from app.models.tenant import (
    Action,
    ActionStatus,
    Alert,
    AlertStageTransition,
    AuditLedgerEntry,
    LoginEvent,
    Rag,
    RagAssignment,
    TeamRole,
    User,
)
from app.schemas.action import ActionResponse
from app.schemas.alert import AlertResponse
from app.schemas.team_profile import (
    AuditLogEntryResponse,
    AuditLogResponse,
    ConversationsStubResponse,
    EmployeeRagRecordResponse,
    MemberProfileResponse,
    OverviewEventResponse,
    OverviewResponse,
    ProfileHeader,
    RagCard,
    SummaryCards,
    TrafficLight,
)
from app.services.risk_dashboard import traffic_light

router = APIRouter(tags=["team-profile"])

_TEAM_MANAGERS = (TeamRole.super_admin, TeamRole.administrator, TeamRole.manager, TeamRole.support)


async def _get_user_or_404(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


async def _get_rag_or_404(db: AsyncSession, rag_id: uuid.UUID) -> Rag:
    rag = await db.get(Rag, rag_id)
    if rag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RAG not found")
    return rag


async def _count(db: AsyncSession, model: type, *conditions: ColumnElement[bool]) -> int:
    result = await db.execute(select(func.count()).select_from(model).where(*conditions))
    return result.scalar_one()


@router.get("/team/{user_id}/profile", response_model=MemberProfileResponse)
async def get_member_profile(
    user_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> MemberProfileResponse:
    user = await _get_user_or_404(db, user_id)

    last_login_result = await db.execute(
        select(LoginEvent.created_at).where(LoginEvent.user_id == user_id).order_by(LoginEvent.created_at.desc()).limit(1)
    )
    header = ProfileHeader(
        id=user.id,
        name=user.name,
        email=user.email,
        job_title=user.job_title,
        team_role=user.team_role,
        status=user.status,
        is_safeguarding_lead=user.is_safeguarding_lead,
        created_at=user.created_at,
        last_login=last_login_result.scalar_one_or_none(),
    )

    assignments_result = await db.execute(
        select(RagAssignment, Rag.name)
        .join(Rag, Rag.id == RagAssignment.rag_id)
        .where(RagAssignment.user_id == user_id, RagAssignment.status == "active")
    )
    assignments = assignments_result.all()

    open_alerts_result = await db.execute(select(Alert).where(Alert.subject_user_id == user_id, Alert.status == "open"))
    open_alerts = list(open_alerts_result.scalars().all())
    open_actions_count = await _count(db, Action, Action.subject_user_id == user_id, Action.status != ActionStatus.completed)

    summary_cards = SummaryCards(
        assigned_rags=len(assignments),
        conversations=0,
        alerts=len(open_alerts),
        open_actions=open_actions_count,
    )

    rag_cards: list[RagCard] = []
    for assignment, rag_name in assignments:
        rag_open_alerts = [alert for alert in open_alerts if alert.rag_id == assignment.rag_id]
        rag_open_actions = await _count(
            db, Action, Action.subject_user_id == user_id, Action.rag_id == assignment.rag_id, Action.status != ActionStatus.completed
        )
        level, label = traffic_light(
            open_alert_severities=[alert.severity for alert in rag_open_alerts], open_action_count=rag_open_actions
        )
        rag_cards.append(
            RagCard(
                rag_id=assignment.rag_id,
                rag_name=rag_name,
                assignment_status=assignment.status,
                alert_owner_id=assignment.alert_owner_id,
                access_code_last4=assignment.access_code[-4:],
                traffic_light=TrafficLight(level=level, label=label),
            )
        )

    return MemberProfileResponse(header=header, summary_cards=summary_cards, rag_cards=rag_cards)


async def _latest_assignment(db: AsyncSession, user_id: uuid.UUID, rag_id: uuid.UUID) -> RagAssignment | None:
    result = await db.execute(
        select(RagAssignment)
        .where(RagAssignment.user_id == user_id, RagAssignment.rag_id == rag_id)
        .order_by(RagAssignment.assigned_at.desc())
    )
    return result.scalars().first()


@router.get("/team/{user_id}/rags/{rag_id}", response_model=EmployeeRagRecordResponse)
async def get_employee_rag_record(
    user_id: uuid.UUID,
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> EmployeeRagRecordResponse:
    user = await _get_user_or_404(db, user_id)
    rag = await _get_rag_or_404(db, rag_id)
    assignment = await _latest_assignment(db, user_id, rag_id)

    open_alerts = await _count(db, Alert, Alert.subject_user_id == user_id, Alert.rag_id == rag_id, Alert.status == "open")
    open_actions = await _count(
        db, Action, Action.subject_user_id == user_id, Action.rag_id == rag_id, Action.status != ActionStatus.completed
    )

    return EmployeeRagRecordResponse(
        user_id=user.id,
        user_name=user.name,
        user_email=user.email,
        rag_id=rag.id,
        rag_name=rag.name,
        assignment_status=assignment.status if assignment else None,
        alert_owner_id=assignment.alert_owner_id if assignment else None,
        access_code_last4=assignment.access_code[-4:] if assignment else None,
        assigned_at=assignment.assigned_at if assignment else None,
        revoked_at=assignment.revoked_at if assignment else None,
        open_alerts=open_alerts,
        open_actions=open_actions,
    )


async def _overview_events(db: AsyncSession, user_id: uuid.UUID, rag_id: uuid.UUID) -> list[OverviewEventResponse]:
    events: list[OverviewEventResponse] = []

    assignments_result = await db.execute(select(RagAssignment).where(RagAssignment.user_id == user_id, RagAssignment.rag_id == rag_id))
    for assignment in assignments_result.scalars().all():
        events.append(
            OverviewEventResponse(
                kind="assignment.created", ref_id=assignment.id, summary="Assigned to this RAG", created_at=assignment.assigned_at
            )
        )
        if assignment.revoked_at is not None:
            events.append(
                OverviewEventResponse(
                    kind="assignment.revoked", ref_id=assignment.id, summary="Assignment revoked", created_at=assignment.revoked_at
                )
            )

    transitions_result = await db.execute(
        select(AlertStageTransition, Alert.id)
        .join(Alert, Alert.id == AlertStageTransition.alert_id)
        .where(Alert.subject_user_id == user_id, Alert.rag_id == rag_id)
    )
    for transition, alert_id in transitions_result.all():
        if transition.from_stage is None:
            events.append(
                OverviewEventResponse(
                    kind="alert.created",
                    ref_id=alert_id,
                    summary=f"Alert opened at {transition.to_stage.value}",
                    created_at=transition.created_at,
                )
            )
        else:
            events.append(
                OverviewEventResponse(
                    kind="alert.advanced",
                    ref_id=alert_id,
                    summary=f"Alert moved to {transition.to_stage.value}",
                    created_at=transition.created_at,
                )
            )

    actions_result = await db.execute(select(Action).where(Action.subject_user_id == user_id, Action.rag_id == rag_id))
    for action in actions_result.scalars().all():
        events.append(
            OverviewEventResponse(
                kind="action.created", ref_id=action.id, summary=f'Action "{action.title}" created', created_at=action.created_at
            )
        )
        if action.status != ActionStatus.open:
            events.append(
                OverviewEventResponse(
                    kind="action.status_changed",
                    ref_id=action.id,
                    summary=f'Action "{action.title}" is now {action.status.value}',
                    created_at=action.updated_at,
                )
            )

    events.sort(key=lambda event: event.created_at, reverse=True)
    return events


@router.get("/team/{user_id}/rags/{rag_id}/overview", response_model=OverviewResponse)
async def get_employee_rag_overview(
    user_id: uuid.UUID,
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> OverviewResponse:
    await _get_user_or_404(db, user_id)
    await _get_rag_or_404(db, rag_id)
    return OverviewResponse(items=await _overview_events(db, user_id, rag_id))


@router.get("/team/{user_id}/rags/{rag_id}/conversations", response_model=ConversationsStubResponse)
async def get_employee_rag_conversations(
    user_id: uuid.UUID,
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> ConversationsStubResponse:
    """Stub until the chat agent (Milestone 6) ships real conversation
    storage. The empty stub is visible to any _TEAM_MANAGERS caller; once
    real content exists, it must be gated behind
    app.api.deps.can_view_conversation_content (task 96) - not wired here
    since there is nothing yet to gate."""
    await _get_user_or_404(db, user_id)
    await _get_rag_or_404(db, rag_id)
    return ConversationsStubResponse()


@router.get("/team/{user_id}/rags/{rag_id}/alerts", response_model=list[AlertResponse])
async def get_employee_rag_alerts(
    user_id: uuid.UUID,
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[Alert]:
    await _get_user_or_404(db, user_id)
    await _get_rag_or_404(db, rag_id)
    result = await db.execute(
        select(Alert).where(Alert.subject_user_id == user_id, Alert.rag_id == rag_id).order_by(Alert.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/team/{user_id}/rags/{rag_id}/actions", response_model=list[ActionResponse])
async def get_employee_rag_actions(
    user_id: uuid.UUID,
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[Action]:
    await _get_user_or_404(db, user_id)
    await _get_rag_or_404(db, rag_id)
    result = await db.execute(
        select(Action)
        .where(Action.subject_user_id == user_id, Action.rag_id == rag_id)
        .order_by(Action.due_date.nulls_last(), Action.created_at)
    )
    return list(result.scalars().all())


async def _relevant_audit_subject_ids(db: AsyncSession, user_id: uuid.UUID, rag_id: uuid.UUID) -> list[uuid.UUID]:
    subject_ids: list[uuid.UUID] = [user_id]

    assignment_ids = await db.execute(select(RagAssignment.id).where(RagAssignment.user_id == user_id, RagAssignment.rag_id == rag_id))
    subject_ids.extend(assignment_ids.scalars().all())

    alert_ids = await db.execute(select(Alert.id).where(Alert.subject_user_id == user_id, Alert.rag_id == rag_id))
    subject_ids.extend(alert_ids.scalars().all())

    action_ids = await db.execute(select(Action.id).where(Action.subject_user_id == user_id, Action.rag_id == rag_id))
    subject_ids.extend(action_ids.scalars().all())

    return subject_ids


@router.get("/team/{user_id}/rags/{rag_id}/audit-log", response_model=AuditLogResponse)
async def get_employee_rag_audit_log(
    user_id: uuid.UUID,
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AuditLogResponse:
    """Content-free projection of the audit ledger (ADR-005 never stores raw
    content anyway - only a hash - so there is nothing to accidentally leak
    here, but the response shape itself never carries a `content` key,
    matching the client's ask for a separate, content-free audit log)."""
    await _get_user_or_404(db, user_id)
    await _get_rag_or_404(db, rag_id)

    subject_ids = await _relevant_audit_subject_ids(db, user_id, rag_id)
    result = await db.execute(
        select(AuditLedgerEntry).where(AuditLedgerEntry.subject_id.in_(subject_ids)).order_by(AuditLedgerEntry.id.desc())
    )
    entries = list(result.scalars().all())

    owner_ids = {entry.owner_id for entry in entries if entry.owner_id is not None}
    owners: dict[uuid.UUID, str] = {}
    if owner_ids:
        owner_rows = await db.execute(select(User.id, User.name).where(User.id.in_(owner_ids)))
        owners = {row.id: row.name for row in owner_rows.all()}

    items = [
        AuditLogEntryResponse(
            event_type=entry.event_type,
            owner=owners.get(entry.owner_id, "System") if entry.owner_id else "System",
            created_at=entry.created_at,
        )
        for entry in entries
    ]
    return AuditLogResponse(items=items)
