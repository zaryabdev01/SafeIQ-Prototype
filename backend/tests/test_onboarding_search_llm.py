"""Unit tests for the OpenAI-backed onboarding search - no real network."""

from __future__ import annotations

import json
import uuid

import httpx
import pytest

from app.db.control_models import OnboardingVideo, VideoAudience
from app.services.onboarding_search import OpenAiSearchProvider


def _video(title: str, description: str) -> OnboardingVideo:
    return OnboardingVideo(
        id=uuid.uuid4(),
        title=title,
        description=description,
        thumbnail_gradient="from-indigo-500 to-violet-600",
        audience=VideoAudience.all,
        order_index=0,
        duration_seconds=60,
        created_by=uuid.uuid4(),
    )


def _completion(video_ids: list[str]) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({"video_ids": video_ids})}}]})


def _provider(handler) -> OpenAiSearchProvider:
    return OpenAiSearchProvider(
        api_key="KEY", model="gpt-4o-mini", base_url="https://api.openai.com/v1", transport=httpx.MockTransport(handler)
    )


async def test_returns_videos_in_model_ranked_order() -> None:
    v1, v2, v3 = _video("A", "x"), _video("B", "y"), _video("C", "z")
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _completion([str(v3.id), str(v1.id)])

    result = await _provider(handler).search("need help", [v1, v2, v3])
    assert [v.id for v in result] == [v3.id, v1.id]
    assert seen[0].headers["Authorization"] == "Bearer KEY"
    assert seen[0].url.path == "/v1/chat/completions"


async def test_unknown_and_malformed_ids_are_dropped() -> None:
    v1 = _video("A", "x")

    def handler(request: httpx.Request) -> httpx.Response:
        return _completion([str(uuid.uuid4()), "not-a-uuid", str(v1.id)])

    result = await _provider(handler).search("help", [v1])
    assert [v.id for v in result] == [v1.id]


async def test_falls_back_to_keyword_on_api_error() -> None:
    v1 = _video("Create a RAG", "step by step guide")
    v2 = _video("Team invites", "invite colleagues")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "server on fire"})

    result = await _provider(handler).search("how do I create a RAG", [v1, v2])
    assert [v.id for v in result] == [v1.id]


async def test_empty_catalogue_short_circuits() -> None:
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover - must never be called
        raise AssertionError("should not call OpenAI with an empty catalogue")

    assert await _provider(handler).search("anything", []) == []


def test_requires_api_key() -> None:
    with pytest.raises(ValueError):
        OpenAiSearchProvider(api_key="", model="gpt-4o-mini", base_url="https://api.openai.com/v1")
