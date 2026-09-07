from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.tenant import AlertOutcome, AlertSeverity, AlertStage


class CreateAlertRequest(BaseModel):
    subject_user_id: uuid.UUID
    rag_id: uuid.UUID | None = None
    keyword: str | None = Field(default=None, max_length=200)
    severity: AlertSeverity = AlertSeverity.medium
    context: str | None = Field(default=None, max_length=2000)


class AdvanceAlertRequest(BaseModel):
    to_stage: AlertStage
    severity: AlertSeverity | None = None
    context: str | None = Field(default=None, max_length=2000)
    outcome: AlertOutcome | None = None
    note: str | None = Field(default=None, max_length=1000)


class UpdateAlertRequest(BaseModel):
    severity: AlertSeverity | None = None
    context: str | None = Field(default=None, max_length=2000)


class StageTransitionResponse(BaseModel):
    id: uuid.UUID
    from_stage: AlertStage | None
    to_stage: AlertStage
    note: str | None
    actor_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: uuid.UUID
    subject_user_id: uuid.UUID
    rag_id: uuid.UUID | None
    keyword: str | None
    stage: AlertStage
    severity: AlertSeverity
    context: str | None
    status: str
    outcome: AlertOutcome | None
    created_by: uuid.UUID
    created_at: datetime
    closed_at: datetime | None
    closed_by: uuid.UUID | None

    model_config = {"from_attributes": True}


class AlertDetailResponse(AlertResponse):
    """GET /alerts/{id} only - the list endpoint returns the plain
    AlertResponse without pulling every alert's transition history."""

    stage_transitions: list[StageTransitionResponse]
