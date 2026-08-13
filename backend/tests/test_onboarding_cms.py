"""Integration tests against a real Postgres (see conftest.postgres_available).
Run with: docker compose up -d db && pytest tests/test_onboarding_cms.py
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from tests.helpers import override_email_sender, signup_organisation_and_login


async def _create_video(client: AsyncClient, headers: dict, **overrides) -> dict:
    payload = {
        "title": "How to create a RAG",
        "description": "Step by step guide to setting up your first RAG",
        "thumbnail_gradient": "from-indigo-500 to-violet-600",
        "audience": "all",
        "duration_seconds": 90,
        **overrides,
    }
    response = await client.post("/onboarding/videos", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_admin_can_create_and_list_video(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    video = await _create_video(client, headers)
    assert video["order_index"] == 0

    listing = await client.get("/onboarding/videos", headers=headers)
    assert listing.status_code == 200
    assert any(v["id"] == video["id"] for v in listing.json())


async def test_non_admin_cannot_create_video(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org B", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    invite = await client.post(
        "/invites", json={"email": f"emp-{uuid.uuid4().hex[:8]}@example.com", "role": "employee"}, headers=admin_headers
    )
    accept = await client.post(
        f"/invites/{invite.json()['token']}/accept", json={"full_name": "Employee One", "password": "correct horse battery staple"}
    )
    employee_headers = {"Authorization": f"Bearer {accept.json()['access_token']}"}

    response = await client.post(
        "/onboarding/videos",
        json={"title": "x", "description": "y", "thumbnail_gradient": "g", "audience": "all", "duration_seconds": 1},
        headers=employee_headers,
    )
    assert response.status_code == 403


async def test_audience_filter(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org C", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    await _create_video(client, headers, title="Org only video", audience="organisation")
    await _create_video(client, headers, title="Employee only video", audience="employee")
    await _create_video(client, headers, title="Everyone video", audience="all")

    response = await client.get("/onboarding/videos", params={"audience": "employee"}, headers=headers)
    titles = {v["title"] for v in response.json()}
    assert titles == {"Employee only video", "Everyone video"}


async def test_search_matches_and_logs_event(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org D", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    await _create_video(client, headers, title="How to invite your team", description="Send a magic link")
    await _create_video(client, headers, title="Booking a calendar slot", description="Pick a date and time")

    response = await client.get("/onboarding/videos", params={"q": "how do I invite my team"}, headers=headers)
    assert response.status_code == 200
    titles = [v["title"] for v in response.json()]
    assert titles == ["How to invite your team"]

    analytics = await client.get("/onboarding/analytics", headers=headers)
    assert analytics.status_code == 200
    body = analytics.json()
    assert body["total_searches"] == 1
    assert "how do I invite my team" in body["top_search_queries"]


async def test_reorder_videos(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org E", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    first = await _create_video(client, headers, title="First")
    second = await _create_video(client, headers, title="Second")

    response = await client.post("/onboarding/videos/reorder", json={"ordered_video_ids": [second["id"], first["id"]]}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body[0]["id"] == second["id"]
    assert body[0]["order_index"] == 0
    assert body[1]["id"] == first["id"]
    assert body[1]["order_index"] == 1


async def test_update_and_delete_video(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org F", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    video = await _create_video(client, headers)

    updated = await client.patch(f"/onboarding/videos/{video['id']}", json={"title": "Updated title"}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated title"

    deleted = await client.delete(f"/onboarding/videos/{video['id']}", headers=headers)
    assert deleted.status_code == 204

    listing = await client.get("/onboarding/videos", headers=headers)
    assert all(v["id"] != video["id"] for v in listing.json())


async def test_view_and_share_recorded_in_analytics(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org G", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    video = await _create_video(client, headers)

    sender = override_email_sender()

    view = await client.post(f"/onboarding/videos/{video['id']}/view", headers=headers)
    assert view.status_code == 204

    share = await client.post(f"/onboarding/videos/{video['id']}/share", json={"email": "colleague@example.com"}, headers=headers)
    assert share.status_code == 204
    assert any(m["to"] == "colleague@example.com" for m in sender.sent)

    analytics = await client.get("/onboarding/analytics", headers=headers)
    body = analytics.json()
    video_stats = next(v for v in body["videos"] if v["video_id"] == video["id"])
    assert video_stats["view_count"] == 1
    assert video_stats["share_count"] == 1
    assert body["total_views"] == 1
    assert body["total_shares"] == 1


async def test_share_to_registered_user_resolves_their_email(client: AsyncClient, postgres_available: bool) -> None:
    admin = await signup_organisation_and_login(client, org_name="Onboarding Org H", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    video = await _create_video(client, headers)

    employee_email = f"emp-{uuid.uuid4().hex[:8]}@example.com"
    invite = await client.post("/invites", json={"email": employee_email, "role": "employee"}, headers=headers)
    accept = await client.post(
        f"/invites/{invite.json()['token']}/accept", json={"full_name": "Employee Two", "password": "correct horse battery staple"}
    )
    employee_id = accept.json()

    me = await client.get("/me", headers={"Authorization": f"Bearer {employee_id['access_token']}"})
    employee_user_id = me.json()["id"]

    sender = override_email_sender()
    share = await client.post(f"/onboarding/videos/{video['id']}/share", json={"user_id": employee_user_id}, headers=headers)
    assert share.status_code == 204
    assert any(m["to"] == employee_email for m in sender.sent)


async def test_onboarding_videos_are_tenant_isolated(client: AsyncClient, postgres_available: bool) -> None:
    org_a = await signup_organisation_and_login(client, org_name="Isolation Onboarding A", email=f"a-{uuid.uuid4().hex[:8]}@example.com")
    org_b = await signup_organisation_and_login(client, org_name="Isolation Onboarding B", email=f"b-{uuid.uuid4().hex[:8]}@example.com")

    await _create_video(client, {"Authorization": f"Bearer {org_a['access_token']}"}, title="Org A only video")

    listing_b = await client.get("/onboarding/videos", headers={"Authorization": f"Bearer {org_b['access_token']}"})
    assert all(v["title"] != "Org A only video" for v in listing_b.json())
