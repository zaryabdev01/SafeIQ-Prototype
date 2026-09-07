from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr

from app.models.tenant import TeamRole


class ProfileHeader(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    job_title: str | None
    team_role: TeamRole
    status: str
    is_safeguarding_lead: bool
    created_at: datetime
    last_login: datetime | None


class SummaryCards(BaseModel):
    assigned_rags: int
    conversations: int  # always 0 - documented placeholder until Milestone 6 (chat agent)
    alerts: int
    open_actions: int


class TrafficLight(BaseModel):
    level: Literal["green", "amber", "red"]
    label: str


class RagCard(BaseModel):
    rag_id: uuid.UUID
    rag_name: str
    assignment_status: str
    alert_owner_id: uuid.UUID | None
    access_code_last4: str
    traffic_light: TrafficLight


class MemberProfileResponse(BaseModel):
    header: ProfileHeader
    summary_cards: SummaryCards
    rag_cards: list[RagCard]


class EmployeeRagRecordResponse(BaseModel):
    """The Employee x RAG record shell (task 33) - basic identity plus
    overview counts. The tabs themselves (overview/conversations/alerts/
    actions/audit-log) are separate lazy-loaded endpoints."""

    user_id: uuid.UUID
    user_name: str
    user_email: str
    rag_id: uuid.UUID
    rag_name: str
    assignment_status: str | None
    alert_owner_id: uuid.UUID | None
    access_code_last4: str | None
    assigned_at: datetime | None
    revoked_at: datetime | None
    open_alerts: int
    open_actions: int


class OverviewEventResponse(BaseModel):
    kind: str
    ref_id: uuid.UUID
    summary: str
    created_at: datetime


class OverviewResponse(BaseModel):
    items: list[OverviewEventResponse]


class ConversationsStubResponse(BaseModel):
    items: list[dict] = []
    note: str = "Available once the chat agent (Milestone 6) ships"


class AuditLogEntryResponse(BaseModel):
    """Content-free by construction - `content` is never even fetched here,
    let alone returned (ADR-005 only ever stores a hash of it anyway)."""

    event_type: str
    owner: str
    created_at: datetime


class AuditLogResponse(BaseModel):
    items: list[AuditLogEntryResponse]
