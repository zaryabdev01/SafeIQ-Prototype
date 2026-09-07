from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.tenant import RagStatus


class CreateRagRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class UpdateRagRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    status: RagStatus | None = None


class RagResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: RagStatus
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreateAssignmentRequest(BaseModel):
    user_id: uuid.UUID
    alert_owner_id: uuid.UUID | None = None


class UpdateAssignmentRequest(BaseModel):
    alert_owner_id: uuid.UUID | None = None
    status: Literal["revoked"] | None = None  # one-way: revoke keeps the row for history, never un-revokes


class AssignmentResponse(BaseModel):
    """Deliberately carries only the last 4 characters of the access code -
    the full code is returned solely by the create/rotate endpoints that just
    issued it (see AssignmentWithCodeResponse), not on every list/get."""

    id: uuid.UUID
    rag_id: uuid.UUID
    rag_name: str | None = None
    user_id: uuid.UUID
    user_name: str | None = None
    user_email: str | None = None
    access_code_last4: str
    status: str
    alert_owner_id: uuid.UUID | None
    assigned_by: uuid.UUID
    assigned_at: datetime
    revoked_at: datetime | None


class AssignmentWithCodeResponse(AssignmentResponse):
    access_code: str
