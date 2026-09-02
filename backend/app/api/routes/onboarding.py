"""Tenant-user-facing onboarding CMS - Milestone 3 tasks 23-26.

Every organisation user (any role) reads the *same* catalogue, which lives
in `control.onboarding_videos` and is curated by SafeIQ Internal (see
routes/internal.py for the task 21-22 authoring side). This router only
lets tenant users list / filter / search / view / share, and lets an org
admin see their own org's engagement analytics. It never writes to the
catalogue.
"""

from __future__ import annotations

import uuid
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_tenant_db, require_role
from app.core.config import get_settings
from app.db.control_models import OnboardingVideo, VideoAudience
from app.db.session import get_control_session_dep
from app.models.tenant import OnboardingEvent, OnboardingEventType, TeamRole, User
from app.schemas.onboarding import (
    OnboardingAnalyticsResponse,
    OnboardingVideoResponse,
    ShareVideoRequest,
    VideoAnalytics,
    serialize_video,
)
from app.services.email import EmailSender, get_email_sender
from app.services.email_templates import render_email
from app.services.onboarding_search import OnboardingSearchProvider, get_onboarding_search_provider

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

_ANALYTICS_ROLES = (TeamRole.super_admin, TeamRole.administrator)


@router.get("/videos", response_model=list[OnboardingVideoResponse])
async def list_videos(
    current_user: CurrentUser = Depends(get_current_user),
    tenant_db: AsyncSession = Depends(get_tenant_db),
    control_db: AsyncSession = Depends(get_control_session_dep),
    audience: VideoAudience | None = None,
    category: str | None = None,
    q: str | None = None,
) -> list[OnboardingVideoResponse]:
    stmt = select(OnboardingVideo).order_by(OnboardingVideo.order_index)
    if audience is not None:
        stmt = stmt.where((OnboardingVideo.audience == audience) | (OnboardingVideo.audience == VideoAudience.all))
    if category and category.strip():
        stmt = stmt.where(OnboardingVideo.category == category.strip())
    videos = list((await control_db.execute(stmt)).scalars().all())

    if q and q.strip():
        provider: OnboardingSearchProvider = get_onboarding_search_provider()
        videos = await provider.search(q, videos)
        tenant_db.add(OnboardingEvent(event_type=OnboardingEventType.search, user_id=current_user.id, query=q.strip()))
        await tenant_db.flush()

    return [serialize_video(v) for v in videos]


@router.post("/videos/{video_id}/view", status_code=status.HTTP_204_NO_CONTENT)
async def record_view(
    video_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    tenant_db: AsyncSession = Depends(get_tenant_db),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> None:
    if await control_db.get(OnboardingVideo, video_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    tenant_db.add(OnboardingEvent(event_type=OnboardingEventType.view, video_id=video_id, user_id=current_user.id))
    await tenant_db.flush()


@router.post("/videos/{video_id}/share", status_code=status.HTTP_204_NO_CONTENT)
async def share_video(
    video_id: uuid.UUID,
    payload: ShareVideoRequest,
    current_user: CurrentUser = Depends(get_current_user),
    tenant_db: AsyncSession = Depends(get_tenant_db),
    control_db: AsyncSession = Depends(get_control_session_dep),
    email_sender: EmailSender = Depends(get_email_sender),
) -> None:
    video = await control_db.get(OnboardingVideo, video_id)
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")

    target_email = payload.email
    if payload.user_id is not None:
        target_user = await tenant_db.get(User, payload.user_id)
        if target_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        target_email = target_user.email
    if target_email is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide either an email address or a user_id to share with")

    watch_url = f"{get_settings().app_base_url.rstrip('/')}/onboarding?video={video_id}"
    await email_sender.send(
        to=target_email,
        subject=f"SafeIQ onboarding video: {video.title}",
        body=f"{video.title}\n\n{video.description}\n\nWatch it: {watch_url}",
        html=render_email(
            heading=video.title,
            intro=video.description,
            cta_label="Watch video",
            cta_url=watch_url,
            outro="Shared with you via SafeIQ onboarding.",
        ),
    )
    tenant_db.add(
        OnboardingEvent(
            event_type=OnboardingEventType.share,
            video_id=video_id,
            user_id=current_user.id,
            detail={"shared_with": target_email},
        )
    )
    await tenant_db.flush()


@router.get("/analytics", response_model=OnboardingAnalyticsResponse)
async def onboarding_analytics(
    current_user: CurrentUser = Depends(require_role(*_ANALYTICS_ROLES)),
    tenant_db: AsyncSession = Depends(get_tenant_db),
    control_db: AsyncSession = Depends(get_control_session_dep),
) -> OnboardingAnalyticsResponse:
    """This org's engagement with the shared catalogue. Counts come from
    this tenant's own `onboarding_events`; titles from the control-plane
    catalogue. Cross-org rollups are a SafeIQ Internal concern and are not
    exposed here."""
    videos = list((await control_db.execute(select(OnboardingVideo))).scalars().all())

    async def counts_by_video(event_type: OnboardingEventType) -> dict[uuid.UUID | None, int]:
        stmt = (
            select(OnboardingEvent.video_id, func.count())
            .where(OnboardingEvent.event_type == event_type)
            .group_by(OnboardingEvent.video_id)
        )
        return {row[0]: row[1] for row in (await tenant_db.execute(stmt)).all()}

    view_counts = await counts_by_video(OnboardingEventType.view)
    share_counts = await counts_by_video(OnboardingEventType.share)

    search_stmt = select(OnboardingEvent.query).where(
        OnboardingEvent.event_type == OnboardingEventType.search, OnboardingEvent.query.is_not(None)
    )
    search_queries = [row[0] for row in (await tenant_db.execute(search_stmt)).all()]

    return OnboardingAnalyticsResponse(
        videos=[
            VideoAnalytics(
                video_id=v.id, title=v.title, view_count=view_counts.get(v.id, 0), share_count=share_counts.get(v.id, 0)
            )
            for v in videos
        ],
        top_search_queries=[q for q, _ in Counter(search_queries).most_common(10)],
        total_searches=len(search_queries),
        total_views=sum(view_counts.values()),
        total_shares=sum(share_counts.values()),
    )
