from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.tenant import AlertSeverity, TeamRole


class UserProfile(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    team_role: TeamRole
    job_title: str | None
    country: str | None
    language: str | None
    email_verified: bool
    kyc_status: str

    model_config = {"from_attributes": True}


class UpdateSettingsRequest(BaseModel):
    country: str | None = None
    language: str | None = None
    job_title: str | None = None


class UpdateRoleRequest(BaseModel):
    role: TeamRole


class TeamNoteResponse(BaseModel):
    id: uuid.UUID
    subject_user_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateNoteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class PersonAlertRuleResponse(BaseModel):
    id: uuid.UUID
    subject_user_id: uuid.UUID
    category: str
    severity: AlertSeverity
    notify_email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CreatePersonAlertRuleRequest(BaseModel):
    category: str = Field(min_length=1, max_length=200)
    severity: AlertSeverity = AlertSeverity.medium
    notify_email: EmailStr


class LoginEventResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    ip: str | None
    user_agent: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
