"""Pluggable media storage for onboarding videos (Milestone 3, task 21).

- `none` (default): a no-op stub. `create_upload` raises so the endpoint
  can 503; `playback_url` returns "" so a video response falls back to
  whatever `media_url` the operator typed (an external link, or nothing).
- `s3`: real S3. `create_upload` hands the browser a presigned PUT so the
  file never transits the API; `playback_url` returns a CloudFront URL if
  `MEDIA_CDN_DOMAIN` is set, otherwise a presigned GET.

Selected by `MEDIA_STORAGE_BACKEND`. Credentials resolve from the ECS task
role by default; an explicit key pair is only a fallback.
"""

from __future__ import annotations

import re
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from functools import lru_cache

from app.core.config import get_settings


class MediaStorageUnavailable(RuntimeError):
    """Raised when an upload is requested but no real backend is configured."""


@dataclass
class MediaUpload:
    upload_url: str
    media_key: str
    headers: dict[str, str] = field(default_factory=dict)


_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(filename: str) -> str:
    cleaned = _UNSAFE.sub("-", filename.strip()).strip("-.")
    return cleaned[:120] or "file"


class MediaStorage(ABC):
    @abstractmethod
    def create_upload(self, *, filename: str, content_type: str) -> MediaUpload: ...

    @abstractmethod
    def playback_url(self, media_key: str) -> str: ...


class NullMediaStorage(MediaStorage):
    def create_upload(self, *, filename: str, content_type: str) -> MediaUpload:
        raise MediaStorageUnavailable(
            "Media upload is not configured on this environment (MEDIA_STORAGE_BACKEND=none). "
            "Set a directly playable media_url instead."
        )

    def playback_url(self, media_key: str) -> str:
        return ""


class S3MediaStorage(MediaStorage):
    def __init__(
        self,
        *,
        bucket: str,
        region: str,
        prefix: str = "onboarding/",
        access_key_id: str = "",
        secret_access_key: str = "",
        cdn_domain: str = "",
        upload_ttl_seconds: int = 900,
        url_ttl_seconds: int = 3600,
    ) -> None:
        if not bucket or not region:
            raise ValueError("MEDIA_S3_BUCKET and MEDIA_S3_REGION are required when MEDIA_STORAGE_BACKEND=s3")

        import boto3

        self._bucket = bucket
        self._prefix = prefix if prefix.endswith("/") or not prefix else f"{prefix}/"
        self._cdn_domain = cdn_domain.strip().rstrip("/")
        self._upload_ttl = upload_ttl_seconds
        self._url_ttl = url_ttl_seconds
        session = boto3.session.Session(
            aws_access_key_id=access_key_id or None,
            aws_secret_access_key=secret_access_key or None,
            region_name=region,
        )
        self._client = session.client("s3")

    def create_upload(self, *, filename: str, content_type: str) -> MediaUpload:
        key = f"{self._prefix}{uuid.uuid4().hex}/{_safe_filename(filename)}"
        upload_url = self._client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=self._upload_ttl,
        )
        return MediaUpload(upload_url=upload_url, media_key=key, headers={"Content-Type": content_type})

    def playback_url(self, media_key: str) -> str:
        if not media_key:
            return ""
        if self._cdn_domain:
            return f"https://{self._cdn_domain}/{media_key}"
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": media_key},
            ExpiresIn=self._url_ttl,
        )


@lru_cache
def get_media_storage() -> MediaStorage:
    settings = get_settings()
    if settings.media_storage_backend == "none":
        return NullMediaStorage()
    if settings.media_storage_backend == "s3":
        return S3MediaStorage(
            bucket=settings.media_s3_bucket,
            region=settings.media_s3_region,
            prefix=settings.media_s3_prefix,
            access_key_id=settings.media_s3_access_key_id,
            secret_access_key=settings.media_s3_secret_access_key,
            cdn_domain=settings.media_cdn_domain,
            upload_ttl_seconds=settings.media_upload_ttl_seconds,
            url_ttl_seconds=settings.media_url_ttl_seconds,
        )
    raise NotImplementedError(
        f"Media storage backend '{settings.media_storage_backend}' isn't implemented - use 'none' or 's3'."
    )
