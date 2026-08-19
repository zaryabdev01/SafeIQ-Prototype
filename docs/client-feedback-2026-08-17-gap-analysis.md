# Client Feedback — Neil, 17/08/2026 — Implementation Status

**This document started life as a pre-implementation gap analysis (see git history for the original). It's now been revised to reflect what's actually been built.** Every item below has shipped in the frontend prototype. Read each section's **Status** line first — it tells you whether something is real (backend-connected) or UI/mock-store only, which matters more now than the original "gap" framing did.

**How the work was actually delivered — important correction to the original plan:** the original version of this document analysed everything as if it needed real backend work, and several sections below were flagged as blocked on Milestone 5 (RAG engine) or Milestone 6 (chat), because a "Conversations" or "Alerts & Signals" tab seemingly needed real conversation data to exist server-side first. That turned out to be the wrong framing. The user clarified that **client feedback on this prototype is a UI/UX exercise, not a request to build real backend features** — the prototype's whole purpose is to validate UX ahead of the Figma redesign, the same way RAGs/alerts/chat/dashboard have run on the mock store since day one. Under that constraint, nothing was actually blocked: mock data represents conversations, alerts, and actions just as well as a real backend would for validating the redesign. So Phase 2 (9 parts, detailed below) built every remaining item against the mock store — no backend routes, models, or migrations were touched for any of it.

**One exception:** Phase 1, done *before* that correction, built Settings' real login history against a genuine new backend table/endpoint. That work stays (it's live and tested) but isn't the model that was repeated — see Section 8.

**Real vs. mock, in one place:**
- **Real (backend-connected):** signup/login/OTP/KYC, team & role management, team member notes/custom-alert-rules (Milestone 4), account settings, the audit trail, the onboarding video CMS (Milestone 3), and — from Phase 1 of this feedback round — Settings' login-history search/scroll.
- **Mock/UI-only (this feedback round, Phase 2):** literally everything else described below — both dashboards, the Team Member Profile redesign, Alert Rules governance, the Global Alert Library, the RAG page restructure, the Help & Learning Hub, Calendar's new views, and Team's archive status. All of it is real, working UI running on `frontend/src/lib/store.tsx`'s in-memory mock data — nothing persists to a database, and none of it is visible from a real (non-demo-persona) signed-in session.

---

## 1. Organisation Dashboard — ✅ Delivered (mock)

**Client wants** (per the attached mockup): a top banner summarising "N items need your attention" with quick-jump chips (Critical / High Risk / Overdue Actions / Questions Pending); an 8-tile stat grid (Team Members, Active RAG Systems, New Alerts, Open Actions, Questions Pending, Emergencies, Incidents, RAGs Need Updating); an "Upcoming Appointments" strip; a tabbed "Requires Your Attention" unified feed (All/Critical/Alerts/Actions/Questions/RAG Updates); a "Live Questions" panel with RAG/status/employee filters; an "Alerts" panel; an "Open Actions" table (Action / Employee / RAG / Priority / Due / Status); a "Team Activity" feed; a "RAG System Overview" row of cards.

**Built** (`frontend/src/app/dashboard/page.tsx`): all of the above. The attention banner and chips work; the stat grid was relabelled and expanded to the full 8 tiles; a new "Requires your attention" card has the full six-tab filter set; an Open Actions table renders the new `Action` entity with a quick "Mark complete"; Team Activity is a chronological feed derived from existing question/alert-case/action timestamps (not a new persisted audit log); RAG System Overview is a horizontally-scrolling card row linking into each RAG. The existing Live Questions and Alerts panels were kept as-is (they already matched). "Recent sign-ins" was removed, replaced by Team Activity, as the mockup implied.

**Still not real:** the `Action` entity (`frontend/src/lib/types.ts`) is mock-only — nothing writes to a database. Team Activity is derived at render time from mock data, not a persisted event log.

---

## 2. Employee Dashboard — ✅ Delivered (mock)

**Client wants**: a personal greeting header; 4 stat tiles (My RAGs, My Actions, Upcoming, Needs Attention); an embedded "How can Safe IQ help?" AI ask box; a "My RAGs" card row; a tabbed "My Actions" list; a "Coming Up" panel; a "Recent Conversations" list; an "Advice for You" tips carousel.

**Built** (`frontend/src/app/employee/page.tsx`): all of it. The ask box reuses the same `askRag` store action the floating widget already calls, so there's exactly one place question-asking logic lives. My RAGs is now a card row with description and an "Ask Safe IQ" button per card. My Actions has the four tabs. Coming Up reads the same `Booking` data as Calendar. Recent Conversations lists this employee's question history.

**Still not real:** "Advice for You" is a small static tip list, not AI-generated recommendations — there was never a content model to draw from, and building one wasn't asked for beyond the carousel itself.

---

## 3. Onboarding → "Help & Learning Hub" — ✅ Delivered (mock, layered onto the real CMS)

**Client wants:** an AI-first help search with a "Start recommended" path; a user-type filter that re-prioritises the page; a "Your Help Sprint" progression system with a progress bar and achievement badges; a fixed 3×3 paginated grid; a card status system (Recommended/Next/New/Completed/Required); sharing via Email/WhatsApp/Messenger/in-platform/Team/Department/Location; a Platform Help vs. General Support split with a category taxonomy; an assignment workflow (assign a required item to a person with a due date); a full Help Hub Manager authoring form; a per-user access log.

**Built** (`frontend/src/app/onboarding/page.tsx`, mock-mode branch only): every item above. `OnboardingVideo` gained optional fields (`sprintPosition`, `category`, `isGeneralSupport`, `userTypes`, `prerequisiteId`, `estimatedMinutes`, `aiKeywords`, `published`, `requiredForUserId`/`requiredDueDate`) — all additive, so the **real, backend-integrated Milestone 3 CMS (the `isRealSession` branch) is completely untouched** and was re-verified working via a live signup after the rewrite. Your Help Sprint shows a progress bar, a "Next recommended" pointer, and 3 achievement badges. The grid paginates 9-at-a-time. Status badges, the Platform Help/General Support toggle, category filters, multi-channel sharing, the assign-as-required workflow, the fuller Help Hub Manager form, and an access-log panel are all live.

**Still not real / intentionally simplified:**
- AI search is still keyword/keyword-plus-aiKeywords matching, not real intent parsing — same honest limitation as before, still gated on the still-open LLM-provider decision if it's ever built for real.
- Sharing channels (WhatsApp/Messenger/in-platform/Team/Department/Location) are simulated — clicking Share shows a confirmation toast naming the channel and target; nothing is actually sent anywhere.
- Team/Department/Location are static string lists (`frontend/src/lib/mockData.ts`), not real org-structure entities — nothing else in the app needs them to be more than that yet.
- The per-user access log is a mock in-memory array (`helpAccessLog` in the store), not a persisted, queryable log.

---

## 4. Team Members (list page) — ✅ Delivered (both real- and mock-mode)

**Client wants:** invite log and team members list capped at 6 rows with scroll and search, bulk resend/cancel, plus a bulk archive/status action on team members.

**Built:** the real-mode (backend-connected) branch got scroll-cap/search/bulk-resend-cancel in **Phase 1** (calls the existing single-item `resend`/`cancel` endpoints per selected id — no new backend needed for that part). Archive status was then added in Phase 2 as a **mock-only** feature: `AppUser.status` (`"active" | "archived"`), a "Show archived" toggle, and bulk archive/unarchive — this only applies to the demo-persona (mock) team list, since the real backend `User` model still has no archived/inactive column.

**Still not real:** archive status doesn't exist on the real backend `User` model — a real implementation would need a schema change (`backend/README.md`'s "Known simplifications" already flags that new tenant-schema columns don't auto-propagate to already-provisioned schemas).

---

## 5. Team Member Profile — ✅ Delivered (mock)

**Client wants** a "risk-and-support dashboard": a header summary line; four summary cards (Assigned RAGs, Conversations, Alerts, Open Actions); RAG cards with a traffic-light status (never colour-only); clicking a RAG opens an Employee × RAG record with Overview/Conversations/Alerts/Actions/Audit Log tabs; a chronological Overview timeline; one-row-per-conversation summaries; Alerts renamed "Alerts & Signals" with a `Context` field and a staged model (Keyword detected → Signal generated → Context assessment → Alert level set → Human review → Outcome); Actions with a 4-stage pipeline; a separate, content-free Audit Log; and conversation content hidden by default except to a Safeguarding Lead.

**Built** (`frontend/src/app/team/[id]/TeamMemberClient.tsx`, mock-mode branch): all of it — this was the item the original analysis called "downstream of Milestone 5/6, can't be built before those land." That reasoning assumed real conversation data was required; it wasn't, once the constraint became UI-only. RAG cards show a derived traffic-light badge (paired with wording: "Needs attention"/"Monitor"/"On track"). Clicking one opens the full 5-tab record. The staged alert pipeline renders via a new shared `AlertStageStepper` component, inferring stage from existing status/message data. `AlertCase` gained an optional `context` field. A new `isSafeguardingLead` flag on `AppUser` plus a `canViewConversationContent` permission helper (`frontend/src/lib/permissions.ts`) gates raw question text — a manager sees summaries and risk badges, only the Safeguarding Lead (seeded: Priya Patel) or the org's own Super Admin sees the actual text. Verified live as both roles.

**Still not real:** none of it is backend-connected — no RAG engine, no real conversation storage exists. This is a UI validation of the target design, not a working feature. The real backend's Milestone 4 notes/custom-alert-rules cards are unaffected and still fully real.

---

## 6. Keyword Alerts → "Alert Rules" — ✅ Delivered (mock)

**Client wants:** scope (employee vs. global, with a mandatory second confirmation for global); severity that visibly maps to described behaviour; full provenance and change history; global-vs-employee visual separation.

**Built** (`PersonAlertRule` in the Team Member Profile, `AlertKeyword` in the RAG's Risk Rules tab — both share `frontend/src/components/AlertRuleGovernance.tsx`): both entity types gained optional `scope`, `createdBy`, `createdAt`, `changeLog` fields. A severity legend explains what each level is meant to do. Setting scope to "global" requires a second confirm-and-activate step naming how many accounts/RAGs it affects. An expandable History section shows the change log.

**Still not real:** this is display/copy and data-shape only, exactly as scoped — no real notification, escalation, or acknowledgement-timeout logic runs off these fields. That was always going to be genuinely new backend logic even under a UI-only mandate, and wasn't attempted; the severity legend is honest about this (it describes intended behaviour, nothing enforces it).

---

## 7. Global Alert Library (new left-nav item) — ✅ Delivered (mock)

**Client wants:** summary cards, a searchable master table, an "Add Global Alert" flow with confirm-and-activate, a trigger-count drill-down, and a Suggestions review queue (Approve as Global / Edit & Approve / Reject).

**Built:** a new `/alert-library` page and sidebar entry, a new `GlobalAlertRule` mock type/store, summary cards (Total Active Rules, Critical, Triggered This Month, Awaiting Review), a searchable/filterable table, the same confirm-and-activate modal reused from Section 6, and a full suggest → approve/edit-and-approve/reject workflow (a "Suggest a rule" action makes the review queue actually reachable, not just display).

**Still not real:** the "Triggered: N" drill-down honestly states it can't show real per-occurrence data yet, since nothing generates real triggers without a live RAG engine. Trigger counts are static seed numbers.

---

## 8. Settings — Login History — ✅ Delivered for real (Phase 1, backend-connected)

**Client wants:** capped to 10 rows with scroll, a word-search box, filter-by-employee.

**Built for real**, unlike everything else in this document: a new `LoginEvent` tenant table, written in the same transaction as the existing `user.logged_in` audit entry in `POST /auth/login`; a new `GET /team/login-history` endpoint (search by name/email, admin-gated); Settings' login-history section switches to this endpoint for real (non-demo) sessions, with search and a scroll cap. Covered by `backend/tests/test_login_history.py`, verified against the real Neon database.

---

## 9. RAG System pages — ✅ Delivered (mock)

**Client wants:** tabs reordered to Overview | Communications | People & Access | Knowledge | Risk Rules | Settings & Testing | Activity; Overview as an operational dashboard once published; Communications as a first-class, richly-filtered tab with an "answer employee only" vs. "answer + add to RAG knowledge" choice; Activity kept to system/admin events only; change history on Knowledge.

**Built** (`frontend/src/app/rag/[id]/RagDetailClient.tsx`): tabs reordered exactly as asked. Overview keeps the draft setup checklist while unpublished, and becomes a real operational dashboard (clickable stat tiles + a "People allocated" table linking into each person's Team Member Profile, i.e. Section 5's record) once published. Communications has the risk-level filter added alongside existing member/date filters, with Pending Questions surfaced first and both answer paths — "add to knowledge" routes through the same review queue any other upload goes through, rather than silently publishing an answer. Activity was repurposed to system/admin events only (documents added, rules changed, people given access), distinct from Communications. Knowledge documents got a "History" toggle surfacing their existing version list.

**Still not real:** all of the above reads/writes mock data. There's no true separate "person-scoped RAG record" view — it composes from the existing Employee × RAG record built in Section 5, reached via a link, which the original analysis flagged as the likely reuse path and is what happened.

---

## 10. Calendar — ✅ Delivered (mock)

**Client wants:** Day/Month/Year views with a Today button; a persistent Upcoming panel showing the next 6; a per-entry side panel (not just day-selection) with Edit/Reschedule/Cancel/Join-meeting; clickable person names.

**Built** (`frontend/src/app/calendar/page.tsx`): a Day/Month/Year toggle with adaptive prev/next navigation and a Today button; Day view renders an hourly timeline; Year view renders 12 mini-months (click a date → Day, click a month name → Month). Clicking any entry — in Month's day list, Day view, or Upcoming — opens a right-anchored side panel with Edit/Reschedule (inline form), Cancel (soft-cancel via a new `cancelled` flag), and Join meeting (enabled when a new optional `meetingLink` is set). Person names in the panel link to their Team Member Profile. The Upcoming panel's visible height was widened from ~4 to ~6 rows.

**Note carried over from the original analysis, now resolved in practice:** the "cap at 4 → 6" ask directly reversed an earlier round's explicit instruction. It was implemented as asked; worth confirming with Neil this supersedes the earlier one rather than being an oversight, but this is a product-decision question, not an implementation gap anymore.

---

## Cross-cutting concepts — ✅ All delivered (mock)

1. **General-purpose `Action` entity** (`frontend/src/lib/types.ts`) — built once, shared by both dashboards, the Team Member Profile, and RAG Overview, exactly as recommended. Mock-only; distinct from the pre-existing `AlertTask` (still scoped to one alert case).
2. **Severity-driven behaviour + scope + change history** — built once as `frontend/src/components/AlertRuleGovernance.tsx`, shared by Sections 5-7 rather than three separate implementations, as recommended. Display/copy only, as noted in Section 6.
3. **Appointments surfaced outside Calendar** — both dashboards' Upcoming/Coming-Up panels read the same `Booking` data Calendar uses; no calendar-page-local restriction remains.
4. **Role/permission model extended** — `AppUser.isSafeguardingLead` + `canViewConversationContent()` in `frontend/src/lib/permissions.ts`, as a lightweight flag rather than a new `TeamRole` enum value (a permission, not a job title).

---

## How this actually maps onto the milestone plan — revised

The original table below mapped each feedback area onto a *backend* milestone, on the assumption that backend work was needed. Since everything in this document (bar Section 8) shipped as frontend/mock-only, that mapping no longer describes what was built — it now only matters if/when any of this gets a real backend later.

| Feedback area | Nearest milestone plan item | What actually shipped |
|---|---|---|
| Org & Employee Dashboards | Milestone 7 (Organisation Dashboard) | Full UI, mock `Action` entity — no backend |
| Help & Learning Hub | Milestone 3 (Onboarding CMS) | Full UI layered on the mock branch only; real CMS (Milestone 3) untouched |
| Team list bulk actions | Milestone 4 (Team Management) | Real (Phase 1) for search/scroll/bulk-resend-cancel; archive status is mock-only |
| Team member profile redesign | Milestone 4 tasks 32-34 | Full UI, including the parts previously flagged as hard-blocked on Milestone 5 — turned out not to be blocked under a UI-only mandate |
| Alert Rules / Global Alert Library | Milestone 12 (Audit, Compliance & Security) | Full UI, display-only severity/scope model, no real notification/escalation logic |
| RAG Communications / operational dashboard | Milestone 5 (AI Knowledge Base) | Full UI against existing `RagQuestion` mock/real-hybrid data - no RAG engine involved |
| Calendar Day/Year views, side panel | Milestone 10 (Calendar & Scheduling) | Full UI, mock `Booking` data only |
| Settings login history | Milestone 2 (Auth & Multi-Tenant Foundation) | **Real** - new `LoginEvent` table + endpoint |

**Net effect:** if this prototype's redesigned pages are approved and the client wants them as real, working product features (not just a validated UX reference for the Figma redesign), each row above still represents real backend work not yet started — the milestone-scope-expansion observations from the original analysis (new scope beyond Milestones 3/4/7/10, no clean milestone mapping for Alert Rules/Global Alert Library) still hold *for that future conversation*. What's changed is that none of it is blocking the current UX-validation goal any more, since the whole point of this round was to make the prototype demonstrate the redesign, not to build it for real.
