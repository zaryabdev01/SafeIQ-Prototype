"""Pure unit test for the keyword search stand-in - no database. See
app/services/onboarding_search.py for why this exists instead of a real
LLM call (the provider decision is still an open Milestone 1 question)."""

from __future__ import annotations

import uuid

from app.models.tenant import OnboardingVideo, VideoAudience
from app.services.onboarding_search import KeywordSearchProvider


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


async def test_matches_on_title_word() -> None:
    videos = [_video("How to create a RAG", "Step by step guide"), _video("Team invites", "Invite colleagues")]
    provider = KeywordSearchProvider()
    results = await provider.search("how do I create a RAG", videos)
    assert [v.title for v in results] == ["How to create a RAG"]


async def test_matches_on_description_word() -> None:
    videos = [_video("Getting started", "Learn about RAG assignments and access codes")]
    provider = KeywordSearchProvider()
    results = await provider.search("access codes", videos)
    assert len(results) == 1


async def test_no_match_returns_empty() -> None:
    videos = [_video("Getting started", "Learn the basics")]
    provider = KeywordSearchProvider()
    results = await provider.search("completely unrelated topic zzz", videos)
    assert results == []


async def test_short_words_ignored() -> None:
    videos = [_video("A B C", "Short words only")]
    provider = KeywordSearchProvider()
    results = await provider.search("a to be or", videos)
    assert results == []
