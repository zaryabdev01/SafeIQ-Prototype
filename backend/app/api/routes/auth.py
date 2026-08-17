from __future__ import annotations

import uuid
from datetime import UTC, datetime

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, create_onboarding_token, decode_token, hash_password, verify_password
from app.db.control_models import Organisation, UserDirectoryEntry
from app.db.session import get_control_session_dep, tenant_session
from app.models.tenant import KycRecord, LoginEvent, OtpCode, TeamRole, User
from app.schemas.auth import (
    EmployeeDirectSignupRequest,
    KycStartResponse,
    KycStatusResponse,
    LoginRequest,
    OrganisationLookupResponse,
    OrganisationSignupRequest,
    SignupResponse,
    TokenResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services import audit as audit_service
from app.services.email import EmailSender, get_email_sender
from app.services.kyc import get_kyc_provider
from app.services.otp import generate_otp, hash_otp, otp_expiry
from app.services.tenant_provisioning import create_organisation

router = APIRouter(prefix="/auth", tags=["auth"])


async def _issue_otp(db: AsyncSession, user: User, email_sender: EmailSender) -> None:
    code = generate_otp()
    db.add(OtpCode(user_id=user.id, code_hash=hash_otp(code), purpose="email_verification", expires_at=otp_expiry()))
    await db.flush()
    await email_sender.send(
        to=user.email,
        subject="Your SafeIQ verification code",
        body=f"Your verification code is {code}. It expires in {get_settings().otp_expire_minutes} minutes.",
    )


def _tokens_for(user: User, org: Organisation) -> TokenResponse:
    settings = get_settings()
    access = create_access_token(subject=str(user.id), org_id=str(org.id), tenant_schema=org.tenant_schema, role=user.team_role.value)
    refresh = create_access_token(
        subject=str(user.id),
        org_id=str(org.id),
        tenant_schema=org.tenant_schema,
        role=user.team_role.value,
        token_type="refresh",
        expires_minutes=settings.refresh_token_expire_minutes,
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/signup/organisation", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_organisation(
    payload: OrganisationSignupRequest,
    control_db: AsyncSession = Depends(get_control_session_dep),
    email_sender: EmailSender = Depends(get_email_sender),
) -> SignupResponse:
    org = await create_organisation(control_db, name=payload.organisation_name, sector=payload.sector)

    tenant_db = tenant_session(org.tenant_schema)
    try:
        user = User(
            name=payload.full_name,
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            team_role=TeamRole.super_admin,
        )
        tenant_db.add(user)
        await tenant_db.flush()

        await audit_service.record_event(
            tenant_db, event_type="organisation.created", subject_id=org.id, owner_id=user.id, content={"name": org.name}
        )
        await audit_service.record_event(
            tenant_db,
            event_type="user.registered",
            subject_id=user.id,
            owner_id=user.id,
            content={"email": user.email, "role": user.team_role.value},
        )
        await _issue_otp(tenant_db, user, email_sender)
        await tenant_db.commit()
    except Exception:
        await tenant_db.rollback()
        raise
    finally:
        await tenant_db.close()

    control_db.add(UserDirectoryEntry(email=user.email, org_id=org.id, user_id=user.id))
    await control_db.commit()

    onboarding_token = create_onboarding_token(subject=str(user.id), org_id=str(org.id), tenant_schema=org.tenant_schema)
    return SignupResponse(user_id=user.id, org_id=org.id, onboarding_token=onboarding_token)


@router.post("/signup/employee", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_employee(
    payload: EmployeeDirectSignupRequest,
    control_db: AsyncSession = Depends(get_control_session_dep),
    email_sender: EmailSender = Depends(get_email_sender),
) -> SignupResponse:
    """Direct employee sign-up against an existing organisation (as
    opposed to arriving via a magic-link invite - see routes/invites.py).
    Mirrors the prototype's `directSignUp` concept."""
    org = await control_db.get(Organisation, payload.organisation_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organisation not found")

    tenant_db = tenant_session(org.tenant_schema)
    try:
        existing = await tenant_db.execute(select(User).where(User.email == payload.email.lower()))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists in this organisation")

        user = User(
            name=payload.full_name,
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            team_role=TeamRole.employee,
            direct_sign_up=True,
        )
        tenant_db.add(user)
        await tenant_db.flush()

        await audit_service.record_event(
            tenant_db,
            event_type="user.registered",
            subject_id=user.id,
            owner_id=user.id,
            content={"email": user.email, "role": user.team_role.value, "direct_sign_up": True},
        )
        await _issue_otp(tenant_db, user, email_sender)
        await tenant_db.commit()
    except HTTPException:
        await tenant_db.rollback()
        raise
    except Exception:
        await tenant_db.rollback()
        raise
    finally:
        await tenant_db.close()

    control_db.add(UserDirectoryEntry(email=user.email, org_id=org.id, user_id=user.id))
    await control_db.commit()

    onboarding_token = create_onboarding_token(subject=str(user.id), org_id=str(org.id), tenant_schema=org.tenant_schema)
    return SignupResponse(user_id=user.id, org_id=org.id, onboarding_token=onboarding_token)


@router.get("/organisations", response_model=list[OrganisationLookupResponse])
async def lookup_organisations_for_email(
    email: str, control_db: AsyncSession = Depends(get_control_session_dep)
) -> list[OrganisationLookupResponse]:
    """Screen-1-facing helper: 'which organisation(s) is this email a
    member of' - lets the login screen ask for an email first and then
    offer an organisation picker, without ever touching a tenant schema."""
    result = await control_db.execute(
        select(UserDirectoryEntry.org_id, Organisation.name)
        .join(Organisation, Organisation.id == UserDirectoryEntry.org_id)
        .where(UserDirectoryEntry.email == email.lower())
    )
    return [OrganisationLookupResponse(organisation_id=row.org_id, organisation_name=row.name) for row in result.all()]


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp(payload: VerifyOtpRequest) -> VerifyOtpResponse:
    try:
        claims = decode_token(payload.onboarding_token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired onboarding token") from exc
    if claims.get("type") != "onboarding":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid onboarding token")

    tenant_db = tenant_session(claims["tenant_schema"])
    try:
        user_id = uuid.UUID(claims["sub"])
        result = await tenant_db.execute(
            select(OtpCode).where(OtpCode.user_id == user_id, OtpCode.consumed_at.is_(None)).order_by(OtpCode.created_at.desc())
        )
        otp = result.scalars().first()
        now = datetime.now(UTC)
        if otp is None or otp.expires_at < now or otp.attempts >= 5:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No valid verification code - request a new one")
        if hash_otp(payload.code) != otp.code_hash:
            otp.attempts += 1
            await tenant_db.commit()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect code")

        otp.consumed_at = now
        user = await tenant_db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        user.email_verified = True
        await audit_service.record_event(tenant_db, event_type="user.email_verified", subject_id=user.id, owner_id=user.id)
        await tenant_db.commit()
    except HTTPException:
        await tenant_db.rollback()
        raise
    finally:
        await tenant_db.close()

    return VerifyOtpResponse(verified=True, next_step="kyc")


@router.post("/kyc/start", response_model=KycStartResponse)
async def start_kyc(onboarding_token: str) -> KycStartResponse:
    try:
        claims = decode_token(onboarding_token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired onboarding token") from exc
    if claims.get("type") != "onboarding":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid onboarding token")

    tenant_db = tenant_session(claims["tenant_schema"])
    try:
        user = await tenant_db.get(User, uuid.UUID(claims["sub"]))
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        if not user.email_verified:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verify your email before starting identity verification")

        provider = get_kyc_provider()
        session = await provider.start_verification(user_id=str(user.id), full_name=user.name, email=user.email)

        tenant_db.add(KycRecord(user_id=user.id, provider=session.provider, provider_session_id=session.session_id, status=session.status))
        user.kyc_status = session.status
        await audit_service.record_event(
            tenant_db, event_type="user.kyc_started", subject_id=user.id, owner_id=user.id, content={"provider": session.provider}
        )
        if session.status == "approved":
            await audit_service.record_event(tenant_db, event_type="user.kyc_approved", subject_id=user.id, owner_id=user.id)
        await tenant_db.commit()
    except HTTPException:
        await tenant_db.rollback()
        raise
    finally:
        await tenant_db.close()

    return KycStartResponse(
        provider=session.provider, session_id=session.session_id, status=session.status, redirect_url=session.redirect_url
    )


@router.get("/kyc/status", response_model=KycStatusResponse)
async def kyc_status(onboarding_token: str) -> KycStatusResponse:
    try:
        claims = decode_token(onboarding_token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired onboarding token") from exc

    tenant_db = tenant_session(claims["tenant_schema"])
    try:
        user = await tenant_db.get(User, uuid.UUID(claims["sub"]))
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return KycStatusResponse(status=user.kyc_status)
    finally:
        await tenant_db.close()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, control_db: AsyncSession = Depends(get_control_session_dep)) -> TokenResponse:
    org = await control_db.get(Organisation, payload.organisation_id)
    if org is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    tenant_db = tenant_session(org.tenant_schema)
    try:
        result = await tenant_db.execute(select(User).where(User.email == payload.email.lower()))
        user = result.scalar_one_or_none()
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
        if not user.email_verified:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Verify your email before logging in")

        await audit_service.record_event(tenant_db, event_type="user.logged_in", subject_id=user.id, owner_id=user.id)
        # Separate from the audit entry above by design - see LoginEvent's docstring. The audit
        # ledger proves *that* a login happened; this table is what Settings' "Account login
        # history" actually reads, since it needs real IP/device detail the ledger can't hold.
        tenant_db.add(
            LoginEvent(
                user_id=user.id,
                ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )
        await tenant_db.commit()
    except HTTPException:
        await tenant_db.rollback()
        raise
    finally:
        await tenant_db.close()

    return _tokens_for(user, org)
