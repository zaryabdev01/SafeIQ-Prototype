"""Pluggable "AI-assisted search" for the onboarding CMS (Milestone 3,
task 24 - "describe what you want support with").

Which LLM provider to use is still an explicitly open, CRITICAL question
in the milestone plan's Questions & Concerns ("This is the single biggest
cost driver... sets the whole running-cost model") - it hasn't been
answered, so there is no real LLM call to make yet. `KeywordSearchProvider`
is a direct backend port of the same word-overlap heuristic the frontend
prototype already used against mock data, kept behind an interface so a
real semantic/LLM-backed provider can be swapped in later without
touching the route.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod

from app.core.config import get_settings
from app.models.tenant import OnboardingVideo

_WORD_RE = re.compile(r"\w+")


class OnboardingSearchProvider(ABC):
    @abstractmethod
    async def search(self, query: str, videos: list[OnboardingVideo]) -> list[OnboardingVideo]: ...


class KeywordSearchProvider(OnboardingSearchProvider):
    async def search(self, query: str, videos: list[OnboardingVideo]) -> list[OnboardingVideo]:
        words = [w for w in _WORD_RE.findall(query.lower()) if len(w) > 2]
        if not words:
            return []
        matches = [
            video
            for video in videos
            if any(w in video.title.lower() or w in video.description.lower() for w in words)
        ]
        return matches


def get_onboarding_search_provider() -> OnboardingSearchProvider:
    settings = get_settings()
    if settings.onboarding_search_provider == "keyword":
        return KeywordSearchProvider()
    raise NotImplementedError(
        f"Onboarding search provider '{settings.onboarding_search_provider}' isn't implemented yet - "
        "blocked on the LLM provider decision (milestone plan, Questions & Concerns, CRITICAL)."
    )
