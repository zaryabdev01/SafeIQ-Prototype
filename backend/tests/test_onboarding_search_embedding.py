"""Unit tests for the embedding + threshold onboarding search - no network."""

from __future__ import annotations

import uuid

import httpx
import pytest

from app.db.control_models import OnboardingVideo, VideoAudience
from app.services.onboarding_search import EmbeddingSearchProvider


def _video(title: str, description: str) -> OnboardingVideo:
    return OnboardingVideo(
        id=uuid.uuid4(),
        title=title,
        description=description,
        thumbnail_gradient="from-indigo-500 to-violet-600",
        audience=VideoAudience.all,
        order_index=0,
        created_by=uuid.uuid4(),
    )


def _embeddings(vectors: list[list[float]]) -> httpx.Response:
    return httpx.Response(200, json={"data": [{"index": i, "embedding": v} for i, v in enumerate(vectors)]})


def _provider(handler, *, min_similarity: float = 0.3) -> EmbeddingSearchProvider:
    return EmbeddingSearchProvider(
        api_key="KEY",
        model="text-embedding-3-small",
        base_url="https://api.openai.com/v1",
        min_similarity=min_similarity,
        transport=httpx.MockTransport(handler),
    )


async def test_only_returns_videos_above_the_threshold_best_first() -> None:
    relevant = _video("Adding a team member", "how to invite a colleague")
    loosely = _video("Reports overview", "reading your dashboards")
    off_topic = _video("Billing setup", "payment methods and invoices")

    # query ~ [1,0,0]; relevant ~0.99, loosely ~0.24, off_topic 0.0
    def handler(request: httpx.Request) -> httpx.Response:
        return _embeddings([[1.0, 0.0, 0.0], [0.99, 0.14, 0.0], [0.24, 0.97, 0.0], [0.0, 0.0, 1.0]])

    result = await _provider(handler).search("how do I add a team member", [relevant, loosely, off_topic])
    assert [v.id for v in result] == [relevant.id]


async def test_ranks_multiple_hits_by_similarity() -> None:
    a, b = _video("A", "x"), _video("B", "y")

    def handler(request: httpx.Request) -> httpx.Response:
        # b closer to the query than a, both above 0.3
        return _embeddings([[1.0, 0.0], [0.6, 0.8], [0.9, 0.44]])

    result = await _provider(handler).search("q", [a, b])
    assert [v.id for v in result] == [b.id, a.id]


async def test_falls_back_to_keyword_on_api_error() -> None:
    v1 = _video("Create a RAG", "step by step guide")
    v2 = _video("Team invites", "invite colleagues")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    result = await _provider(handler).search("how do I create a RAG", [v1, v2])
    assert [v.id for v in result] == [v1.id]


async def test_empty_catalogue_short_circuits() -> None:
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover - must never be called
        raise AssertionError("should not embed with an empty catalogue")

    assert await _provider(handler).search("anything", []) == []


async def test_hits_the_embeddings_endpoint_with_auth() -> None:
    v1 = _video("A", "x")
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _embeddings([[1.0, 0.0], [1.0, 0.0]])

    await _provider(handler).search("q", [v1])
    assert seen[0].url.path == "/v1/embeddings"
    assert seen[0].headers["Authorization"] == "Bearer KEY"


def test_requires_api_key() -> None:
    with pytest.raises(ValueError):
        EmbeddingSearchProvider(
            api_key="", model="text-embedding-3-small", base_url="https://api.openai.com/v1", min_similarity=0.3
        )
