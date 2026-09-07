from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.tenant import ActionPriority, ActionStatus, ActionTier


class CreateActionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    tier: ActionTier
    priority: ActionPriority
    assignee_id: uuid.UUID
    subject_user_id: uuid.UUID | None = None
    rag_id: uuid.UUID | None = None
    alert_id: uuid.UUID | None = None
    due_date: date | None = None


class UpdateActionRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    tier: ActionTier | None = None
    priority: ActionPriority | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    status: ActionStatus | None = None


class ActionResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    tier: ActionTier
    priority: ActionPriority
    status: ActionStatus
    assignee_id: uuid.UUID
    subject_user_id: uuid.UUID | None
    rag_id: uuid.UUID | None
    alert_id: uuid.UUID | None
    due_date: date | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
