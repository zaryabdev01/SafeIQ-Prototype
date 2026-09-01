"""SafeIQ Internal console - cross-tenant support staff (control.internal_users).

Milestone 3 gives these accounts ownership of the onboarding CMS (tasks 21-22):
authoring, ordering and analytics of the single shared video catalogue in
`control.onboarding_videos`. Tenant users only ever consume it (tasks 23-26,
in routes/onboarding.py).

There is no self-service signup for internal accounts by design: create them
with `python -m scripts.seed_internal_user`. Internal actions are not written
to the audit ledger - that ledger is per-tenant and hash-chained per tenant;
a control-plane audit trail is separate follow-up work.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentInternalUser, get_current_internal_user
from app.core.security import create_internal_token, verify_password
from app.db.control_models import InternalUser, OnboardingVideo
from app.db.session import get_control_session_dep
from app.schemas.internal import InternalLoginRequest, InternalTokenResponse, InternalUserResponse
from app.schemas.onboarding import (
    CreateOnboardingVideoRequest,
    MediaUploadRequest,
    MediaUploadResponse,
    OnboardingVideoResponse,
    ReorderVideosRequest,
    UpdateOnboardingVideoRequest,
    serialize_video,
)
from app.services.media_storage import MediaStorageUnavailable, get_media_storage

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/auth/login", response_model=InternalTokenResponse)
async def internal_login(
    payload: InternalLoginRequest,
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> InternalTokenResponse:
    result = await control_db.execute(select(InternalUser).where(InternalUser.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return InternalTokenResponse(
        access_token=create_internal_token(subject=str(user.id)),
        refresh_token=create_internal_token(subject=str(user.id), token_type="refresh"),
    )


@router.get("/me", response_model=InternalUserResponse)
async def internal_me(current: CurrentInternalUser = Depends(get_current_internal_user)) -> CurrentInternalUser:
    return current


# --- Onboarding CMS: tasks 21 (author) + 22 (order) -------------------------


@router.get("/onboarding/videos", response_model=list[OnboardingVideoResponse])
async def internal_list_videos(
    current: CurrentInternalUser = Depends(get_current_internal_user),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> list[OnboardingVideoResponse]:
    stmt = select(OnboardingVideo).order_by(OnboardingVideo.order_index)
    return [serialize_video(v) for v in (await control_db.execute(stmt)).scalars().all()]


@router.post("/onboarding/videos/upload-url", response_model=MediaUploadResponse)
async def internal_media_upload_url(
    payload: MediaUploadRequest,
    current: CurrentInternalUser = Depends(get_current_internal_user),
) -> MediaUploadResponse:
    """Hand the browser a presigned PUT so the media file goes straight to
    storage. The client then creates/updates the video with the returned
    `media_key`."""
    try:
        upload = get_media_storage().create_upload(filename=payload.filename, content_type=payload.content_type)
    except MediaStorageUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return MediaUploadResponse(upload_url=upload.upload_url, media_key=upload.media_key, headers=upload.headers)


@router.post("/onboarding/videos", response_model=OnboardingVideoResponse, status_code=status.HTTP_201_CREATED)
async def internal_create_video(
    payload: CreateOnboardingVideoRequest,
    current: CurrentInternalUser = Depends(get_current_internal_user),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> OnboardingVideoResponse:
    next_order = ((await control_db.execute(select(func.max(OnboardingVideo.order_index)))).scalar_one_or_none() or -1) + 1
    video = OnboardingVideo(**payload.model_dump(), order_index=next_order, created_by=current.id)
    control_db.add(video)
    await control_db.flush()
    return serialize_video(video)


@router.patch("/onboarding/videos/{video_id}", response_model=OnboardingVideoResponse)
async def internal_update_video(
    video_id: uuid.UUID,
    payload: UpdateOnboardingVideoRequest,
    current: CurrentInternalUser = Depends(get_current_internal_user),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> OnboardingVideoResponse:
    video = await control_db.get(OnboardingVideo, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(video, field, value)
    await control_db.flush()
    return serialize_video(video)


@router.delete("/onboarding/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def internal_delete_video(
    video_id: uuid.UUID,
    current: CurrentInternalUser = Depends(get_current_internal_user),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> None:
    video = await control_db.get(OnboardingVideo, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    await control_db.delete(video)
    await control_db.flush()


@router.post("/onboarding/videos/reorder", response_model=list[OnboardingVideoResponse])
async def internal_reorder_videos(
    payload: ReorderVideosRequest,
    current: CurrentInternalUser = Depends(get_current_internal_user),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> list[OnboardingVideoResponse]:
    result = await control_db.execute(select(OnboardingVideo).where(OnboardingVideo.id.in_(payload.ordered_video_ids)))
    videos_by_id = {video.id: video for video in result.scalars().all()}
    if set(videos_by_id) != set(payload.ordered_video_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ordered_video_ids must list every video exactly once")
    for index, video_id in enumerate(payload.ordered_video_ids):
        videos_by_id[video_id].order_index = index
    await control_db.flush()
    return [serialize_video(v) for v in sorted(videos_by_id.values(), key=lambda v: v.order_index)]
