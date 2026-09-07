from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_tenant_db, require_role
from app.db.base import utcnow
from app.models.tenant import Rag, RagAssignment, RagStatus, TeamRole, User
from app.schemas.rag import (
    AssignmentResponse,
    AssignmentWithCodeResponse,
    CreateAssignmentRequest,
    CreateRagRequest,
    RagResponse,
    UpdateAssignmentRequest,
    UpdateRagRequest,
)
from app.services import audit as audit_service
from app.services.access_code import generate_unique_access_code

router = APIRouter(prefix="/rags", tags=["rags"])

_ROLE_ADMINS = (TeamRole.super_admin, TeamRole.administrator)
_TEAM_MANAGERS = (TeamRole.super_admin, TeamRole.administrator, TeamRole.manager, TeamRole.support)


def _to_assignment_response(
    assignment: RagAssignment,
    *,
    rag_name: str | None = None,
    user_name: str | None = None,
    user_email: str | None = None,
) -> AssignmentResponse:
    return AssignmentResponse(
        id=assignment.id,
        rag_id=assignment.rag_id,
        rag_name=rag_name,
        user_id=assignment.user_id,
        user_name=user_name,
        user_email=user_email,
        access_code_last4=assignment.access_code[-4:],
        status=assignment.status,
        alert_owner_id=assignment.alert_owner_id,
        assigned_by=assignment.assigned_by,
        assigned_at=assignment.assigned_at,
        revoked_at=assignment.revoked_at,
    )


@router.post("", response_model=RagResponse, status_code=status.HTTP_201_CREATED)
async def create_rag(
    payload: CreateRagRequest,
    current_user: CurrentUser = Depends(require_role(*_ROLE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> Rag:
    rag = Rag(name=payload.name, description=payload.description, created_by=current_user.id)
    db.add(rag)
    await db.flush()
    await audit_service.record_event(
        db, event_type="rag.created", subject_id=rag.id, owner_id=current_user.id, content={"name": rag.name}
    )
    return rag


@router.get("", response_model=list[RagResponse])
async def list_rags(
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
    q: str | None = None,
    rag_status: RagStatus | None = Query(default=None, alias="status"),
) -> list[Rag]:
    stmt = select(Rag).order_by(Rag.created_at.desc())
    if rag_status is not None:
        stmt = stmt.where(Rag.status == rag_status)
    if q and q.strip():
        stmt = stmt.where(func.lower(Rag.name).like(f"%{q.strip().lower()}%"))

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{rag_id}", response_model=RagResponse)
async def get_rag(
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> Rag:
    rag = await db.get(Rag, rag_id)
    if rag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RAG not found")
    return rag


@router.patch("/{rag_id}", response_model=RagResponse)
async def update_rag(
    rag_id: uuid.UUID,
    payload: UpdateRagRequest,
    current_user: CurrentUser = Depends(require_role(*_ROLE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> Rag:
    rag = await db.get(Rag, rag_id)
    if rag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RAG not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(rag, field, value)

    await audit_service.record_event(db, event_type="rag.updated", subject_id=rag.id, owner_id=current_user.id, content=updates)
    await db.flush()
    return rag


@router.delete("/{rag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rag(
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_ROLE_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    rag = await db.get(Rag, rag_id)
    if rag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RAG not found")
    if rag.status != RagStatus.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a draft RAG can be deleted")

    has_assignment = await db.execute(select(RagAssignment.id).where(RagAssignment.rag_id == rag_id).limit(1))
    if has_assignment.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete a RAG that has assignments")

    await audit_service.record_event(db, event_type="rag.deleted", subject_id=rag.id, owner_id=current_user.id, content={"name": rag.name})
    await db.delete(rag)
    await db.flush()


@router.post("/{rag_id}/assignments", response_model=AssignmentWithCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    rag_id: uuid.UUID,
    payload: CreateAssignmentRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AssignmentWithCodeResponse:
    rag = await db.get(Rag, rag_id)
    if rag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RAG not found")
    subject = await db.get(User, payload.user_id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    existing = await db.execute(
        select(RagAssignment.id).where(
            RagAssignment.rag_id == rag_id, RagAssignment.user_id == payload.user_id, RagAssignment.status == "active"
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This person already has an active assignment to this RAG")

    assignment = RagAssignment(
        rag_id=rag_id,
        user_id=payload.user_id,
        access_code=await generate_unique_access_code(db),
        alert_owner_id=payload.alert_owner_id,
        assigned_by=current_user.id,
    )
    db.add(assignment)
    try:
        await db.flush()
    except IntegrityError:
        # DB-level backstop for the same race the check above already covers -
        # see RagAssignment's docstring.
        raise HTTPException(status.HTTP_409_CONFLICT, "This person already has an active assignment to this RAG") from None

    await audit_service.record_event(
        db,
        event_type="rag_assignment.created",
        subject_id=assignment.id,
        owner_id=current_user.id,
        content={"rag_id": str(rag_id), "user_id": str(payload.user_id)},
    )
    return AssignmentWithCodeResponse(
        **_to_assignment_response(assignment, rag_name=rag.name, user_name=subject.name, user_email=subject.email).model_dump(),
        access_code=assignment.access_code,
    )


@router.get("/{rag_id}/assignments", response_model=list[AssignmentResponse])
async def list_rag_assignments(
    rag_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[AssignmentResponse]:
    rag = await db.get(Rag, rag_id)
    if rag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RAG not found")

    stmt = (
        select(RagAssignment, User.name, User.email)
        .join(User, User.id == RagAssignment.user_id)
        .where(RagAssignment.rag_id == rag_id)
        .order_by(RagAssignment.assigned_at.desc())
    )
    result = await db.execute(stmt)
    return [
        _to_assignment_response(assignment, rag_name=rag.name, user_name=name, user_email=email)
        for assignment, name, email in result.all()
    ]


async def _get_assignment_or_404(db: AsyncSession, rag_id: uuid.UUID, assignment_id: uuid.UUID) -> RagAssignment:
    assignment = await db.get(RagAssignment, assignment_id)
    if assignment is None or assignment.rag_id != rag_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return assignment


@router.patch("/{rag_id}/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    rag_id: uuid.UUID,
    assignment_id: uuid.UUID,
    payload: UpdateAssignmentRequest,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AssignmentResponse:
    assignment = await _get_assignment_or_404(db, rag_id, assignment_id)

    updates = payload.model_dump(exclude_unset=True)
    if updates.get("status") == "revoked" and assignment.status == "active":
        assignment.status = "revoked"
        assignment.revoked_at = utcnow()
    if "alert_owner_id" in updates:
        assignment.alert_owner_id = updates["alert_owner_id"]

    await audit_service.record_event(
        db, event_type="rag_assignment.updated", subject_id=assignment.id, owner_id=current_user.id, content=updates
    )
    await db.flush()

    subject = await db.get(User, assignment.user_id)
    rag = await db.get(Rag, assignment.rag_id)
    return _to_assignment_response(
        assignment,
        rag_name=rag.name if rag else None,
        user_name=subject.name if subject else None,
        user_email=subject.email if subject else None,
    )


@router.post("/{rag_id}/assignments/{assignment_id}/rotate-code", response_model=AssignmentWithCodeResponse)
async def rotate_assignment_code(
    rag_id: uuid.UUID,
    assignment_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_TEAM_MANAGERS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> AssignmentWithCodeResponse:
    assignment = await _get_assignment_or_404(db, rag_id, assignment_id)

    assignment.access_code = await generate_unique_access_code(db)
    await audit_service.record_event(db, event_type="rag_assignment.code_rotated", subject_id=assignment.id, owner_id=current_user.id)
    await db.flush()

    subject = await db.get(User, assignment.user_id)
    rag = await db.get(Rag, assignment.rag_id)
    return AssignmentWithCodeResponse(
        **_to_assignment_response(
            assignment,
            rag_name=rag.name if rag else None,
            user_name=subject.name if subject else None,
            user_email=subject.email if subject else None,
        ).model_dump(),
        access_code=assignment.access_code,
    )
