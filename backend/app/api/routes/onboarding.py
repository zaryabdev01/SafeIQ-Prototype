from __future__ import annotations

import uuid
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_tenant_db, require_role
from app.models.tenant import OnboardingEvent, OnboardingEventType, OnboardingVideo, TeamRole, User, VideoAudience
from app.schemas.onboarding import (
    CreateOnboardingVideoRequest,
    OnboardingAnalyticsResponse,
    OnboardingVideoResponse,
    ReorderVideosRequest,
    ShareVideoRequest,
    UpdateOnboardingVideoRequest,
    VideoAnalytics,
)
from app.services import audit as audit_service
from app.services.email import EmailSender, get_email_sender
from app.services.onboarding_search import OnboardingSearchProvider, get_onboarding_search_provider

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

_CMS_ADMINS = (TeamRole.super_admin, TeamRole.administrator)


@router.get("/videos", response_model=list[OnboardingVideoResponse])
async def list_videos(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
    audience: VideoAudience | None = None,
    q: str | None = None,
) -> list[OnboardingVideo]:
    stmt = select(OnboardingVideo).order_by(OnboardingVideo.order_index)
    if audience is not None:
        stmt = stmt.where((OnboardingVideo.audience == audience) | (OnboardingVideo.audience == VideoAudience.all))
    result = await db.execute(stmt)
    videos = list(result.scalars().all())

    if q and q.strip():
        provider: OnboardingSearchProvider = get_onboarding_search_provider()
        videos = await provider.search(q, videos)
        db.add(OnboardingEvent(event_type=OnboardingEventType.search, user_id=current_user.id, query=q.strip()))
        await db.flush()

    return videos


@router.post("/videos", response_model=OnboardingVideoResponse, status_code=status.HTTP_201_CREATED)
async def create_video(
    payload: CreateOnboardingVideoRequest,
    current_user: CurrentUser = Depends(require_role(*_CMS_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> OnboardingVideo:
    result = await db.execute(select(func.max(OnboardingVideo.order_index)))
    next_order = (result.scalar_one_or_none() or -1) + 1

    video = OnboardingVideo(**payload.model_dump(), order_index=next_order, created_by=current_user.id)
    db.add(video)
    await db.flush()

    await audit_service.record_event(
        db, event_type="onboarding_video.created", subject_id=video.id, owner_id=current_user.id, content={"title": video.title}
    )
    return video


@router.patch("/videos/{video_id}", response_model=OnboardingVideoResponse)
async def update_video(
    video_id: uuid.UUID,
    payload: UpdateOnboardingVideoRequest,
    current_user: CurrentUser = Depends(require_role(*_CMS_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> OnboardingVideo:
    video = await db.get(OnboardingVideo, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(video, field, value)

    await audit_service.record_event(
        db, event_type="onboarding_video.updated", subject_id=video.id, owner_id=current_user.id, content=updates
    )
    await db.flush()
    return video


@router.post("/videos/reorder", response_model=list[OnboardingVideoResponse])
async def reorder_videos(
    payload: ReorderVideosRequest,
    current_user: CurrentUser = Depends(require_role(*_CMS_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[OnboardingVideo]:
    result = await db.execute(select(OnboardingVideo).where(OnboardingVideo.id.in_(payload.ordered_video_ids)))
    videos_by_id = {video.id: video for video in result.scalars().all()}
    if set(videos_by_id) != set(payload.ordered_video_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ordered_video_ids must list every video exactly once")

    for index, video_id in enumerate(payload.ordered_video_ids):
        videos_by_id[video_id].order_index = index

    await audit_service.record_event(
        db, event_type="onboarding_video.reordered", subject_id=current_user.org_id, owner_id=current_user.id,
        content={"order": [str(v) for v in payload.ordered_video_ids]},
    )
    await db.flush()
    return sorted(videos_by_id.values(), key=lambda v: v.order_index)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(*_CMS_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    video = await db.get(OnboardingVideo, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")

    await audit_service.record_event(
        db, event_type="onboarding_video.deleted", subject_id=video.id, owner_id=current_user.id, content={"title": video.title}
    )
    await db.delete(video)
    await db.flush()


@router.post("/videos/{video_id}/view", status_code=status.HTTP_204_NO_CONTENT)
async def record_view(
    video_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    video = await db.get(OnboardingVideo, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    db.add(OnboardingEvent(event_type=OnboardingEventType.view, video_id=video_id, user_id=current_user.id))
    await db.flush()


@router.post("/videos/{video_id}/share", status_code=status.HTTP_204_NO_CONTENT)
async def share_video(
    video_id: uuid.UUID,
    payload: ShareVideoRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
    email_sender: EmailSender = Depends(get_email_sender),
) -> None:
    video = await db.get(OnboardingVideo, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")

    target_email = payload.email
    if payload.user_id is not None:
        target_user = await db.get(User, payload.user_id)
        if target_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        target_email = target_user.email
    if target_email is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide either an email address or a user_id to share with")

    await email_sender.send(
        to=target_email,
        subject=f"SafeIQ onboarding video: {video.title}",
        body=f"{video.description}\n\nShared with you via SafeIQ onboarding.",
    )
    db.add(
        OnboardingEvent(
            event_type=OnboardingEventType.share, video_id=video_id, user_id=current_user.id, detail={"shared_with": target_email}
        )
    )
    await db.flush()


@router.get("/analytics", response_model=OnboardingAnalyticsResponse)
async def onboarding_analytics(
    current_user: CurrentUser = Depends(require_role(*_CMS_ADMINS)),
    db: AsyncSession = Depends(get_tenant_db),
) -> OnboardingAnalyticsResponse:
    videos = list((await db.execute(select(OnboardingVideo))).scalars().all())

    async def counts_by_video(event_type: OnboardingEventType) -> dict[uuid.UUID | None, int]:
        stmt = (
            select(OnboardingEvent.video_id, func.count())
            .where(OnboardingEvent.event_type == event_type)
            .group_by(OnboardingEvent.video_id)
        )
        return {row[0]: row[1] for row in (await db.execute(stmt)).all()}

    view_counts = await counts_by_video(OnboardingEventType.view)
    share_counts = await counts_by_video(OnboardingEventType.share)

    search_stmt = select(OnboardingEvent.query).where(
        OnboardingEvent.event_type == OnboardingEventType.search, OnboardingEvent.query.is_not(None)
    )
    search_queries = [row[0] for row in (await db.execute(search_stmt)).all()]

    return OnboardingAnalyticsResponse(
        videos=[
            VideoAnalytics(video_id=v.id, title=v.title, view_count=view_counts.get(v.id, 0), share_count=share_counts.get(v.id, 0))
            for v in videos
        ],
        top_search_queries=[q for q, _ in Counter(search_queries).most_common(10)],
        total_searches=len(search_queries),
        total_views=sum(view_counts.values()),
        total_shares=sum(share_counts.values()),
    )
