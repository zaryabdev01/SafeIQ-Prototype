from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.db.control_models import OnboardingVideo, VideoAudience
from app.models.tenant import OnboardingEventType


class OnboardingVideoResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    thumbnail_gradient: str
    media_url: str | None
    audience: VideoAudience
    order_index: int
    duration_seconds: int
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


def serialize_video(video: OnboardingVideo) -> OnboardingVideoResponse:
    """Response builder that resolves `media_key` (an S3 object key) into a
    playable URL. Falls back to the stored `media_url` (an external link)
    when there's no key or no storage backend configured."""
    from app.services.media_storage import get_media_storage

    media_url = video.media_url
    if video.media_key:
        media_url = get_media_storage().playback_url(video.media_key) or video.media_url
    return OnboardingVideoResponse(
        id=video.id,
        title=video.title,
        description=video.description,
        thumbnail_gradient=video.thumbnail_gradient,
        media_url=media_url,
        audience=video.audience,
        order_index=video.order_index,
        duration_seconds=video.duration_seconds,
        created_by=video.created_by,
        created_at=video.created_at,
    )


class CreateOnboardingVideoRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    thumbnail_gradient: str = Field(min_length=1, max_length=80)
    media_url: str | None = None
    media_key: str | None = None
    audience: VideoAudience = VideoAudience.all
    duration_seconds: int = Field(default=0, ge=0)


class UpdateOnboardingVideoRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    thumbnail_gradient: str | None = None
    media_url: str | None = None
    media_key: str | None = None
    audience: VideoAudience | None = None
    duration_seconds: int | None = Field(default=None, ge=0)


class MediaUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)


class MediaUploadResponse(BaseModel):
    upload_url: str
    media_key: str
    headers: dict[str, str]


class ReorderVideosRequest(BaseModel):
    ordered_video_ids: list[uuid.UUID] = Field(min_length=1)


class ShareVideoRequest(BaseModel):
    email: EmailStr | None = None
    user_id: uuid.UUID | None = None


class OnboardingEventResponse(BaseModel):
    id: uuid.UUID
    event_type: OnboardingEventType
    video_id: uuid.UUID | None
    user_id: uuid.UUID | None
    query: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoAnalytics(BaseModel):
    video_id: uuid.UUID
    title: str
    view_count: int
    share_count: int


class OnboardingAnalyticsResponse(BaseModel):
    videos: list[VideoAnalytics]
    top_search_queries: list[str]
    total_searches: int
    total_views: int
    total_shares: int
