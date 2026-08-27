"""Pluggable "AI-assisted search" for the onboarding CMS (Milestone 3, task 24 -
"describe what you want support with").

- `keyword` (dev default) is a direct backend port of the frontend prototype's
  word-overlap heuristic - no external calls.
- `llm` asks OpenAI to rank the catalogue against the query and return a guided
  path (ordered video ids), which is what the client feedback asked for
  ("reasons about intent... returns a guided path, not just keyword matches").
  If the OpenAI call fails for any reason it falls back to `keyword` rather than
  failing the request.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings
from app.models.tenant import OnboardingVideo

logger = logging.getLogger("safeiq.onboarding_search")

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


class OpenAiSearchProvider(OnboardingSearchProvider):
    _SYSTEM_PROMPT = (
        "You help an employee find the most relevant onboarding help videos. "
        "Given a catalogue and a request, return the video ids that genuinely help, "
        "most useful first, as a guided path. Respond as JSON: {\"video_ids\": [\"id\", ...]}. "
        "Use only ids from the catalogue. Return an empty list if nothing is relevant."
    )

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required when ONBOARDING_SEARCH_PROVIDER=llm")
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._transport = transport
        self._fallback = KeywordSearchProvider()

    async def search(self, query: str, videos: list[OnboardingVideo]) -> list[OnboardingVideo]:
        if not videos:
            return []
        try:
            ranked_ids = await self._rank(query, videos)
        except Exception as exc:  # noqa: BLE001 - any failure degrades to keyword search, never 500s the page
            logger.warning("OpenAI onboarding search failed (%s); falling back to keyword", exc.__class__.__name__)
            return await self._fallback.search(query, videos)

        by_id = {video.id: video for video in videos}
        ordered: list[OnboardingVideo] = []
        for raw_id in ranked_ids:
            try:
                video = by_id.get(uuid.UUID(str(raw_id)))
            except (ValueError, AttributeError):
                continue
            if video is not None and video not in ordered:
                ordered.append(video)
        return ordered

    async def _rank(self, query: str, videos: list[OnboardingVideo]) -> list[str]:
        catalogue = [
            {"id": str(v.id), "title": v.title, "description": v.description[:400]}
            for v in videos
        ]
        payload = {
            "model": self._model,
            "response_format": {"type": "json_object"},
            "temperature": 0,
            "messages": [
                {"role": "system", "content": self._SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps({"request": query, "catalogue": catalogue})},
            ],
        }
        async with httpx.AsyncClient(base_url=self._base_url, transport=self._transport, timeout=20) as client:
            response = await client.post(
                "/chat/completions",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json=payload,
            )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        ids = parsed.get("video_ids", [])
        if not isinstance(ids, list):
            raise ValueError("OpenAI response 'video_ids' was not a list")
        return [str(i) for i in ids]


def get_onboarding_search_provider() -> OnboardingSearchProvider:
    settings = get_settings()
    if settings.onboarding_search_provider == "keyword":
        return KeywordSearchProvider()
    if settings.onboarding_search_provider == "llm":
        return OpenAiSearchProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            base_url=settings.openai_base_url,
        )
    raise NotImplementedError(
        f"Onboarding search provider '{settings.onboarding_search_provider}' isn't implemented - use 'keyword' or 'llm'."
    )
