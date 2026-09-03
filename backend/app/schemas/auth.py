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
    sdk_token: str | None = None  # Sumsub WebSDK access token, when the provider uses one


class KycStatusResponse(BaseModel):
    status: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    organisation_id: uuid.UUID


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    organisation_id: uuid.UUID | None = None


class ForgotPasswordResponse(BaseModel):
    # Always true when the request was well-formed - never reveals whether the
    # email actually has an account. `organisation_id` echoes the resolved org
    # so the client knows which one to send on to /auth/reset-password.
    sent: bool = True
    organisation_id: uuid.UUID | None = None


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    organisation_id: uuid.UUID
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=10)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
