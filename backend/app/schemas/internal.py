from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field


class InternalLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class InternalTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class InternalUserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr

    model_config = {"from_attributes": True}
