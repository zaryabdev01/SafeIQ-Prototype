# SafeIQ — Project Overview & Context

> Reference doc auto-loaded into every Claude Code session (imported from the root `CLAUDE.md`).
> Goal: give the next chat a truthful picture of **what exists, where we stand, and what's next**.
> When something here conflicts with the code, trust the code and update this file.

---

## ⛔ WORKFLOW POLICY (read `AGENTS.md` — this is company policy, penalties apply)

**Never commit or push to `main` in any repo** (`origin`, `safeiq-be`, `safeiq-fe`).
Work on a feature branch → push the branch → open a PR with `gh pr create` → a
teammate reviews and merges. You do not merge your own PRs. See `AGENTS.md` top for
the exact steps. Everything below that describes "push to `main`" or "`git push
origin main`" is **superseded by this** — branch + PR instead.

---

## What SafeIQ is

An AI-powered employee **safety & compliance** platform (care / social-services framing).
Core product idea: organisations upload policy/guidance documents into **RAGs** ("Retrieval
Augmented Generation" knowledge bases), employees ask questions against them, and the system
watches conversations for risk signals, raises **alerts**, and drives follow-up **actions** /
**incidents** / **emergencies**. Around that sit team management, onboarding training videos,
dashboards, a calendar, and an audit trail.

Most of that product vision is still **prototype-only**. A real backend exists for the
foundational slices (auth, tenants, team, onboarding CMS, audit log).

---

## Repository layout

Two independent projects plus shared docs:

| Path | What it is |
|---|---|
| `frontend/` | Next.js **16.2.11** / React **19.2.4** / Tailwind v4 UI. The Figma production redesign is done and deployed; monorepo work is on branch `figma-redesign-m2-m3`. |
| `backend/` | FastAPI / Python **3.12** service — the real, persistent, multi-tenant backend. Implements Milestone 2, Milestone 3, part of Milestone 4. |
| `docs/` | Architecture proposals, milestone plans, client-feedback notes, DevOps handoff, sales case study. Lives only in this monorepo (not in the split repos). |

### Deployed repos & the GitHub flow (read before touching backend/ or frontend/)

There are **three** repos in play:

| Repo | Role |
|---|---|
| `zaryabdev01/SafeIQ-Prototype` (this monorepo, remote `origin`) | Prototyping + reference. Holds `docs/` (nowhere else) and the full frontend prototype history. `backend/` and `frontend/` here are **a scratch/reference copy, not the deployed code.** |
| `GTG-Enterprises/safeiq-be` | **Deployed backend, source of truth.** On the client's GitHub org. Contains `app/`, `tests/`, `alembic/` **plus** its own `.github/` workflows and `terraform/` — DevOps commits infra here directly. Push to `main` auto-deploys to `https://safeiq-dev-api.theittraininghub.com` (AWS eu-west-2, ECS + Aurora PostgreSQL 15). |
| `GTG-Enterprises/safeiq-fe` | **Deployed frontend, source of truth.** Same shape. Push to `main` builds the static export (`output: "export"`) with `NEXT_PUBLIC_API_URL=https://safeiq-dev-api.theittraininghub.com` baked in; DevOps now serves it from a **container on ECS behind the shared ALB** (moved off S3 + CloudFront) → `https://safeiq-dev.theittraininghub.com`. |

**`git subtree push` does NOT work.** The split repos were created with a history
rewrite (same commit → different SHA on each side) and have since diverged with their
own infra commits. There is no shared ancestor to fast-forward from, and a forced push
would destroy DevOps's Terraform/CI work.

**Teammates push straight to `safeiq-fe/main`.** Talha merged `dev-talha-enhancements`
(PRs #1–3: responsive/mobile nav, dashboard + employee-home redesigns, auth-flow rework,
`src/app/join/[token]`, `src/lib/{apiBase,invite}.ts`, `ui/Pagination`, a conditional-export
`next.config` with an `/api-proxy` rewrite, `nginx.conf`). The monorepo `frontend/` was
synced to match (`src/` + build configs mirrored from `safeiq-fe/main`, monorepo commit
`a19c775`; split-repo infra — `nginx.conf`, `.github/`, `terraform/`, `.env` — not copied).
**`safeiq-fe/main` is the source of truth for the frontend** — before frontend work,
`git fetch` the `safeiq-fe` remote, and if it has moved, re-mirror `src/` into the monorepo.

**To ship a backend or frontend change:** work in a real checkout of `safeiq-be` /
`safeiq-fe`, or prototype in this monorepo's `backend/` / `frontend/` first and move it
across as a patch (`git diff --relative=backend <base> <tip> -- backend/ | git apply`
in the split-repo checkout). Full procedure + caveats: **`docs/repo-sync-split-repos.md`**.
Then — per the workflow policy above — **branch, push the branch, open a PR**
(`git checkout -b feat/x && git push -u origin feat/x && gh pr create --fill`). A
teammate merges; the merge to `main` is what triggers the CI/CD deploy. Do **not**
`git push origin main` yourself.

**`safeiq-be` currently has no CI** (the workflow was removed as "not gating deploys").
Run `ruff check`, `mypy`, and `pytest` (needs a local Postgres 15+; tests skip without
one) locally in the split-repo checkout before every push.

`docs/` is monorepo-only and is **not** copied to either split repo.

---

## THE key distinction: real vs. mock

The frontend serves two data sources depending on how you sign in:

- **Demo personas** ("explore instantly as…" on the login page) — 100% in-memory mock store
  (`frontend/src/lib/store.tsx` + `mockData.ts`), no backend needed. This is how the whole app
  (RAGs, alerts, chat, dashboard, calendar, incidents, emergencies) is explored today, and what
  the Figma designer uses. **Never remove this quick-login list.**
- **Real signup / login / magic-link invite** (the email+password form) — authenticates against
  `backend/` via `frontend/src/lib/apiClient.ts`, then bridges into the mock store
  (`hydrateRealAccount` / `isRealSession` in `store.tsx`) so the rest of the `currentUser`-driven
  UI keeps working. Only these screens are actually real: **signup, login, magic-link invite,
  team + roles, team-member profile (notes + custom alert rules), account settings, real login
  history feed, audit trail, and onboarding (org/employee view — filter, AI search, view, share,
  own-org analytics)**. Everything else still renders from the mock store even for a real account.
- **SafeIQ Internal console** — the login page's **Internal** tab is now real: it calls
  `POST /internal/auth/login` (`frontend/src/lib/internalApiClient.ts`, own `sessionStorage` token
  key), then `internalUserToAppUser` bridges it into the store as a `role:"internal"` session.
  `/internal/onboarding` is a real CMS page (add with file upload → presigned PUT, or paste a link;
  edit; delete; drag-to-reorder; category). The rest of `/internal/*` (org/people/RAG/alerts
  overview) is still mock. Keep the **Jordan Reyes** demo persona on the Internal tab.

Point the frontend at a backend with `frontend/.env.local` → `NEXT_PUBLIC_API_URL`
(default `http://localhost:8000`).

---

## 1) What is implemented

### Backend (real, persistent, has tests)

Milestone 2 — Authentication & Multi-Tenant Foundation:
- Org & employee **registration + login** with OTP verification — `app/api/routes/auth.py`
- **KYC** — pluggable `KycProvider`; `MockKycProvider` (default) auto-approves, `SumsubKycProvider`
  runs real Sumsub verification with the async result delivered to `POST /kyc/webhook` — `app/services/kyc.py`, `app/api/routes/kyc_webhook.py`
- **Magic-link invitations** (email or shareable link): create / preview / accept / resend / cancel — `app/api/routes/invites.py`
- **Roles & permissions** — `TeamRole` hierarchy + `require_role` — `app/models/tenant.py`, `app/api/deps.py`
- **Multi-tenancy = real Postgres schema-per-tenant** (`tenant_<org_id>`), created at signup by
  `provision_tenant_schema()`. No `tenant_id` column anywhere — isolation is structural via
  SQLAlchemy `schema_translate_map` (`app/db/session.py`). A small `control` schema holds the org
  registry + lookup indexes for unauthenticated routing. Proven by `tests/test_tenant_isolation.py`.
- **Account settings** (country / language) — `PATCH /me/settings` — `app/api/routes/users.py`
- **Audit log** — hash-chained, append-only ledger (ADR-005), wired into every M2 action — `app/services/audit.py`

Milestone 3 — Onboarding CMS (**finalised 2026-09-01**). The catalogue is **one shared list
owned by SafeIQ Internal**, not per-tenant:
- **SafeIQ Internal auth** (`app/api/routes/internal.py`): `POST /internal/auth/login`,
  `GET /internal/me`. Token carries `scope:"internal"` and none of the tenant claims;
  `get_current_internal_user` (`app/api/deps.py`) rejects a tenant token and vice-versa.
  No self-service signup — `python -m scripts.seed_internal_user --email .. --name .. --password ..`.
- **Catalogue = `control.onboarding_videos`** (Alembic `0002`), `created_by` → an internal user.
  Authoring + reorder + upload-url (tasks 21–22) → `/internal/onboarding/videos*`, internal only.
  Consumption (tasks 23–26) → `/onboarding/videos*` (`app/api/routes/onboarding.py`), any org role.
  The old tenant-side `POST/PATCH/DELETE /onboarding/videos` are **gone**.
- **`onboarding_events` stays per-tenant** (view/share/search). `GET /onboarding/analytics` is
  org-admin, **own org only** — no cross-org rollup. `scripts/migrate_tenant_onboarding.py`
  drops the now-cross-schema FK from existing tenant schemas (idempotent; new tenants are already
  the right shape).
- **Real S3 media** (`app/services/media_storage.py`): `MediaStorage` ABC → `NullMediaStorage`
  (default stub: `upload-url` 503s, responses fall back to the operator's `media_url`) or
  `S3MediaStorage` (presigned PUT for upload, CloudFront or presigned GET for playback), selected
  by `MEDIA_STORAGE_BACKEND=none|s3`. `POST /internal/onboarding/videos/upload-url` → the browser
  PUTs the file straight to S3, then creates the video with the returned `media_key`.
  `serialize_video()` resolves `media_key` → a playable URL on read. `boto3` added; creds via the
  ECS task role. Dev bucket `safeiq-dev-onboarding-media-581891203031` (eu-west-2).
- **`category`** — nullable free-text on a video (Alembic `0003`); CMS field + `?category=` filter.
- **No `duration`** — the column was dropped (Alembic `0004`); not shown or settable.
- **"AI-assisted search"** (`app/services/onboarding_search.py`), `ONBOARDING_SEARCH_PROVIDER=`:
  `keyword` (default; stopword-filtered word overlap, ranked by hit count), `llm` (`OpenAiSearchProvider`
  — OpenAI ranks the catalogue into a guided path), `embedding` (`EmbeddingSearchProvider` — cosine
  similarity of the query vs each video's title+description, keeps only ≥ `ONBOARDING_SEARCH_MIN_SIMILARITY`,
  default 0.35, best-first; scores logged per query at INFO for calibration). **No vector DB** — the
  query + whole catalogue are embedded per request. `llm`/`embedding` fall back to `keyword` on any
  API failure.

Milestone 4 — Team Management (partial):
- Invites / accept flow / invite log — already covered by M2's `invites.py`
- **Member profiles**: `GET /team/{id}`, notes (`/team/{id}/notes`), custom alert rules
  (`/team/{id}/alert-rules`) — gated to manager/support/administrator/super_admin
- Real **login history** feed with search — `LoginEvent` table + `GET /team/login-history` (client
  feedback phase 1a; kept separate from the audit ledger, which stores no PII)
- **Not implemented (hard-blocked on Milestone 5):** RAG assignments with access codes,
  per-member activity inside a RAG, assignment management — there is no RAG entity server-side yet.

### Frontend

- **Real-mode screens** (list above) call the backend through `apiClient.ts` (tenant) or
  `internalApiClient.ts` (SafeIQ Internal), bridged into the store via `apiMapping.ts`.
- **Mock-only modules** (mock store only, all sign-in types): RAGs & RAG detail
  (`/rag`, `/rag/[id]`), alerts & alert cases (`/alerts`, `alert-library`), employee area
  (`/employee/*` — my-rags, alerts, incidents, emergencies), incidents, emergencies, org &
  employee **dashboards**, **calendar** (day/week/year + side panel), the Help-Hub extras on the
  `/onboarding` **mock branch** (Help Sprint, achievements, "Required" assignments, General
  Support tab — kept mock by decision), and the non-onboarding `/internal/*` pages
  (org/people/RAG/alerts overview).
- **Settings**: the "Two-step verification" and "IP address lock" toggles were **removed**
  (mock-only, no backend, no login-time enforcement — future security-hardening scope).
- Shared feature components: `AlertRuleGovernance.tsx` (severity legend, employee/global scope
  with confirm + change history — used by team profile and RAG risk-rules), `AlertStageStepper.tsx`
  / `AlertCaseThread.tsx` (staged alert pipeline), `AppShell` / `Sidebar` / `TopBar`.
- Permission gates in `frontend/src/lib/permissions.ts` (`isOrgLevel`, `canViewConversationContent`)
  hide raw conversation text from non-safeguarding-leads.
- All mock entities are typed in `frontend/src/lib/types.ts` (Rag, RagDocument, AlertCase, Action,
  Incident, EmergencyEvent, OnboardingVideo, Booking, Conversation, …).

### Client-feedback rounds (Neil)

Two review rounds implemented. Phase 1 (login history, team search/scroll/bulk, calendar count)
shipped as real backend + frontend. **Everything after that is UI / mock-store only by standing
instruction** — see "Working rules" below. Round-2 phase 2 added: team archive status, calendar
day/year + side panel, the alert-rule governance model, `/alert-library` review queue, the generic
`Action` entity, org + employee dashboard redesigns, the team-member "risk-and-support dashboard",
the RAG detail tab restructure, and the Help Hub redesign. Relevant docs:
`docs/client-feedback-2026-08-17-gap-analysis.md`,
`docs/SafeIQ_Milestone_Plan_v1.2_client_feedback_addendum.docx`,
`docs/SafeIQ_Client_Response_2026-08-18.docx`.

---

## 2) Where we stand now (as of 2026-09-02)

- **Working system today:** `backend/` (M2–M4 slices) + `frontend/` real-mode screens against it,
  runnable on ordinary Docker + Postgres. Everything else is the mock prototype.
- **Live dev environment:** `safeiq-be` / `safeiq-fe` `main` auto-deploy to
  `https://safeiq-dev-api.theittraininghub.com` (ECS + Aurora PostgreSQL 15, eu-west-2) and
  `https://safeiq-dev.theittraininghub.com`. Deployed provider switches:
  - `EMAIL_BACKEND=smtp` — **ON.** Real OTP + magic-link + share emails send via Gmail SMTP relay
    (`ghufranhassansyed@gmail.com`). All three are now **HTML multipart** with real links
    (`app/services/email_templates.py`) — the share email deep-links to
    `{APP_BASE_URL}/onboarding?video=<id>`, so **DevOps must set `APP_BASE_URL=https://safeiq-dev.theittraininghub.com`**.
    Mail still **lands in spam** — SES + a verified sending domain with SPF/DKIM/DMARC is the real
    fix, deferred by the user.
  - `MEDIA_STORAGE_BACKEND=s3` — **ON.** Uploads land in `safeiq-dev-onboarding-media-581891203031`
    via the `safeiq-dev-ecs-task-role` (no static keys); playback via presigned GET (1h). CORS on
    the bucket added by DevOps.
  - `KYC_PROVIDER=mock` — still mock. `SumsubKycProvider` is deployed but the Sumsub sandbox
    dashboard config (level `id-and-liveness`, webhook to `/kyc/webhook`) is **blocked**: the
    client owns that account and hasn't applied it.
  - `ONBOARDING_SEARCH_PROVIDER=keyword` — semantic search (`llm` or `embedding`) not switched on
    yet; needs `OPENAI_API_KEY` set on the task. `embedding` also needs `ONBOARDING_SEARCH_MIN_SIMILARITY`
    tuned (start ~0.35, read the per-query INFO score logs).
  See the GitHub-flow section above and `docs/repo-sync-split-repos.md`.
- **Figma redesign is live** — `safeiq-fe` `main` (commit "Figma production redesign — Milestone 2
  (auth) + Milestone 3 (Help Hub + app shell)") is deployed; the monorepo work is on branch
  `figma-redesign-m2-m3`. Reference: `docs/SafeIQ_Client_Figma_Production_Design_2026-08-25.docx`.
- **Frontend serving moved to ECS.** Still a **static export** (`next.config.ts` → `output: "export"`,
  `npm run build` emits `out/`), but DevOps moved it off S3 + CloudFront to a **container on ECS
  behind the shared ALB** (`safeiq-fe` commits "Move frontend serving from S3/CloudFront to ECS
  behind the shared ALB", "Remove S3/CloudFront/ACM frontend infra"). The three dynamic routes
  (`/rag/[id]`, `/team/[id]`, `/invite/[token]`) still use `generateStaticParams()` for seeded ids
  and read the real id from `window.location.pathname`.
- **M3 deploy runbook** (DevOps, on `safeiq-be` after a push): `pip install -r requirements.txt`
  (adds `boto3`) → `alembic upgrade head` (control-plane chain is now `0001→0002→0003→0004`) →
  `python -m scripts.migrate_tenant_onboarding` (reconciles existing tenant schemas) →
  `python -m scripts.seed_internal_user --email .. --name .. --password ..` (first Internal login).
- **Known limitation:** a hard reload resets the in-memory mock store, so a mock entity created via
  the UI reads as "not found" after refresh under static export. Not yet fixed (options: persist to
  `localStorage`, or move to `/rag?id=` query params). Real backend-connected data is unaffected —
  including the real SafeIQ Internal session, which has its own reload-recovery in `store.tsx`.
- **CI/CD: deploy-only, no test gate.** `safeiq-be` / `safeiq-fe` each have a GitHub Actions
  workflow that builds + deploys `main` to the dev environment, plus dev-infra Terraform. Neither
  runs `ruff` / `mypy` / `pytest` on push (`safeiq-be`'s test workflow was explicitly removed) —
  so run the checks locally before pushing. `docs/devops-cicd-production-guide.md` is the original
  handoff (env-var tables, recommended test workflows, must-fix-before-real-users checklist).
- **Discovery / Milestone 1 not signed off.** All `docs/architecture/` docs are `PROPOSED`/`DRAFT`.
  Outstanding: client requirement workshops (item 1), technical spikes (item 2), IaC/CI (item 11),
  discovery sign-off (item 13).

### Known simplifications (flagged, not hidden — from `backend/README.md`)

- Tenant schema provisioning uses `metadata.create_all`, **not** per-schema Alembic migrations —
  a future *tenant-schema* change won't reach existing tenants automatically.
  `scripts/migrate_tenant_onboarding.py` is the first hand-rolled per-schema reconciler; a general
  runner is still follow-up. (Control-plane schema *does* use real Alembic — chain `0001→0004`.)
- Audit-ledger insert-only enforcement is partial (owner role can still bypass revoked UPDATE/DELETE
  — needs a separate restricted runtime DB role). Internal-user actions are **not** audited yet
  (the ledger is per-tenant and hash-chained per tenant; a control-plane audit trail is separate work).
- **Email**, **KYC**, **media storage**, **onboarding search** each have a dev stub (default) and a
  real adapter, chosen by env var:
  `EMAIL_BACKEND=console|smtp` (`SmtpEmailSender`; Gmail SMTP interim, SES for prod — **`smtp` is
  live on the dev env**),
  `KYC_PROVIDER=mock|sumsub` (`SumsubKycProvider` + `/kyc/webhook`),
  `MEDIA_STORAGE_BACKEND=none|s3` (`S3MediaStorage`, presigned upload/playback — **`s3` is live**),
  `ONBOARDING_SEARCH_PROVIDER=keyword|llm|embedding`.
- **Onboarding "AI search"** default is still stopword-filtered keyword matching; `embedding`
  (cosine + threshold, no vector DB) and `llm` exist but aren't switched on in the dev env.
- JWT signing is HS256 / shared secret (KMS-backed asymmetric is a hardening step).
- SafeIQ Internal accounts now have **login + `/internal/me` + the onboarding CMS routes**, but
  still no password reset, no 2FA, no other internal features.
- Login requires an `organisation_id`; `GET /auth/organisations?email=` resolves which org(s) an
  email belongs to first. Internal login takes email + password only (no org).

---

## 3) Future scope

Near-term backend milestones (per `docs/SafeIQ_Milestone_Plan_v1.1_revised.docx`):

- **Milestone 5 — AI Knowledge Base / RAG engine.** Introduces the server-side RAG entity, document
  ingestion + retrieval, and grounded answering. **Blocked on the still-open CRITICAL "which LLM
  provider" decision** (Bedrock/Claude proposed, not confirmed). Unblocks M4 tasks 32–34 (RAG
  assignments with access codes, per-member RAG activity, assignment management).
- **Milestone 6 — chat / question-asking flow** against RAGs; feeds the alert pipeline.
- Switch the deployed dev env onto the real adapters already built: **email SMTP is on**;
  turn on **`ONBOARDING_SEARCH_PROVIDER=embedding`** (+ `OPENAI_API_KEY`, tune the threshold) and
  **`KYC_PROVIDER=sumsub`** once the client applies the Sumsub dashboard config.
- Real provider adapters still to build: **email → AWS SES** (deliverability — currently spam),
  **KYC → Onfido/Jumio** if Sumsub is dropped. Each is a new class, no route changes.

Production hardening:

- General per-schema migration runner (`scripts/migrate_tenant_onboarding.py` is the one-off pattern).
- Separate restricted runtime DB role so the audit ledger is truly append-only; a control-plane
  audit trail covering SafeIQ Internal actions.
- KMS-backed asymmetric JWT signing (RS256).
- pgvector for onboarding search if the catalogue grows (embeddings are computed per-request today).
- HTML email bodies + `List-Unsubscribe` headers, and SES + SPF/DKIM/DMARC on a real domain.
- Mock-store persistence (or query-param routing) so the static-export prototype survives reloads.

Proposed but **not started** (design only — `docs/architecture/solution-architecture-aws-design.md`):

- Full AWS architecture: Terraform/IaC, ECS Fargate, Aurora, OpenSearch, Bedrock, Chime (real-time
  media / emergencies), Cognito (identity), SES, KMS, Secrets Manager, CloudWatch/X-Ray,
  CloudTrail/GuardDuty. No infra or IaC exists yet. Cognito migration is a separate project, not a
  drop-in swap for today's JWT auth.
- ADR-005 (hash-chained ledger replacing the brief's literal "blockchain") needs **explicit client
  sign-off**.

---

## Working rules (standing instructions — do not violate)

0. **Branch + PR, never `main`.** No commits or pushes to `main`/`master` in any repo
   (company policy, penalties). Branch → push branch → `gh pr create` → a teammate
   reviews and merges. You don't merge your own PR. Details: `AGENTS.md` top.
1. **Client feedback = UI / mock-store only.** Implement review feedback (Neil's rounds) against
   `frontend/src/lib/store.tsx`, not real backend endpoints/models/migrations, unless the user
   explicitly asks for real backend work. Phase 1 was built with a real backend and then this rule
   was set — it stands from phase 2 onward.
2. **Keep the demo login personas.** Never remove or gate the "explore instantly as…" quick-login
   list on `frontend/src/app/login/page.tsx`, even when changing real-auth UI on that page.
3. **Frontend is NOT the Next.js you know.** Next 16 / React 19 have breaking changes — read the
   relevant guide in `frontend/node_modules/next/dist/docs/` before writing frontend code.
4. **Backend: use the `.venv` (Python 3.12).** Run `ruff check app tests scripts`, `mypy app scripts`,
   and `pytest` before calling a change done — all clean on `main`. Postgres-gated integration tests
   need `docker compose up -d db`; they skip cleanly without it.
5. **Never weaken tenant isolation.** It is structural (`schema_translate_map`). Never add a
   `tenant_id` filter as an alternative, never let a route pass an arbitrary schema name.
6. Source-of-truth for real-vs-mock: root `README.md` "Real vs. mock" + `backend/README.md`
   "Known simplifications".
7. **Onboarding CMS ownership is deliberate:** the video catalogue is one shared list in
   `control.onboarding_videos`, authored only by SafeIQ Internal (`/internal/onboarding/*`); org
   users only consume it (`/onboarding/*`). Don't reintroduce per-tenant video CRUD. Analytics
   stay per-org. The Help-Hub extras (sprint, achievements, "Required" assignments, General
   Support) are intentionally mock-only.
8. **Split-repo changes:** monorepo `backend/` + `frontend/` are the prototype; ship by patching a
   real `safeiq-be` / `safeiq-fe` checkout (`git diff --relative=<dir> <base> <tip> -- <dir>/` →
   `git apply`), run `ruff`/`mypy`/`pytest` (or `tsc`/`lint`/`build`) in the checkout, then
   **branch + push branch + `gh pr create`** (see rule 0 — not `git push origin main`).
   `git subtree push` does NOT work. `docs/repo-sync-split-repos.md`.

---

## Dev commands

```powershell
# Backend (start first for real signup/login/invite/onboarding/team flows)
cd backend
.venv\Scripts\activate
python -m alembic upgrade head                        # control-plane schema (0001..0004)
python -m scripts.seed_internal_user --email you@safeiq.io --name "You" --password "…"  # for /internal
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# or: docker compose up --build   (Postgres + API together)
# checks before "done": ruff check app tests scripts && mypy app scripts && pytest

# Frontend
cd frontend
npm install
npm run dev            # http://localhost:3000
npx tsc --noEmit && npm run lint && npm run build   # pre-commit checks
```

## File map (most-touched)

| Area | Files |
|---|---|
| Mock data store | `frontend/src/lib/store.tsx`, `mockData.ts`, `types.ts` |
| Backend ↔ frontend bridge | `frontend/src/lib/apiClient.ts` (tenant), `internalApiClient.ts` (SafeIQ Internal), `apiMapping.ts` |
| Permissions | `frontend/src/lib/permissions.ts` |
| Real-mode pages | `frontend/src/app/{signup,login,settings,team,team/[id],invite/[token],onboarding,internal/onboarding}/…` |
| Backend routes | `backend/app/api/routes/{auth,invites,users,onboarding,internal,kyc_webhook,audit}.py` |
| Services (pluggable) | `backend/app/services/{email,kyc,media_storage,onboarding_search}.py` (each: ABC + stub + real adapter + `get_*` factory) |
| Tenancy | `backend/app/db/session.py`, `app/services/tenant_provisioning.py`, `app/db/control_models.py` (control-plane: orgs, internal_users, onboarding_videos, indexes) |
| Models | `backend/app/models/tenant.py` (tenant schema), `app/db/control_models.py` (control schema) |
| Migrations | `backend/alembic/versions/000{1..4}_*.py` — control-plane only |
| One-off scripts | `backend/scripts/{init_db,seed_internal_user,migrate_tenant_onboarding}.py` |
| Docs | `docs/repo-sync-split-repos.md`, `docs/devops-cicd-production-guide.md`, `docs/architecture/README.md` |
