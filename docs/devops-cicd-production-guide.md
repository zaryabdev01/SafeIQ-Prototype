# SafeIQ — DevOps handoff: CI/CD & environment guide

Written for whoever is setting up CI/CD and production infrastructure for the two
repos handed over to GTG-Enterprises:

- **Backend** — https://github.com/GTG-Enterprises/safeiq-be (FastAPI, real, persistent)
- **Frontend** — https://github.com/GTG-Enterprises/safeiq-fe (Next.js prototype)

Both were split out of one internal monorepo with full commit history intact.
This document is the single place that says: what env vars exist, what CI should
run, what's actually deployable today versus still just a proposed design, and
what will bite you in production if it isn't fixed first.

## 1. The most important thing to understand first

**Two very different levels of "done" exist in this codebase, and conflating them
is the single biggest risk to a DevOps handoff:**

1. **What's real and running today**: a FastAPI backend (Milestones 2–4:
   auth, multi-tenant Postgres, invites, team management, onboarding CMS, audit
   log) and a Next.js frontend that talks to it for those specific flows.
2. **What's a signed-off-pending *design proposal*, not code**: the full AWS
   production architecture in `docs/architecture/solution-architecture-aws-design.md`
   (ECS Fargate, Aurora, OpenSearch, Bedrock, Chime, Cognito, Terraform/IaC). None
   of that exists as infrastructure or code yet — the doc says so explicitly
   ("the prototype's own repository has no relationship to this design"). RAGs,
   alerts, chat, dashboard, and calendar in the frontend still run entirely on an
   in-memory mock store; there is no AI/knowledge-base backend at all yet.

Practically: you can stand up **today's** backend+frontend on ordinary
Docker/Postgres/Netlify-style infra right now (§4–§5 below). Standing up the
**proposed** AWS architecture is a separate, much larger piece of work that needs
Terraform from scratch and several still-open decisions resolved first (§8).

## 2. Repo layout after the split

Each repo is now self-contained (its own `README.md`, its own deploy config) —
neither repo's build depends on files outside it. The shared `docs/` folder
(architecture, milestone plan, this guide) currently lives only in the original
internal monorepo, not in either split repo — flag if the client's team should
get a copy of it too.

## 3. Backend — environment variables

Source of truth: `backend/.env.example`. Copy to `.env` for local/dev; **in
staging/prod these belong in a secrets manager (AWS Secrets Manager, or
whatever the eventual host provides — e.g. Render/Fly/Railway's own secrets
store if AWS isn't stood up yet), never committed or baked into an image.**

| Variable | Dev default | What it does in production |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://safeiq:safeiq@localhost:5432/safeiq` | Must point at a real Postgres reachable from wherever the API runs. **Schema-per-tenant (see §6) requires a DB user with `CREATE SCHEMA` privileges** — most managed Postgres (RDS, Aurora, Neon, Supabase) support this out of the box; some restricted managed tiers don't, so confirm before picking a host. |
| `JWT_SECRET` | `change-me-in-prod` | **Must be a real, random, long secret in every non-local environment.** This literally signs every session token — treat it like a root password. Rotate via secrets manager, never in git. |
| `JWT_ALGORITHM` | `HS256` | Shared-secret signing. Known simplification (see §7) — a KMS-backed asymmetric signer (RS256) is a real hardening step, not yet done. Fine to ship with HS256 initially provided `JWT_SECRET` is properly managed. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_MINUTES` / `ONBOARDING_TOKEN_EXPIRE_MINUTES` | `60` / `43200` / `30` | Session lifetimes. Business decision, not a technical one — confirm with the client rather than assuming the dev defaults are right for production. |
| `ENVIRONMENT` | `development` | Declared in `app/core/config.py` but **nothing in the codebase currently branches on it** — it's a placeholder today, not a behavior switch. Still worth setting to `production` for clarity/future-proofing, but don't rely on it to change anything yet. |
| `CORS_ORIGINS` | `http://localhost:3000` | **Must be the real production frontend domain(s)** — comma-separated (`app/core/config.py`'s `cors_origin_list` splits on `,` and trims whitespace, so `https://app.example.com,https://staging.example.com` works). Get this wrong and every real-mode frontend request silently fails as a CORS error, not an obvious 401/500. |
| `EMAIL_BACKEND` | `console` (logs instead of sending) | **This is a stub.** `ses` is listed as an option but explicitly **not implemented yet** — real email (invites, OTPs) needs an actual provider adapter built first. Do not assume setting this to anything but `console` currently sends real email. |
| `KYC_PROVIDER` | `mock` (auto-approves everyone) | **This is a stub.** `onfido` is listed but **not implemented** and is explicitly TBC with the client. Every KYC check currently auto-passes — this is a hard blocker for any real onboarding compliance requirement. |
| `ONBOARDING_SEARCH_PROVIDER` | `keyword` | Keyword/word-overlap search, not an LLM. `llm` is listed but blocked on a still-open "which LLM provider" decision (see §8). |
| `OTP_EXPIRE_MINUTES` / `INVITE_EXPIRE_DAYS` | `10` / `14` | Business decision, confirm with client. |
| `MAGIC_LINK_BASE_URL` | `http://localhost:3000/invite` | **Must be the real production frontend URL** — this is embedded directly into emailed invite links. Wrong value here means every invite link sent points at localhost. |

Two variables that don't exist yet but should before going live, since the app
already has the concepts:
- A **secrets-manager reference** mechanism (vs. plain env vars) once real
  infra exists — not required for an initial Docker-based deploy, but worth
  designing for from day one so it isn't a rewrite later.
- Nothing today rotates `JWT_SECRET` automatically — if that matters for this
  client's compliance posture, it's a gap to raise now, not after launch.

## 4. Frontend — environment variables

Source of truth: `frontend/.env.local.example`.

| Variable | Dev default | What it does in production |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | The real backend's base URL. **Any `NEXT_PUBLIC_*` variable is baked into the JavaScript bundle at `next build` time, not read at container runtime.** CI must set this correctly *before* the build step runs for the target environment — setting it only as a runtime container env var does nothing. |

**Only one real env var exists on the frontend today** because only a handful
of screens (signup, login, team, team-member-profile, settings, magic-link
invite, onboarding-video) call the real backend at all. Everything else — RAGs,
alerts, chat, dashboard, calendar — runs entirely from an in-memory mock store
seeded with demo data; it needs no backend and no additional configuration.

**A product decision, not a technical one, that DevOps should get an explicit
answer to before launch**: the login page's "explore instantly as..." demo
personas are fully mock and require no auth. Should that quick-login list be
reachable on the real production domain, or gated behind a staging-only build?
Nothing in the code currently distinguishes "production" from "demo" at that
level — it's the same build either way today.

## 5. CI recommended for each repo (GitHub Actions)

Neither repo has a CI workflow today — this is greenfield. These are the exact
checks already used to verify every change in this codebase during
development, so wiring them into CI first is low-risk and immediately useful.

**Backend** (`safeiq-be/.github/workflows/ci.yml`), run on every PR and on `main`:
```yaml
name: CI
on: [pull_request, push]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        # Match the deployed database engine (Aurora PostgreSQL 15).
        image: postgres:15-alpine
        env: { POSTGRES_USER: safeiq, POSTGRES_PASSWORD: safeiq, POSTGRES_DB: safeiq }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U safeiq" --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements-dev.txt
      - run: ruff check app tests scripts
      - run: mypy app scripts
      - run: pytest
        env:
          DATABASE_URL: postgresql+asyncpg://safeiq:safeiq@localhost:5432/safeiq
          JWT_SECRET: ci-test-secret
```
Note from `backend/README.md`: the Postgres-gated integration tests (tenant
isolation, auth flow, onboarding CMS, team profile) need a *real* Postgres —
they skip cleanly with a clear message if one isn't reachable, they don't fail
silently. The `services:` block above gives them one. Expect this suite to
take longer than the unit-only tests; a 15–25 minute CI job for the full suite
against real Postgres isn't unusual per the README's own numbers.

**Frontend** (`safeiq-fe/.github/workflows/ci.yml`):
```yaml
name: CI
on: [pull_request, push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}
```
(`vars.NEXT_PUBLIC_API_URL` = a GitHub Actions **repository variable**, not a
secret — it's public in the bundle anyway once built, so there's no
confidentiality benefit to hiding it, just configure it per-environment.)

## 6. Deployment — what's actually available today

**Backend**: `backend/Dockerfile` + `backend/docker-compose.yml` already build
and run the API against Postgres locally. For a real environment: run the same
image behind any container host (ECS, Fly, Render, a plain VM with Docker) in
front of a real managed Postgres, with `.env` values replaced by real secrets.
`python scripts/init_db.py` runs the control-plane Alembic migrations — this
must run against the target database before the API's first real request in
any new environment.

**Frontend (updated 25/08 — moved off Netlify to S3 + CloudFront + Route 53)**:
`next.config.ts` now sets `output: "export"`, and `npm run build` produces a
static `out/` folder (HTML/CSS/JS only, no server) that GitHub Actions syncs
to S3. `NEXT_PUBLIC_API_URL` must be set correctly *before* that build step,
same caveat as §4 above.

This app has three dynamic routes — `/rag/[id]`, `/team/[id]`,
`/invite/[token]` — and static export can only pre-render pages for ids known
at build time. `generateStaticParams()` on each seeds the fixed demo
personas/RAGs/a placeholder invite token (see the comments in each
`page.tsx`); the client components (`RagDetailClient`, `TeamMemberClient`,
`AcceptInviteClient`) all read the *real* id from `window.location.pathname`
via a lazy `useState` initializer rather than trusting the id baked into
whichever static file actually got served — this is what makes a CDN fallback
render the right content instead of silently showing the wrong RAG/profile.
**Two things S3/CloudFront must be configured to do, or these routes 404 in
production:**

1. **Serve `path.html` for a request to `path` with no extension.** `next export`
   emits flat files (`team/u-admin.html`), not `team/u-admin/index.html` — a
   bare `/team/u-admin` request needs a CloudFront Function (viewer-request)
   that appends `.html` when the URI has no extension and doesn't already end
   in `/`.
2. **Fall back to a pre-rendered shell for ids outside the seeded set** — e.g.
   `/rag/rag-careplans.html` for anything under `/rag/*` that doesn't exist as
   its own object, similarly for `/team/*` and `/invite/*`. Once that shell's
   JS boots, the `window.location` read above corrects it to the real id.
   This needs a CloudFront Function or Lambda@Edge per path-prefix — the
   built-in "Custom Error Responses" feature is per-distribution, not
   per-prefix, so it can't target three different fallback files on its own.

**Known limitation, not yet resolved — flag before relying on this in a demo
or with the client:** the app's mock/demo data (RAGs, alerts, team members
created via the UI, *not* signed in through the real backend) lives only in
an in-memory React store, seeded fresh on every page load. Under static
export, navigating to (or refreshing) a RAG/team-member id that wasn't known
at build time forces a *hard* browser navigation (there's no server to serve
a soft client-side transition for an unknown route) — that hard reload resets
the in-memory mock store, so anything created earlier in that mock session
(e.g. a RAG just created via the wizard) will read as "not found" afterward,
even though the CDN fallback above is working correctly. This does **not**
affect real, backend-connected accounts (signup/login/invite-accept/team
profile when signed in for real) — that data lives on the actual API server
and just gets refetched. Two ways to close this gap, not yet decided:
persist the mock store to `localStorage` so it survives a hard reload, or
restructure these three pages to read their id from a query string
(`/rag?id=...`) instead of a path segment, so viewing a different id never
triggers a route-level navigation at all. Worth a decision before this goes
in front of the client as a live demo.

**What's proposed but not started**: the full AWS design in
`docs/architecture/solution-architecture-aws-design.md` — Terraform/IaC,
ECS Fargate, Aurora, Cognito, OpenSearch, Bedrock, Chime, SES, KMS, Secrets
Manager, CloudWatch/X-Ray, CloudTrail/GuardDuty. Treat that document as the
target-state design to build toward, not a description of anything running
today.

## 7. Must-fix-before-real-users checklist

Everything here is called out honestly in `backend/README.md`'s "Known
simplifications" section — repeating it here because it's exactly what a
DevOps/production readiness review needs to catch before go-live, not just an
engineering footnote:

- **Tenant schema migrations don't propagate to existing tenants.**
  `provision_tenant_schema` uses `metadata.create_all`, which correctly builds
  every current table for a *brand-new* organisation signing up, but a schema
  change made *after* tenants already exist has no automated way to reach
  their already-provisioned schemas. **A per-schema migration runner is
  required before this can safely ship a second schema change post-launch.**
  This is the single most important gap for whoever owns migrations in CI/CD.
- **Audit-ledger insert-only enforcement is partial.** UPDATE/DELETE is
  revoked from `PUBLIC` on `audit_ledger`, but Postgres always lets the
  table's *owner* role bypass that. Real enforcement needs the app's runtime
  DB connection to use a distinct, deliberately-restricted role, separate from
  whatever role runs migrations/provisioning.
- **Email and KYC are both dev-only stubs** (§3) — real adapters are pluggable
  behind existing interfaces (`EmailSender`, `KycProvider`) but need a provider
  chosen and implemented; both are explicitly listed as still-open questions
  with the client.
- **JWT signing is HS256/shared-secret**, not KMS-backed asymmetric — acceptable
  to launch with if `JWT_SECRET` is properly secret-managed, but a real
  production-hardening backlog item.
- **SafeIQ Internal accounts have no auth routes yet** — modelled in the schema,
  out of scope for what's built so far.
- **Onboarding video storage is a free-text URL field, not a real upload
  pipeline** — no S3 (or equivalent) integration exists yet for that feature.

## 8. Open decisions blocking the *next* layer (not this handoff, but worth flagging)

These aren't CI/CD or environment issues — they're product/vendor decisions
still open in the milestone plan that block building the AI/RAG backend at all:

- **Which LLM provider** (Bedrock/Claude is proposed, not confirmed) —
  blocks `ONBOARDING_SEARCH_PROVIDER=llm` and the entire RAG-answering backend.
- **KYC provider** (Onfido/Jumio proposed, not confirmed).
- **Email provider** (SES proposed, not confirmed).
- **Audit-ledger technology sign-off** — ADR-005 proposes a hash-chained
  ledger instead of the brief's literal "blockchain," and explicitly needs the
  client's explicit sign-off on that substitution before being treated as
  decided.
- **No ADR yet for identity/auth at the AWS layer** (Cognito is recommended,
  not yet an accepted decision) — today's JWT-based auth is what's actually
  running; Cognito migration is a separate future project, not a drop-in swap.

## 9. Quick reference — who owns what today

| Area | Status |
|---|---|
| Auth, multi-tenant Postgres, invites, team mgmt, onboarding CMS, audit log | **Real, running, has tests** |
| RAGs, alerts, chat, dashboard, calendar | **Mock only** — no backend exists for these yet |
| CI/CD | **Not started** — §5 above is the recommended starting point |
| Production infra (any kind) | **Not started** — §6 above is what can be stood up today; §1/§8 explain the gap to the proposed AWS target |
