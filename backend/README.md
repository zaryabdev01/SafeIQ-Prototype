# SafeIQ backend

FastAPI service implementing **Milestone 2 — Authentication & Multi-Tenant Foundation**,
**Milestone 3 — Onboarding CMS**, and part of **Milestone 4 — Team Management** from
`docs/SafeIQ_Milestone_Plan_v1.1_revised.docx`, built against the architecture already proposed in
`docs/architecture/` (ADR-003's schema-per-tenant model, ADR-005's hash-chained audit ledger,
security-compliance-design.md's role hierarchy and Argon2id hashing).

This is a real, persistent backend - not a mock. The frontend prototype in `../frontend` is now
partially integrated with it: signup, login, magic-link invites, team/role management, team member
profiles (notes, custom alert rules), account settings, the audit trail, and the onboarding video
CMS all call this API for real when signed in through the real email/password flow (as opposed to a
demo persona) - see the root `README.md`'s "Real vs. mock" section. Everything else in the frontend
(RAGs, alerts, chat, dashboard, calendar) still runs on the mock store, since this backend doesn't
implement those modules yet.

## Quick start

```bash
cp .env.example .env
docker compose up -d db          # Postgres 16
python scripts/init_db.py        # runs Alembic migrations for the control-plane schema
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

Or run everything (API included) in Docker:

```bash
docker compose up --build
```

## Local development without Docker

Needs Python 3.12 (not 3.14 - several dependencies don't have wheels for it yet) and a Postgres
reachable at `DATABASE_URL`.

```bash
py -3.12 -m venv .venv
.venv/Scripts/activate            # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
python scripts/init_db.py
uvicorn app.main:app --reload
```

## Running tests

```bash
pytest                            # unit tests always run; Postgres-gated tests skip cleanly
                                   # with a clear reason if `docker compose up -d db` hasn't been run
ruff check app tests scripts      # lint
mypy app scripts                  # type check
```

`tests/test_security.py`, `tests/test_audit_chain.py`, and `tests/test_onboarding_search.py` are
pure unit tests with no external dependencies. `tests/test_auth_flow.py`,
`tests/test_tenant_isolation.py`, `tests/test_onboarding_cms.py`, and `tests/test_team_profile.py`
are integration tests that need a real Postgres (schema-per-tenant relies on `CREATE SCHEMA`, which
SQLite can't do) - `tests/conftest.postgres_available` skips them with a clear message rather than
failing when one isn't reachable. Against a real (e.g. Neon free-tier) database, the full suite
takes 15-25 minutes - most integration tests provision a brand-new tenant schema, which is real DDL
against real infrastructure, not a mock, and free-tier round-trip latency varies run to run.

## What Milestone 2 asked for, and where it lives

| Task | Implementation |
|---|---|
| 14. Org & employee registration and login | `app/api/routes/auth.py` - `/auth/signup/organisation`, `/auth/signup/employee`, `/auth/login` |
| 15. KYC provider integration | `app/services/kyc.py` - pluggable `KycProvider`; `MockKycProvider` (default) auto-approves, `SumsubKycProvider` runs real Sumsub verification with the async result delivered to `POST /kyc/webhook` (`app/api/routes/kyc_webhook.py`, HMAC-verified). Select with `KYC_PROVIDER` |
| 16. Magic-link invitations | `app/api/routes/invites.py` - create (email or shareable link), preview, accept, resend, cancel |
| 17. Roles and permissions | `app/models/tenant.py::TeamRole` + `app/api/deps.py::require_role` - matches the hierarchy confirmed in `security-compliance-design.md` #4 |
| 18. Multi-tenant data model, DB-level isolation | `app/services/tenant_provisioning.py` + `app/db/session.py` - real Postgres schema-per-tenant (ADR-003), not a `tenant_id` column |
| 19. Account settings, country/language | `app/api/routes/users.py` - `PATCH /me/settings` |
| 20. Audit-log foundation | `app/services/audit.py` - hash-chained, append-only (ADR-005); wired into every Milestone 2 action (signup, verify, KYC, login, role change, invite lifecycle) as its first real usage |

## What Milestone 3 (Onboarding CMS) asked for, and where it lives

The catalogue is **one shared list** in `control.onboarding_videos`, authored by
SafeIQ Internal support staff (`control.internal_users`, logged in via
`POST /internal/auth/login`) and read by every tenant user. Authoring (tasks
21-22) lives on `app/api/routes/internal.py` under `/internal/onboarding/*`;
consumption (tasks 23-26) on `app/api/routes/onboarding.py` under `/onboarding/*`,
open to any org role. Analytics (task 27) stay per-tenant.

| Task | Implementation |
|---|---|
| 21. Video CMS (upload, thumbnail, title, description) | `POST/PATCH/DELETE /internal/onboarding/videos` - SafeIQ Internal only. Real S3 media upload via `MediaStorage` (`app/services/media_storage.py`, `MEDIA_STORAGE_BACKEND=s3\|none`); `media_url` also accepts an external link directly |
| 22. Control video order from the CRM | `POST /internal/onboarding/videos/reorder` - SafeIQ Internal only |
| 23. Search and filtering by end-user type | `GET /onboarding/videos?audience=` - any org user, reads the shared catalogue |
| 24. AI-assisted search | `app/services/onboarding_search.py` - pluggable `OnboardingSearchProvider`. `keyword` (default) is stopword-filtered word overlap; `llm` asks OpenAI for a ranked guided path; `embedding` scores every video by cosine similarity to the query and returns only those above `ONBOARDING_SEARCH_MIN_SIMILARITY` (default 0.35, tune per environment; scores are logged per query at INFO for calibration), best-first. `llm`/`embedding` fall back to keyword on any API failure |
| 25. Hover-description / click-to-view | Frontend-only UX; `POST /onboarding/videos/{id}/view` records the resulting view in the tenant's own `OnboardingEvent` table |
| 26. Share by email / to a registered user | `POST /onboarding/videos/{id}/share` - reuses Milestone 2's `EmailSender`; "share to a registered user" resolves their email from the tenant schema server-side |
| 27. Onboarding analytics | `GET /onboarding/analytics` - org admin, **their own org only**: view/share counts and top queries from that tenant's `OnboardingEvent` rows joined to the shared catalogue. Cross-org rollups for SafeIQ Internal are follow-up work |

## What Milestone 4 (Team Management) asked for, and where it lives

Tasks 28-30 (invite by email/magic link, accept-invite flow, invite log with resend/cancel) were
already built as part of Milestone 2's `app/api/routes/invites.py` - they turned out to be needed
early, to have any way to create a second user for testing signup/login. Task 31 followed. Tasks
32-34 now have a real (thin) `Rag` entity to assign against and a real Employee×RAG activity view,
and the client-feedback addendum's tasks 96/105/106/107/108 are real too - see
`.claude/specs/m4-team-management.md` (Phases 1-4) for the phase breakdown and their deliberate scope
boundaries; the standing "client feedback = UI/mock-store only" rule is explicitly overridden for
the addendum items, per that spec's Decisions section.

| Task | Implementation |
|---|---|
| 28-30. Invites, accept flow, invite log | Already built in Milestone 2 - `app/api/routes/invites.py` |
| 31. Member profiles (details, notes, alerts) | `GET /team/{id}` for the profile; `GET/POST /team/{id}/notes` and `GET/POST/DELETE /team/{id}/alert-rules` for notes and custom alert-rule configuration - both gated to manager/support/administrator/super_admin (`_TEAM_MANAGERS` in `app/api/routes/users.py`), matching who the frontend already let manage this |
| 32. RAG assignments with access codes | `app/api/routes/rags.py` - `Rag` is a **thin, identity/lifecycle-only stub** (draft/published/archived; no ingestion, retrieval, or documents - that's Milestone 5, which extends this same table rather than replacing it). `POST/GET/PATCH/DELETE /rags` (admin write, manager+ read) plus `POST/GET /rags/{id}/assignments`, `PATCH .../assignments/{aid}`, `POST .../assignments/{aid}/rotate-code` issue/rotate/revoke a human-readable access code (`app/services/access_code.py`) per (RAG, person). The code is **not yet an authentication factor** - Milestone 6 (chat agent) is what will eventually consume it to switch RAG context |
| 33. Per-member activity view inside each RAG | `app/api/routes/team_profile.py` - `GET /team/{id}/rags/{rag_id}` (record shell) plus lazy-loaded tabs `.../overview`, `.../conversations`, `.../alerts`, `.../actions`, `.../audit-log`. `.../conversations` is a documented stub (`{items: [], note: "..."}`) until Milestone 6; `.../audit-log` is a content-free projection (`event_type`/`owner`/`created_at` only - never `content`), the "separate, content-free Audit Log" the client asked for |
| 34. Assignment management | `app/api/routes/rags.py` - see task 32. A person can hold at most one *active* assignment per RAG (handler check + a real Postgres partial-unique index as the DB-level backstop); revoking keeps the row for history rather than deleting it |
| 96. Safeguarding Lead + content-level visibility | `User.is_safeguarding_lead`; `PATCH /team/{id}/safeguarding-lead` (admin-only, `_ROLE_ADMINS`). `app/api/deps.py::can_view_conversation_content` is the pure gating function (mirrors the frontend's `permissions.ts`) - not wired into a route yet, since there's no real conversation content until Milestone 6 |
| 105. Search + bulk on team/invite lists | `GET /team?q=&include_archived=&limit=&offset=`, `GET /invites?q=&status=&limit=&offset=`, `POST /team/bulk-status`, `POST /invites/bulk-resend`, `POST /invites/bulk-cancel` - all in `app/api/routes/{users,invites}.py` |
| 106. Archive status for team members | `User.status` (`active`\|`archived`); `PATCH /team/{id}/status`. Deliberately **not** a login block - an archived user's existing tokens keep working; see the route docstring |
| 107. Risk-and-support dashboard for one member | `GET /team/{id}/profile` (`app/api/routes/team_profile.py`) - header, summary cards (assigned RAGs / conversations, always 0 until M6 / open alerts / open actions), and a per-RAG `traffic_light` (`{level, label}` - always both, never colour alone, per the client's accessibility ask). The exact severity/action-count thresholds are a first defensible default (`app/services/risk_dashboard.py`), isolated as a pure function since the spec leaves the real business rule undefined |
| 108. Staged alert model + Actions pipeline | `app/api/routes/alerts.py` - `Alert` is the alert **occurrence** (distinct from `PersonAlertRule`, config, and from the mock `AlertCase` chat-thread type). Its 6-stage lifecycle (`keyword_detected → signal_generated → context_assessment → alert_level_set → human_review → outcome`) is forward-only (`POST /alerts/{id}/advance`, validated against a module-level stage-order tuple, never enum arithmetic); reaching `outcome` requires a `resolved\|escalated\|no_action` outcome and closes the alert. No RAG engine generates these yet - creation is manual, and `POST /alerts` infers the starting stage from whether a `keyword` was supplied, mirroring what Milestone 5's automatic keyword detection will eventually do into the same table. `app/api/routes/actions.py` is the separate, shared `Action` entity (the addendum's 4-stage `tier`: `information_only\|recommended_action\|required_review\|urgent_action`) - built here because Milestone 4 Phase 4's profile dashboard and Milestone 7's org/employee dashboards both consume it |

The frontend's team member profile page (`frontend/src/app/team/[id]/TeamMemberClient.tsx`) reflects
this honestly: notes and alert rules are fully real when signed in for real, while the "flagged
alert words" and "assigned RAG systems" sections show an explicit notice that they're waiting on
Milestone 5, rather than silently rendering empty mock data that could be mistaken for a bug. Tasks
32-34/96/105-108 above are backend-only as of this revision - the frontend real-mode wiring for them
is a separate, still-pending phase (Phase 5 of the M4 spec).

`app/api/routes/team_profile.py`'s `.../overview` tab deliberately deviates from the M4 spec's §4.3:
rather than a denormalised `RagActivityEvent` feed table written by every Phase 2/3 handler (which
would mean reopening those already-shipped phases), it's a live aggregation query across
`RagAssignment`/`Alert`/`AlertStageTransition`/`Action` for that (person, RAG) pair. Simpler
consistency story at this data volume, at the cost of a few extra queries per call instead of one
indexed read - a trade worth naming explicitly rather than leaving as a silent departure from the
spec.

## Client feedback (17/08/2026) - Phase 1a: real login history

Neil's review asked for Settings' "Account login history" to be real instead of mock data, with
search. `LoginEvent` (`app/models/tenant.py`) is a small tenant table separate from the audit
ledger by design: ADR-005's ledger only ever stores a `content_hash`, never real PII, so it
structurally cannot answer "what IP did this user log in from." `POST /auth/login`
(`app/api/routes/auth.py`) writes a `LoginEvent` row (capturing the request's IP and user-agent) in
the same transaction as its existing `user.logged_in` audit entry, so the two can never drift out
of sync. `GET /team/login-history?q=&user_id=&limit=` (`app/api/routes/users.py`, admin-only, same
`_TEAM_MANAGERS` gate as `/team`) serves it, with `q` matching against name/email. Registered before
`GET /team/{user_id}` deliberately, since FastAPI matches path templates in registration order and
the literal `/team/login-history` segment would otherwise be swallowed by that parameterised route.
Covered by `tests/test_login_history.py`.

## One-off maintenance scripts

| Script | Purpose |
|---|---|
| `scripts/migrate_tenant_onboarding.py` | Milestone 3 phase 2 - drops the now-unused per-tenant `onboarding_videos` table/FK after the catalogue moved to `control.onboarding_videos` |
| `scripts/backfill_m4.py` | Milestone 4 - backfills `users.status` / `users.is_safeguarding_lead` (Phase 1) plus any new tenant-schema table from later phases onto tenants provisioned before that Milestone 4 phase's model change landed. Idempotent; run after every M4 phase that changes the tenant schema |

## How multi-tenancy actually works here

Every organisation gets its own real Postgres schema (`tenant_<org_id>`), created at sign-up time
by `provision_tenant_schema()`. Tenant models (`app/models/tenant.py`) are declared once against a
placeholder `schema="tenant"`; a request's `AsyncSession` rewrites that to the real schema via
SQLAlchemy's `schema_translate_map` (`app/db/session.py::tenant_session`). There is no tenant-ID
column or WHERE-clause filter involved anywhere - a session bound this way cannot address another
tenant's data, by construction. `tests/test_tenant_isolation.py` proves this rather than just
asserting it.

A small **control-plane** schema (`control`) holds the organisation registry plus two lookup
indexes (`user_directory`, `invite_index`) that exist purely so an unauthenticated request (login,
invite accept) can be routed to the right tenant schema before we know who's asking - see
`app/db/control_models.py`.

## Known simplifications (flagged honestly, not hidden)

- **Tenant schema provisioning uses `metadata.create_all`, not per-schema Alembic migrations.** This
  correctly creates every *current* table for a *new* tenant, but doesn't yet propagate a *future*
  schema change to every *existing* tenant automatically. A real per-schema migration runner is
  follow-up work once the schema starts changing after tenants already exist. The control-plane
  schema (one instance, shared) does use real Alembic migrations - see `alembic/`.
- **`Rag` is identity/lifecycle-only until Milestone 5.** No ingestion, chunking, embeddings,
  retrieval, or documents - `.claude/specs/m4-team-management.md` §4.1 is the hand-off contract M5
  must honour (extend the table, don't rename it or repurpose `RagStatus`'s values, since
  `RagAssignment`/future `Alert`/`Action` all FK `Rag.id`).
- **A RAG assignment's access code is issued/rotated/revoked but is not yet an authentication
  factor.** Milestone 6 (chat agent) is what will eventually consume it to switch RAG context; until
  then it's a human-readable identifier, stored as-is (not hashed) since it isn't security-bearing
  yet - revisit if M6 makes it one.
- **`Alert` occurrences are created manually, not from real keyword detection.** `POST /alerts`
  infers a plausible starting stage from whether a `keyword` was supplied, but there's no RAG engine
  watching conversations yet - Milestone 5 wires automatic creation into this same table.
- **Audit-ledger insert-only enforcement is partial.** `provision_tenant_schema` revokes
  UPDATE/DELETE on `audit_ledger` from `PUBLIC`, but Postgres always lets a table's *owner* role
  bypass that. True enforcement against the app's own runtime connection needs a second,
  deliberately-restricted DB role for normal request traffic, distinct from the
  provisioning/migration role - not done here yet.
- **Email and KYC each have a real adapter plus a dev stub, selected by env var.**
  `EMAIL_BACKEND=console` (default) logs instead of sending; `EMAIL_BACKEND=smtp` sends over real
  SMTP (`SmtpEmailSender`) - Gmail SMTP as the interim provider, AWS SES over SMTP for production.
  `KYC_PROVIDER=mock` (default) auto-approves; `KYC_PROVIDER=sumsub` (`SumsubKycProvider`) runs real
  Sumsub verification, whose async outcome arrives on `POST /kyc/webhook` (HMAC-verified). The
  production provider choice (SES / Sumsub) is confirmed with the client; earlier drafts list these
  as TBC.
- **JWT signing is HS256/shared-secret.** A KMS-backed asymmetric signer is a production hardening
  step, not required for Milestone 2.
- **SafeIQ Internal accounts** (`control.internal_users`) are modelled for schema completeness but
  have no auth routes yet - out of scope for Milestone 2's org/employee-focused tasks.
- **Login requires an `organisation_id`** because the same email can legitimately belong to
  different people in different organisations' isolated schemas - `GET /auth/organisations?email=`
  is the control-plane lookup that lets a login screen resolve which organisation(s) an email
  belongs to first, then ask for a password against the chosen one.
- **Onboarding videos have no real media storage.** `OnboardingVideo.media_url` is a nullable free-text
  field - there's no S3 upload pipeline yet, matching how the frontend prototype itself only ever
  captured a filename, never a real file. Wiring real upload/playback is follow-up work once storage
  is provisioned.
- **Onboarding "AI-assisted search" has a keyword stub and a real LLM adapter.**
  `ONBOARDING_SEARCH_PROVIDER=keyword` (default) is word-overlap matching; `=llm`
  (`OpenAiSearchProvider`) asks OpenAI to rank the catalogue into a guided path and falls back to
  keyword if the API call fails. See `app/services/onboarding_search.py`.
