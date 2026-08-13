# SafeIQ backend

FastAPI service implementing **Milestone 2 — Authentication & Multi-Tenant Foundation** and
**Milestone 3 — Onboarding CMS** from `docs/SafeIQ_Milestone_Plan_v1.1_revised.docx`, built against
the architecture already proposed in `docs/architecture/` (ADR-003's schema-per-tenant model,
ADR-005's hash-chained audit ledger, security-compliance-design.md's role hierarchy and Argon2id
hashing).

This is a real, persistent backend - not a mock. The frontend prototype in `../frontend` is now
partially integrated with it: signup, login, magic-link invites, team/role management, account
settings, the audit trail, and the onboarding video CMS all call this API for real when signed in
through the real email/password flow (as opposed to a demo persona) - see the root `README.md`'s
"Real vs. mock" section. Everything else in the frontend (RAGs, alerts, chat, dashboard, calendar)
still runs on the mock store, since this backend doesn't implement those modules yet.

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
`tests/test_tenant_isolation.py`, and `tests/test_onboarding_cms.py` are integration tests that need
a real Postgres (schema-per-tenant relies on `CREATE SCHEMA`, which SQLite can't do) -
`tests/conftest.postgres_available` skips them with a clear message rather than failing when one
isn't reachable. Against a real (e.g. Neon free-tier) database, the full suite takes several minutes
- most integration tests provision a brand-new tenant schema, which is real DDL against real
infrastructure, not a mock.

## What Milestone 2 asked for, and where it lives

| Task | Implementation |
|---|---|
| 14. Org & employee registration and login | `app/api/routes/auth.py` - `/auth/signup/organisation`, `/auth/signup/employee`, `/auth/login` |
| 15. KYC provider integration | `app/services/kyc.py` - pluggable `KycProvider` interface, `MockKycProvider` auto-approves. Provider is explicitly **TBC with the client** (milestone plan, Questions & Concerns) - swap in a real Onfido/Jumio adapter behind the same interface once chosen |
| 16. Magic-link invitations | `app/api/routes/invites.py` - create (email or shareable link), preview, accept, resend, cancel |
| 17. Roles and permissions | `app/models/tenant.py::TeamRole` + `app/api/deps.py::require_role` - matches the hierarchy confirmed in `security-compliance-design.md` #4 |
| 18. Multi-tenant data model, DB-level isolation | `app/services/tenant_provisioning.py` + `app/db/session.py` - real Postgres schema-per-tenant (ADR-003), not a `tenant_id` column |
| 19. Account settings, country/language | `app/api/routes/users.py` - `PATCH /me/settings` |
| 20. Audit-log foundation | `app/services/audit.py` - hash-chained, append-only (ADR-005); wired into every Milestone 2 action (signup, verify, KYC, login, role change, invite lifecycle) as its first real usage |

## What Milestone 3 (Onboarding CMS) asked for, and where it lives

| Task | Implementation |
|---|---|
| 21. Video CMS (upload, thumbnail, title, description) | `app/api/routes/onboarding.py` - `POST/PATCH/DELETE /onboarding/videos`. `media_url` is nullable free text, not a real upload pipeline - S3 isn't provisioned yet (see Known simplifications) |
| 22. Control video order from the CRM | `POST /onboarding/videos/reorder`, admin-only |
| 23. Search and filtering by end-user type | `GET /onboarding/videos?audience=` |
| 24. AI-assisted search | `app/services/onboarding_search.py` - pluggable `OnboardingSearchProvider`, `KeywordSearchProvider` is a direct backend port of the frontend prototype's own word-overlap heuristic. A real LLM-backed provider is blocked on the still-open, CRITICAL "which LLM" question in the milestone plan's Questions & Concerns |
| 25. Hover-description / click-to-view | Frontend-only UX (`frontend/src/app/onboarding/page.tsx`); `POST /onboarding/videos/{id}/view` records the resulting view server-side |
| 26. Share by email / to a registered user | `POST /onboarding/videos/{id}/share` - reuses the same `EmailSender` interface as Milestone 2's invites; "share to a registered user" resolves their email server-side rather than needing a separate in-app notification channel, since none exists yet |
| 27. Onboarding analytics | `GET /onboarding/analytics` - view/share counts per video, top search queries, aggregated from `OnboardingEvent` (kept separate from the audit ledger, which is for compliance evidence, not high-volume analytics) |

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
- **Audit-ledger insert-only enforcement is partial.** `provision_tenant_schema` revokes
  UPDATE/DELETE on `audit_ledger` from `PUBLIC`, but Postgres always lets a table's *owner* role
  bypass that. True enforcement against the app's own runtime connection needs a second,
  deliberately-restricted DB role for normal request traffic, distinct from the
  provisioning/migration role - not done here yet.
- **Email and KYC are both pluggable interfaces with dev-only implementations** (`ConsoleEmailSender`
  logs instead of sending; `MockKycProvider` auto-approves). Both providers are explicitly listed as
  TBC with the client in the milestone plan's Questions & Concerns - swapping in real adapters
  (AWS SES; Onfido/Jumio) doesn't require touching any route, only a new class behind the existing
  interface.
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
- **Onboarding "AI-assisted search" is keyword matching, not a real LLM call**, for the same reason
  KYC and email are stubbed: the underlying provider decision hasn't been made. See
  `app/services/onboarding_search.py`.
