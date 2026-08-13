from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class OrganisationSignupRequest(BaseModel):
    organisation_name: str = Field(min_length=2, max_length=200)
    sector: str | None = None
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=10)


class EmployeeDirectSignupRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=10)
    organisation_id: uuid.UUID


class SignupResponse(BaseModel):
    user_id: uuid.UUID
    org_id: uuid.UUID
    onboarding_token: str
    requires_email_verification: bool = True


class OrganisationLookupResponse(BaseModel):
    organisation_id: uuid.UUID
    organisation_name: str


class VerifyOtpRequest(BaseModel):
    onboarding_token: str
    code: str = Field(min_length=6, max_length=6)


class VerifyOtpResponse(BaseModel):
    verified: bool
    next_step: Literal["kyc"]


class KycStartResponse(BaseModel):
    provider: str
    session_id: str
    status: str
    redirect_url: str | None = None


class KycStatusResponse(BaseModel):
    status: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    organisation_id: uuid.UUID


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
