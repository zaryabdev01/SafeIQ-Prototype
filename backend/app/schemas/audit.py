from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditEntryResponse(BaseModel):
    id: int
    event_type: str
    subject_id: uuid.UUID
    owner_id: uuid.UUID | None
    content_hash: str
    prev_hash: str
    entry_hash: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditChainVerification(BaseModel):
    valid: bool
    entries_checked: int
