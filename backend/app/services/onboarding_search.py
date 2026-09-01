"""Pluggable "AI-assisted search" for the onboarding CMS (Milestone 3, task 24 -
"describe what you want support with").

- `keyword` (dev default) is a direct backend port of the frontend prototype's
  word-overlap heuristic - no external calls.
- `llm` asks OpenAI to rank the catalogue against the query and return a guided
  path (ordered video ids), which is what the client feedback asked for
  ("reasons about intent... returns a guided path, not just keyword matches").
- `embedding` scores every video by cosine similarity to the query and returns
  only those above `ONBOARDING_SEARCH_MIN_SIMILARITY`, best-first - a hard
  relevance cut-off so an off-topic catalogue entry is never surfaced.

`llm` and `embedding` both fall back to `keyword` on any API failure rather
than failing the request.
"""

from __future__ import annotations

import json
import logging
import math
import re
import uuid
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings
from app.db.control_models import OnboardingVideo

logger = logging.getLogger("safeiq.onboarding_search")

_WORD_RE = re.compile(r"\w+")

# Common words carry no search signal - without dropping them a query like
# "how to add a new team member" matches almost everything on "how"/"new".
_STOPWORDS = frozenset(
    """a about an and are as at be by can could do does for from get going have how i in
    is it its me my new of on or our so that the their them then there these this to us was
    we what when where which who why will with would you your""".split()
)


class OnboardingSearchProvider(ABC):
    @abstractmethod
    async def search(self, query: str, videos: list[OnboardingVideo]) -> list[OnboardingVideo]: ...


class KeywordSearchProvider(OnboardingSearchProvider):
    async def search(self, query: str, videos: list[OnboardingVideo]) -> list[OnboardingVideo]:
        words = [w for w in _WORD_RE.findall(query.lower()) if len(w) > 2 and w not in _STOPWORDS]
        if not words:
            return []
        scored = [
            (video, sum(1 for w in words if w in video.title.lower() or w in video.description.lower()))
            for video in videos
        ]
        return [video for video, hits in sorted(scored, key=lambda t: t[1], reverse=True) if hits]


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


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


class EmbeddingSearchProvider(OnboardingSearchProvider):
    """Semantic search with an explicit relevance cut-off. Embeds the query
    and every video's title+description, keeps only those whose cosine
    similarity clears `min_similarity`, and returns them best-first. Falls
    back to keyword search on any API failure."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        min_similarity: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required when ONBOARDING_SEARCH_PROVIDER=embedding")
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._min_similarity = min_similarity
        self._transport = transport
        self._fallback = KeywordSearchProvider()

    async def search(self, query: str, videos: list[OnboardingVideo]) -> list[OnboardingVideo]:
        if not videos:
            return []
        try:
            scored = await self._score(query, videos)
        except Exception as exc:  # noqa: BLE001 - any failure degrades to keyword search, never 500s the page
            logger.warning("OpenAI embedding search failed (%s); falling back to keyword", exc.__class__.__name__)
            return await self._fallback.search(query, videos)

        hits = [(video, score) for video, score in scored if score >= self._min_similarity]
        hits.sort(key=lambda pair: pair[1], reverse=True)
        return [video for video, _ in hits]

    async def _score(self, query: str, videos: list[OnboardingVideo]) -> list[tuple[OnboardingVideo, float]]:
        inputs = [query] + [f"{v.title}\n{v.description}" for v in videos]
        async with httpx.AsyncClient(base_url=self._base_url, transport=self._transport, timeout=20) as client:
            response = await client.post(
                "/embeddings",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={"model": self._model, "input": inputs},
            )
        response.raise_for_status()
        rows = sorted(response.json()["data"], key=lambda row: row["index"])
        vectors = [row["embedding"] for row in rows]
        query_vector = vectors[0]
        return [(video, _cosine(query_vector, vec)) for video, vec in zip(videos, vectors[1:], strict=True)]


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
    if settings.onboarding_search_provider == "embedding":
        return EmbeddingSearchProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_embedding_model,
            base_url=settings.openai_base_url,
            min_similarity=settings.onboarding_search_min_similarity,
        )
    raise NotImplementedError(
        f"Onboarding search provider '{settings.onboarding_search_provider}' isn't implemented "
        "- use 'keyword', 'llm', or 'embedding'."
    )
