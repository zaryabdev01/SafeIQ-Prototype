# API Specification (Milestone 1, item 10)

**Status:** DRAFT v0.1 - resource and endpoint shape only. Request/response schemas need to be finalised against the schema in `multi-tenant-schema.md` once ADR-002/003 are accepted. A machine-readable skeleton is at `api-spec.openapi.yaml`.

The prototype has no API today by design - it proves the UX over client-side mock state. This spec derives its resources directly from what that UX requires, which is the fastest honest path to a real spec: the screens already tell us what the API needs to serve.

## Authentication

- `POST /auth/login` - email/password (+ 2FA challenge if enabled), returns a session token scoped to exactly one tenant schema (or the control plane, for SafeIQ Internal accounts).
- `POST /auth/signup` - organisation or employee sign-up, including the KYC step.
- `POST /auth/invites/{token}/accept` - magic-link invite acceptance, creates a team member in the inviting organisation's tenant.
- All other endpoints below require an authenticated session and are implicitly scoped to that session's tenant schema - there is no tenant-ID parameter on any endpoint, because cross-tenant access is architecturally impossible except via the separate SafeIQ Internal endpoints.

## Team

- `GET /team` - list team members (Administrator/Super Admin only).
- `PATCH /team/{userId}/role` - change a team member's role.
- `POST /team/invites` - send (or generate an open) magic-link invite.
- `POST /team/invites/{id}/resend` / `POST /team/invites/{id}/cancel`
- `GET /team/{userId}` - profile, assigned RAGs, notes, flagged alert cases.
- `POST /team/{userId}/notes`

## RAG

- `GET /rags` / `POST /rags` - list / create.
- `GET /rags/{id}` - detail (documents, assigned users, keyword config).
- `POST /rags/{id}/documents` - upload (kicks off the ingestion pipeline in `rag-architecture.md`).
- `GET /rags/{id}/documents/{docId}/versions`
- `POST /rags/{id}/assignments` - assign a user, incl. `alertOwnerId`; returns the generated access code.
- `GET /rags/{id}/keywords` / `POST /rags/{id}/keywords` / `DELETE /rags/{id}/keywords/{id}`
- `GET /rags/{id}/questions?status=&user=&from=&to=&q=` - the filtered conversation audit.
- `POST /rags/{id}/questions/{id}/answer`
- `POST /rags/{id}/ask` - the end-user-facing "ask this RAG" call used by the floating agent; returns either a grounded answer + citations, or an escalation/alert-case result per `rag-architecture.md`.

## Alerts

- `GET /alert-cases?owner=me&status=open` - used by both the employee "Alerts" view and the SafeIQ Internal cross-tenant view (the internal endpoint is separate, see below).
- `POST /alert-cases/{id}/messages`
- `POST /alert-cases/{id}/close`

## Dashboard

- `GET /dashboard/summary` - team member count, active RAG count, open alert count (the three org-dashboard tiles).
- `GET /dashboard/questions?...` - same filter shape as the per-RAG endpoint, unscoped to one RAG.
- `GET /dashboard/logins?person=&from=&to=`

## Calendar

- `GET /bookings` / `POST /bookings`
- `POST /integrations/google-calendar/connect` / `DELETE /integrations/google-calendar` - OAuth connect/disconnect; on connect, bookings sync both ways via the Google Calendar API.

## Onboarding

- `GET /onboarding/videos?audience=&q=`
- `POST /onboarding/videos` (Administrator/Super Admin)
- `POST /onboarding/videos/{id}/share`

## SafeIQ Internal (control-plane scope, not tenant-scoped)

- `GET /internal/organisations`
- `GET /internal/rags` - across every organisation.
- `GET /internal/alert-cases` - across every organisation, with the same reply/close actions as the tenant-scoped endpoint above.

## Real-time

Per ADR-004: a WebSocket/AppSync channel (`/realtime`) pushes `question.created`, `question.answered`, `alert.opened`, `alert.message`, `alert.closed`, and `booking.created` events to subscribed clients - this is what backs the dashboard's "live questions" panel and the floating widget's badges without polling. Voice/video/screen-share signalling is a separate channel per the chosen media platform's SDK (Chime SDK in the current ADR-004 proposal), not multiplexed through this same socket.
