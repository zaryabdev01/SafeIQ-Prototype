from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr

from app.models.tenant import TeamRole


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
