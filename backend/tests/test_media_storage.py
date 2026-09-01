"""Unit tests for onboarding media storage - no network. boto3's
`generate_presigned_url` is pure local signing, so S3MediaStorage can be
exercised with dummy credentials.
"""

from __future__ import annotations

import pytest

from app.services import media_storage as mod
from app.services.media_storage import MediaStorageUnavailable, NullMediaStorage, S3MediaStorage

_S3_KW = dict(bucket="safeiq-media", region="eu-west-2", access_key_id="AKIATEST", secret_access_key="secret")


def test_null_storage_rejects_upload() -> None:
    with pytest.raises(MediaStorageUnavailable):
        NullMediaStorage().create_upload(filename="clip.mp4", content_type="video/mp4")


def test_null_storage_playback_url_is_empty() -> None:
    assert NullMediaStorage().playback_url("onboarding/abc/clip.mp4") == ""


def test_s3_presigned_put_targets_bucket_and_sanitised_key() -> None:
    storage = S3MediaStorage(**_S3_KW)
    upload = storage.create_upload(filename="My Clip!!.mp4", content_type="video/mp4")

    assert upload.media_key.startswith("onboarding/")
    assert upload.media_key.endswith("/My-Clip-.mp4")
    assert "safeiq-media" in upload.upload_url
    assert "X-Amz-Signature=" in upload.upload_url
    assert upload.headers == {"Content-Type": "video/mp4"}


def test_s3_playback_prefers_cdn_domain() -> None:
    storage = S3MediaStorage(**_S3_KW, cdn_domain="cdn.example.com/")
    assert storage.playback_url("onboarding/abc/clip.mp4") == "https://cdn.example.com/onboarding/abc/clip.mp4"


def test_s3_playback_falls_back_to_presigned_get() -> None:
    storage = S3MediaStorage(**_S3_KW)
    url = storage.playback_url("onboarding/abc/clip.mp4")
    assert url.startswith("https://") and "X-Amz-Signature=" in url


def test_s3_requires_bucket_and_region() -> None:
    with pytest.raises(ValueError):
        S3MediaStorage(bucket="", region="eu-west-2")


def test_factory_returns_null_by_default() -> None:
    mod.get_media_storage.cache_clear()
    try:
        assert isinstance(mod.get_media_storage(), NullMediaStorage)
    finally:
        mod.get_media_storage.cache_clear()


def test_factory_returns_s3_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Settings:
        media_storage_backend = "s3"
        media_s3_bucket = "safeiq-media"
        media_s3_region = "eu-west-2"
        media_s3_prefix = "onboarding/"
        media_s3_access_key_id = "AKIATEST"
        media_s3_secret_access_key = "secret"
        media_cdn_domain = ""
        media_upload_ttl_seconds = 900
        media_url_ttl_seconds = 3600

    monkeypatch.setattr(mod, "get_settings", lambda: _Settings())
    mod.get_media_storage.cache_clear()
    try:
        assert isinstance(mod.get_media_storage(), S3MediaStorage)
    finally:
        mod.get_media_storage.cache_clear()
