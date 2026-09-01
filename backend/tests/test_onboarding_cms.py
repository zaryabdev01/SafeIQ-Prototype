"""Integration tests against a real Postgres (see conftest.postgres_available).

Milestone 3 phase 2 model: the onboarding video catalogue is a single
shared list in `control.onboarding_videos`, authored by SafeIQ Internal
(tasks 21-22) and read by every tenant user (tasks 23-26). Analytics stay
per-org.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import override_email_sender, seed_internal_user_and_login, signup_organisation_and_login


async def _create_video(client: AsyncClient, internal_token: str, **overrides) -> dict:
    payload = {
        "title": "How to create a RAG",
        "description": "Step by step guide to setting up your first RAG",
        "thumbnail_gradient": "from-indigo-500 to-violet-600",
        "audience": "all",
        **overrides,
    }
    response = await client.post(
        "/internal/onboarding/videos", json=payload, headers={"Authorization": f"Bearer {internal_token}"}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_internal_creates_a_video_every_org_can_see(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    marker = uuid.uuid4().hex[:10]
    video = await _create_video(client, internal["access_token"], title=f"Shared catalogue {marker}")

    org_a = await signup_organisation_and_login(client, org_name="Cat Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    org_b = await signup_organisation_and_login(client, org_name="Cat Org B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")

    for org in (org_a, org_b):
        listing = await client.get("/onboarding/videos", headers={"Authorization": f"Bearer {org['access_token']}"})
        assert listing.status_code == 200
        assert any(v["id"] == video["id"] for v in listing.json())


async def test_upload_url_is_503_when_media_storage_is_not_configured(
    client: AsyncClient, postgres_available: bool, monkeypatch
) -> None:
    from app.api.routes import internal as internal_routes
    from app.services.media_storage import NullMediaStorage

    monkeypatch.setattr(internal_routes, "get_media_storage", lambda: NullMediaStorage())
    internal = await seed_internal_user_and_login(client)
    response = await client.post(
        "/internal/onboarding/videos/upload-url",
        json={"filename": "clip.mp4", "content_type": "video/mp4"},
        headers={"Authorization": f"Bearer {internal['access_token']}"},
    )
    assert response.status_code == 503


async def test_org_admin_cannot_author_the_catalogue(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="No Author Org", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    body = {"title": "x", "description": "y", "thumbnail_gradient": "g", "audience": "all"}

    # the internal author route rejects a tenant token...
    assert (await client.post("/internal/onboarding/videos", json=body, headers=headers)).status_code == 403
    # ...and the old tenant-side authoring route is gone entirely
    assert (await client.post("/onboarding/videos", json=body, headers=headers)).status_code == 405


async def test_audience_filter(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    marker = uuid.uuid4().hex[:10]
    org_only = await _create_video(client, internal["access_token"], title=f"{marker} org", audience="organisation")
    emp_only = await _create_video(client, internal["access_token"], title=f"{marker} emp", audience="employee")
    everyone = await _create_video(client, internal["access_token"], title=f"{marker} all", audience="all")

    admin = await signup_organisation_and_login(client, org_name="Filter Org", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    response = await client.get(
        "/onboarding/videos", params={"audience": "employee"}, headers={"Authorization": f"Bearer {admin['access_token']}"}
    )
    ids = {v["id"] for v in response.json()}
    assert emp_only["id"] in ids
    assert everyone["id"] in ids
    assert org_only["id"] not in ids


async def test_category_round_trips_and_filters(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    marker = uuid.uuid4().hex[:10]
    training = await _create_video(client, internal["access_token"], title=f"{marker} t", category=f"Training-{marker}")
    reports = await _create_video(client, internal["access_token"], title=f"{marker} r", category=f"Reports-{marker}")
    assert training["category"] == f"Training-{marker}"

    admin = await signup_organisation_and_login(client, org_name="Cat Filter Org", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    listing = await client.get("/onboarding/videos", params={"category": f"Training-{marker}"}, headers=headers)
    ids = {v["id"] for v in listing.json()}
    assert training["id"] in ids
    assert reports["id"] not in ids


async def test_search_matches_and_logs_event(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    token = uuid.uuid4().hex[:8]
    hit = await _create_video(client, internal["access_token"], title=f"Guidance {token}", description=f"about {token}")
    await _create_video(client, internal["access_token"], title="Unrelated decoy", description="nothing to match here")

    admin = await signup_organisation_and_login(client, org_name="Search Org", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    response = await client.get("/onboarding/videos", params={"q": f"{token} please"}, headers=headers)
    assert response.status_code == 200
    ids = [v["id"] for v in response.json()]
    assert ids == [hit["id"]]

    analytics = await client.get("/onboarding/analytics", headers=headers)
    assert analytics.status_code == 200
    body = analytics.json()
    assert body["total_searches"] == 1
    assert f"{token} please" in body["top_search_queries"]


async def test_reorder_videos(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    headers = {"Authorization": f"Bearer {internal['access_token']}"}
    marker = uuid.uuid4().hex[:10]
    first = await _create_video(client, internal["access_token"], title=f"{marker} first")
    second = await _create_video(client, internal["access_token"], title=f"{marker} second")

    listing = (await client.get("/internal/onboarding/videos", headers=headers)).json()
    order = [v["id"] for v in listing]
    swapped = order[:]
    i, j = order.index(first["id"]), order.index(second["id"])
    swapped[i], swapped[j] = swapped[j], swapped[i]

    response = await client.post("/internal/onboarding/videos/reorder", json={"ordered_video_ids": swapped}, headers=headers)
    assert response.status_code == 200
    new_order = [v["id"] for v in response.json()]
    assert new_order.index(second["id"]) < new_order.index(first["id"])


async def test_update_and_delete_video(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    headers = {"Authorization": f"Bearer {internal['access_token']}"}
    video = await _create_video(client, internal["access_token"])

    updated = await client.patch(f"/internal/onboarding/videos/{video['id']}", json={"title": "Updated title"}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated title"

    assert (await client.delete(f"/internal/onboarding/videos/{video['id']}", headers=headers)).status_code == 204

    listing = await client.get("/internal/onboarding/videos", headers=headers)
    assert all(v["id"] != video["id"] for v in listing.json())


async def test_view_and_share_recorded_in_analytics(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    video = await _create_video(client, internal["access_token"])

    admin = await signup_organisation_and_login(client, org_name="Engage Org", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    sender = override_email_sender()

    assert (await client.post(f"/onboarding/videos/{video['id']}/view", headers=headers)).status_code == 204
    share = await client.post(f"/onboarding/videos/{video['id']}/share", json={"email": "colleague@example.com"}, headers=headers)
    assert share.status_code == 204
    assert any(m["to"] == "colleague@example.com" for m in sender.sent)

    body = (await client.get("/onboarding/analytics", headers=headers)).json()
    stats = next(v for v in body["videos"] if v["video_id"] == video["id"])
    assert stats["view_count"] == 1
    assert stats["share_count"] == 1
    assert body["total_views"] == 1
    assert body["total_shares"] == 1


async def test_share_to_registered_user_resolves_their_email(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    video = await _create_video(client, internal["access_token"])

    admin = await signup_organisation_and_login(client, org_name="Share Org", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    employee_email = f"emp-{uuid.uuid4().hex[:8]}@example.com"
    invite = await client.post("/invites", json={"email": employee_email, "role": "employee"}, headers=headers)
    accept = await client.post(
        f"/invites/{invite.json()['token']}/accept", json={"full_name": "Employee Two", "password": "correct horse battery staple"}
    )
    me = await client.get("/me", headers={"Authorization": f"Bearer {accept.json()['access_token']}"})
    employee_user_id = me.json()["id"]

    sender = override_email_sender()
    share = await client.post(f"/onboarding/videos/{video['id']}/share", json={"user_id": employee_user_id}, headers=headers)
    assert share.status_code == 204
    assert any(m["to"] == employee_email for m in sender.sent)


async def test_analytics_are_per_org(client: AsyncClient, postgres_available: bool) -> None:
    internal = await seed_internal_user_and_login(client)
    video = await _create_video(client, internal["access_token"])

    org_a = await signup_organisation_and_login(client, org_name="Per Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    org_b = await signup_organisation_and_login(client, org_name="Per Org B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")

    await client.post(f"/onboarding/videos/{video['id']}/view", headers={"Authorization": f"Bearer {org_a['access_token']}"})

    body_a = (await client.get("/onboarding/analytics", headers={"Authorization": f"Bearer {org_a['access_token']}"})).json()
    body_b = (await client.get("/onboarding/analytics", headers={"Authorization": f"Bearer {org_b['access_token']}"})).json()
    assert body_a["total_views"] == 1
    assert body_b["total_views"] == 0
