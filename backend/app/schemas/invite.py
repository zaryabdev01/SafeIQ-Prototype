from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.tenant import TeamRole


class CreateInviteRequest(BaseModel):
    email: EmailStr | None = None  # None => shareable link, not tied to one address
    role: TeamRole = TeamRole.employee


class InviteResponse(BaseModel):
    id: uuid.UUID
    token: str
    link: str
    email: str | None
    role: TeamRole
    status: str
    expires_at: datetime


class InvitePreview(BaseModel):
    organisation_name: str
    role: TeamRole
    email: str | None
    status: str


class AcceptInviteRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr | None = None  # required only when the invite itself has no email (shareable link)
    password: str = Field(min_length=10)
