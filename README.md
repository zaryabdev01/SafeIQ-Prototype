# SafeIQ

AI-powered employee safety & compliance platform. This repository is split into two independent projects:

```
frontend/   Next.js UI prototype (see frontend/README.md) — used to validate UX and as a reference
            for the Figma redesign in progress. Its signup, login, team, team-member-profile,
            settings, magic-link invite, and onboarding-video screens now call the real backend
            below (see "Real vs. mock" underneath); everything else (RAGs, alerts, chat, dashboard,
            calendar) still runs on the original in-memory mock store, since the backend doesn't
            implement those modules yet.

backend/    FastAPI service — the real, persistent, multi-tenant backend (see backend/README.md).
            Implements Milestone 2 (Authentication & Multi-Tenant Foundation), Milestone 3
            (Onboarding CMS), and part of Milestone 4 (Team Management) per
            docs/SafeIQ_Milestone_Plan_v1.1_revised.docx.

docs/       Architecture, discovery-pack, and milestone-plan documents shared by both projects.
```

## Real vs. mock in the frontend

The frontend now talks to two different data sources depending on how you signed in:

- **Demo personas** ("explore instantly as..." on the login page) — unchanged, fully mock, no backend needed. This is what the Figma designer and anyone exploring RAGs/alerts/chat/dashboard/calendar should keep using, since those modules have no backend yet.
- **Real sign-up or login** (the email/password form, or a magic-link invite) — creates/authenticates a real account against `backend/`, via `frontend/src/lib/apiClient.ts`. This exercises Milestones 2-4 end to end: registration, OTP verification, KYC, login, team & role management, team member profiles (notes, custom alert rules), account settings, the audit trail, and the onboarding video CMS — add/search/view/share a video and see live analytics. Everything *outside* those specific pages (RAGs, alerts, dashboard tiles, RAG assignments, etc.) still renders from the mock store even for a real account, since the backend doesn't have that data yet — the team member profile page says so explicitly where it applies.

Point the frontend at a real backend via `frontend/.env.local` (see `frontend/.env.local.example`) — defaults to `http://localhost:8000`.

## Where to start

- Frontend prototype: `cd frontend && npm install && npm run dev`
- Backend service: see `backend/README.md` for setup (Docker Compose spins up Postgres + the API together, or point `DATABASE_URL` at any reachable Postgres — a free-tier Neon/Supabase instance works fine for local dev) — start this first if you want to exercise the real signup/login/invite/onboarding/team flows, not just the demo personas
- Architecture & discovery docs: `docs/architecture/README.md`
- Milestone plan: `docs/SafeIQ_Milestone_Plan_v1.1_revised.docx`

### Local quick reference (no Docker)

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload   # --reload matters - without it, editing
                                                                # routes needs a manual restart to take effect
```

```powershell
cd frontend
npm run dev
```
