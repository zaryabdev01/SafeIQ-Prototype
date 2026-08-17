# Client Feedback Gap Analysis — Neil, 17/08/2026

**Purpose:** Neil reviewed the full prototype and sent detailed redesign feedback across nearly every page. Before any implementation starts, this document maps each piece of feedback against what's actually in the prototype today, so we're working from a shared, accurate picture rather than assumptions. No code has been changed as a result of this document — it's the understand-first step Neil's feedback needs before we scope and sequence the work.

**How to read each section:** *Client wants* → *Currently in the prototype* → *Gap*. "Currently in the prototype" is verified against the actual code, not recalled from memory.

**Headline observation:** this isn't a set of tweaks. Several items (the Help Sprint/gamification system, the Alert Rules governance model with global/employee scope and a suggestions workflow, per-RAG Communications as a first-class tab, a general-purpose "Actions" entity, appointments surfaced on the dashboards) are **new product concepts** that don't exist in any form yet — not redesigns of existing features. That's flagged per-section below and summarised at the end against the milestone plan, because it materially affects how this gets scoped and priced.

---

## 1. Organisation Dashboard

**Client wants** (per the attached mockup): a top banner summarising "N items need your attention" with quick-jump chips (Critical / High Risk / Overdue Actions / Questions Pending); an 8-tile stat grid (Team Members, Active RAG Systems, New Alerts, Open Actions, Questions Pending, Emergencies, Incidents, RAGs Need Updating); an "Upcoming Appointments" strip; a tabbed "Requires Your Attention" unified feed (All/Critical/Alerts/Actions/Questions/RAG Updates); a "Live Questions" panel with RAG/status/employee filters; an "Alerts" panel; an "Open Actions" table (Action / Employee / RAG / Priority / Due / Status); a "Team Activity" feed (last 24 hours); a "RAG System Overview" row of cards, each showing people/conversations/alerts/actions/pending counts per RAG.

**Currently in the prototype** (`frontend/src/app/dashboard/page.tsx`): an 8-tile stat grid (Team members, Number of RAGs, RAG data out of date, New alerts, Active alerts, Completed alerts, Emergencies, Incidents), a "Live questions - all RAGs" panel (search + RAG filter + date filter, inline reply), an "Alerts" panel (mark-as-read), and a "Recent sign-ins" panel (person filter + date filter).

**Gap:**
- No "N items need attention" banner or unified "Requires Your Attention" tabbed feed — this is a new aggregation view across alerts/actions/questions/RAG-updates that doesn't exist.
- No "Open Actions" concept at all. The backend has `AlertTask` (a checklist item scoped to one alert case) but nothing resembling a standalone, filterable, org-wide Actions table with priority/due-date/status. This is genuinely new.
- No appointments/upcoming-bookings strip on the dashboard (Calendar is a separate page today).
- No "Team Activity" feed.
- No "RAG System Overview" cards row on the dashboard (equivalent per-RAG stats exist only on each RAG's own Overview tab, not surfaced here).
- Stat tile set differs: current tiles include "Completed alerts" (not in the mockup) and don't include "Active RAG Systems," "Open Actions," "Questions Pending," or "RAGs Need Updating" as named. Some of this is a relabel of what exists (RAG data out of date ≈ RAGs Need Updating); some is net-new (Open Actions, Questions Pending as a distinct tile).
- "Recent sign-ins" panel isn't in the new mockup at all — implicitly being replaced by Team Activity.

---

## 2. Employee Dashboard

**Client wants**: a personal greeting header; 4 stat tiles (My RAGs, My Actions, Upcoming, Needs Attention); a prominent embedded "How can Safe IQ help?" AI ask box directly on the dashboard (not just inside the floating widget); a "My RAGs" card row (icon, description, "Ask Safe IQ" button per RAG); a tabbed "My Actions" list (All/Due today/Upcoming/Completed); a "Coming Up" appointments panel; a "Recent Conversations" list; an "Advice for You" tips carousel.

**Currently in the prototype** (`frontend/src/app/employee/page.tsx`): a greeting header, a 5-tile stat grid (RAG allocated, Pending responses, Alerts, Incidents, Emergencies), a static banner pointing users to the floating widget for AI/chat/safety tools, and a plain list of assigned RAGs (name + access code badge only — no per-RAG stats, no "Ask Safe IQ" button, no status indicator).

**Gap:**
- No AI ask box embedded on the page — asking a RAG a question only exists inside the floating widget today, not on the dashboard itself.
- "My RAGs" list is far simpler than the mockup: no icon, no description, no per-RAG conversation/alert/action counts, no direct "Ask Safe IQ" action per card.
- No "My Actions" concept at all (same underlying gap as the org dashboard — Actions doesn't exist as an entity).
- No "Coming Up" panel — Calendar bookings exist but aren't surfaced on this dashboard.
- No "Recent Conversations" list on the dashboard (question history exists per-RAG inside the widget, not surfaced here).
- No "Advice for You" tips carousel — no such content model exists.

---

## 3. Onboarding → "Help & Learning Hub"

This is the single largest item in the feedback — effectively a full product redesign, not a facelift.

**Client wants:** an AI-first help search box at the top ("What do you need help with?") that returns a curated recommendation set with a "Start recommended" path, not just keyword matches; a user-type filter (All/Org Admin/Manager/Employee/Trainer/...) that re-prioritises the whole page; a **"Your Help Sprint"** progression system — a numbered, ordered onboarding journey (1-9) with a progress bar, soft dependency ("Next recommended" rather than hard-locking unless there's a genuine prerequisite), and lightweight achievement badges (Getting Started ✓, Platform Explorer ✓, Organisation Ready 🔒); a fixed 3×3 card grid (9 per page) with strict pagination, where every card has an identical structure (type/duration, title, description, audience tag, status, action, share icon); sharing built into every card via a modal (Email/WhatsApp/Messenger/**in-platform send-to-user** with search + optional message + notification, or send to a Team/Department/Location); category filters plus a separate "Platform Help / General Support" split (the latter covering non-feature help like account security, accessibility, contacting the organisation); a status system (Recommended/Next/New/Completed/Required) where "Required" lets an admin **assign** a specific help item to a specific person with an optional due date; and a full **Help Hub Manager** for admins to author every item (title, thumbnail, content, description, user type(s), category, sprint + sprint position, required/recommended, prerequisite content, estimated time, AI search keywords, published/unpublished state). Every video/help item a user accesses should log to their profile.

**Currently in the prototype** (`frontend/src/app/onboarding/page.tsx`, backend `app/api/routes/onboarding.py`): a real, backend-integrated video CMS (Milestone 3) with: an AI-search-labelled input that does keyword/word-overlap matching (not recommendation-with-navigation); an audience filter (organisation/employee/all — narrower than the client's proposed role list); a plain grid of video cards (3-per-row on desktop but no fixed 3×3-then-paginate behaviour — currently shows the first 9 or "view all" with no page-by-page navigation); a working share flow, but only two targets (email address, or a single registered user picked from the team list) — no WhatsApp/Messenger, no in-platform notification delivery, no team/department/location targeting; a working admin "Add video (CRM)" form (title, description, thumbnail gradient, audience, duration, media filename) and a reorder endpoint; and a real analytics endpoint (views/shares/searches, top queries) surfaced in a modal. There is no sprint/progression system, no achievements, no per-card status badges beyond audience, no assignment-to-user-with-due-date, no category taxonomy beyond audience, and no "General Support" vs "Platform Help" split.

**Gap (this is the size of a new milestone on its own):**
- **Help Sprint / progression system** — doesn't exist. Needs an ordered-step content model, per-user progress tracking, a "next recommended" resolution algorithm respecting soft/hard dependencies, and achievement state.
- **AI recommendation vs. keyword search** — current search returns matches; it doesn't reason about intent ("I need to add 20 employees and allocate training" → multiple linked recommendations + a guided path). This is a genuinely more sophisticated feature, and — like the RAG "AI-assisted search" — realistically depends on the same still-open LLM-provider decision (Milestone 1, Questions & Concerns, CRITICAL) rather than the keyword stand-in currently in place.
- **Card status system** (Recommended/Next/New/Completed/Required) — doesn't exist; current cards only show an audience badge.
- **Assignment workflow** (assign a specific item to a specific person, with due date, added to their sprint) — doesn't exist.
- **Sharing channels** — WhatsApp/Messenger/in-platform-notification don't exist; only email and single-user-email-lookup exist today.
- **Team/Department/Location** as addressable entities for sharing/assignment — none of these exist as concepts in the data model at all (only individual users and organisations do).
- **Category taxonomy** (Getting Started/Employees/Training/Reports/Account/Billing/Troubleshooting/General/Platform Help vs General Support split) — doesn't exist; only audience filtering exists.
- **Help Hub Manager** (full authoring UI: prerequisites, sprint position, estimated time, keywords, publish state) — the current admin form is a simple 5-field add-video modal, far short of this.
- **Per-user access log on their profile** — no such logging exists yet (the analytics that exist are aggregate, not per-user, per-profile history).

---

## 4. Team Members (list page)

**Client wants:** the invite log capped to display 6 rows with internal scroll, a word-search box above it, and checkbox multi-select for bulk resend/delete; the accepted-members list with the same treatment (6 then scroll, search, bulk select) plus a bulk "archive/status" action.

**Currently in the prototype** (`frontend/src/app/team/page.tsx`, real-mode branch built in Milestone 4): the invite log and team members list both render **unbounded** — no row cap, no internal scroll container, no search box, and no checkboxes/bulk actions. Individual actions exist (resend/cancel per invite, role-change per member) but nothing bulk.

**Gap:**
- Scroll-capping (6 rows) on both lists — straightforward UI change once decided.
- Word search on both lists — not implemented.
- Multi-select checkboxes + bulk resend/delete (invites) — the backend already has single-item `resend`/`cancel` endpoints; bulk would call them per-selected-id (no new backend concept needed) or could use a dedicated bulk endpoint.
- "Archive" status for team members — **doesn't exist as a concept.** The backend `User` model has no archived/inactive state at all today; every user is implicitly active. This needs a real schema change, not just a UI toggle.

---

## 5. Team Member Profile

**Client wants** a full redesign from "a normal user profile" into what he explicitly calls a **risk-and-support dashboard**: a header with last-activity, assigned-RAG count, and an open-actions/alerts summary in one line; four summary cards (Assigned RAGs, Conversations, Alerts, Open Actions); a list of assigned RAGs as cards (not text), each showing last-used, conversation/alert/action counts, and a traffic-light status (Green/Amber/Red, paired with wording, never colour-only); clicking a RAG opens a dedicated **Employee × RAG record** with its own tabs — Overview | Conversations | Alerts | Actions | Audit Log. Overview shows a chronological activity timeline (conversation → alert generated → action created → acknowledged → manager review, as one traceable chain). Conversations shows one summary row per conversation (topic, risk level, alert/action counts) rather than forcing managers to open every conversation. Alerts (he'd rename to **"Alerts & Signals"**) needs a `Context` column specifically so a detected phrase like "kill myself" is shown alongside whether the employee was describing their own risk or reporting someone else's — and he wants the underlying model to be explicitly staged as **Keyword detected → Signal generated → AI/context assessment → Alert level → Human review → Outcome**, not a flat "alert word matched" model. Actions get their own status pipeline (Information only → Recommended action → Required review → Urgent action). Audit Log is kept **separate** from Conversations — it's system/process events only (notifications sent, who opened what, when it was closed), not conversation content. Critically: **conversation content should not be visible by default** — the profile shows risk metadata and summaries, and only a permitted role (e.g. Safeguarding Lead) can deliberately open the full conversation; a line manager might see alerts/actions without seeing the raw text.

**Currently in the prototype** (`frontend/src/app/team/[id]/TeamMemberClient.tsx`, backend Milestone 4): a real profile header (name, verified/KYC badges, role dropdown), a Notes card (free-text notes, fully real), a Custom Alert Rules card (category/severity/notify-email, fully real, with delete), and an explicit notice that RAG assignments, per-RAG conversations, and keyword-flagged alerts aren't available yet because they depend on the RAG engine (Milestone 5), which hasn't been built. There is no RAG-card list, no per-RAG tabbed record, no activity timeline, no conversation-summary rows, no Context field, no staged alert pipeline, no Actions status model, no separate Audit Log, and no role-gated content visibility — none of this can exist yet because the underlying RAG/conversation/alert data doesn't exist server-side at all.

**Gap:**
- Everything in this section is **downstream of Milestone 5 (RAG engine) and Milestone 6 (chat agent)** — there's no conversation data anywhere in the backend yet, so a "Conversations" or "Alerts & Signals" tab has nothing to display against. This can't be meaningfully built before those milestones land.
- The **staged alert model** (Keyword → Signal → Context assessment → Alert level → Human review → Outcome) is a materially different architecture from what's currently designed for RAG risk rules (a flat keyword-match-triggers-an-alert model, per the earlier RAG architecture doc). This needs to be designed properly before Milestone 5/12 build against it, not retrofitted after.
- **Permission-gated conversation visibility** (manager sees alerts/actions, only Safeguarding Lead sees raw text) — the current role model (super_admin/administrator/manager/support/employee) has no "Safeguarding Lead" concept and no per-content visibility rules at all; this needs real design work, not just a UI gate.
- Notes and Custom Alert Rules (already real) are the one part of this section that's genuinely finished and match what he's asking for in spirit, if not in visual layout.

---

## 6. Keyword Alerts → "Alert Rules"

**Client wants** to rename and re-architect this entirely. Every alert rule needs: a scope (this employee only vs. global-to-the-organisation, with a mandatory second confirmation step for global because of blast radius — "You're about to add 'suicide' as a HIGH alert across 1,284 employee accounts"), a severity that **drives actual behaviour** rather than just colour (Low = logged only; Medium = manager notification + review item; High = notification + action + stays open until acknowledged; Critical = immediate escalation to a designated safeguarding lead + mandatory acknowledgement + auto-escalation if not acknowledged within an org-configured window), and full provenance (created by/date, last changed by, version/change history). The employee-level page should visually separate **inherited global alerts** from **employee-specific alerts**.

**Currently in the prototype**: `AlertKeyword` (per-RAG, in the earlier architecture doc and prototype) is a flat `{keyword, enabled}` pair with no severity-driven behaviour, no scope concept (there's no "global" vs "this RAG only" distinction — a keyword belongs to exactly one RAG), no confirmation step, and no change history. The backend's `PersonAlertRule` (built in Milestone 4) is closer in spirit — it has `category`, `severity`, `notify_email` per person — but severity is just a label today (nothing differs behaviourally between Low and Critical), there's no global/org-wide rule concept at all, and no change log.

**Gap:**
- **Severity-driven behaviour** (the Low/Medium/High/Critical → different notification/action/escalation pipeline) — doesn't exist for either `AlertKeyword` or `PersonAlertRule`. This is real logic to design and build, not a relabel.
- **Scope model** (employee-only vs. global, with confirmation) — doesn't exist anywhere. This is a genuinely new concept requiring a new data model (something like an org-level `AlertRule` table that per-employee rules can either override or inherit from).
- **Change log / provenance** (created by, last changed by, version history) — doesn't exist on any alert-related entity today; the audit ledger records that *an* alert-rule event happened, but there's no dedicated, queryable change-history view of a specific rule's lifecycle.
- **Escalation-if-not-acknowledged-within-timeframe** — no acknowledgement-tracking or timeout/escalation mechanism exists at all yet.

---

## 7. Global Alert Library (new left-nav item)

**Client wants** a brand-new top-level page: summary cards (Total Active Rules, Critical, Triggered This Month, Awaiting Review), a searchable/filterable master table of every global rule, a full "Add Global Alert" panel (word/phrase/AI-detected-concern type, category, severity, RAG scope, recipient roles, auto-created action, acknowledgement requirement) with a mandatory confirm-and-activate step, a click-through from "Triggered: N" to the actual occurrences, and — importantly — a **Suggestions workflow**: any manager/admin (or the system itself) can propose a phrase as a global rule from wherever they encounter it, which lands in a review queue (Approve as Global / Edit & Approve / Reject) rather than immediately going live, specifically so no single person can unilaterally change a rule affecting every organisation/employee.

**Currently in the prototype**: doesn't exist in any form — there's no global/cross-RAG alert-rule concept, no admin page for it, and no suggestion/review workflow anywhere in the app.

**Gap:** this is entirely new — new nav item, new page, new data model (a global rule library distinct from per-RAG/per-employee rules), a suggestion-and-approval workflow, and the trigger-history drill-down. It depends on the same severity-driven-behaviour and scope-model groundwork flagged in Section 6, so realistically these two sections should be designed and built together, not sequentially.

---

## 8. Settings — Login History

**Client wants:** capped to the last 10 rows with internal scroll, a word-search box, and a filter-by-employee dropdown above it.

**Currently in the prototype** (`frontend/src/app/settings/page.tsx`): login history renders in a plain table with **no row cap or scroll container**, and filtering is date + person dropdown (person filter already exists; word search doesn't).

**Gap:** small, well-contained — cap to 10 with scroll, add a word-search box. The person filter already exists and just needs to stay. This is one of the lightest items in the whole feedback set.

---

## 9. RAG System pages

**Client wants** the RAG detail page to stop feeling like a setup wizard once published, and become a live operational dashboard, with tabs reordered to **Overview | Communications | People & Access | Knowledge | Risk Rules | Settings & Testing | Activity**. Overview should show clickable stat tiles (Allocated Employees, Conversations, Pending Questions, Alerts, Open Actions) plus a "People allocated to this RAG" table with per-person last-activity/conversation/alert/action counts, linking into a person-scoped view of that RAG (its own Overview/Conversations/Alerts/Actions/Activity tabs). **Communications** becomes a major, first-class tab — every question asked through that RAG, with rich filters (employee/status/risk/date/team) and a feed view; **Pending Questions** gets surfaced prominently at the top of Communications, with an explicit "answer employee only" vs. "answer + add to RAG knowledge" choice for the responder. Knowledge/People & Access/Risk Rules/Settings & Testing all stay editable post-publish (no unpublish-to-edit friction), with changes to Knowledge and Risk Rules specifically recording changed-by/what/when/version. **Activity** stays deliberately separate from Communications — it's administrative/system events (people added, documents uploaded, rules changed, republish events), not conversation content.

**Currently in the prototype** (`frontend/src/app/rag/[id]/RagDetailClient.tsx`, tabs confirmed as **Overview | Knowledge | People & access | Risk rules | Test | Activity**): the Overview tab shows RAG details, a completion checklist, and a Publish action — it's genuinely still framed as a setup flow rather than an operational dashboard, exactly as Neil describes. There's no per-RAG Communications tab; question history exists in `RagQuestion` records and is visible via the org-wide dashboard's "Live questions" panel and the RAG's own Activity tab, but not as a dedicated, richly-filterable Communications view scoped to that one RAG. There's a Test tab (simulated question/answer/confidence/conflict check before publishing) separate from a Settings tab — the client's proposed "Settings & Testing" combines these into one. There's no "answer + add to RAG knowledge" choice (answering today is one action, not two). There's no per-person-per-RAG drill-down view. Knowledge/People & Access/Risk Rules are already editable at any time (not gated behind unpublish), which matches what Neil wants — that part doesn't need to change.

**Gap:**
- **Communications as a first-class tab** with the filter set described — doesn't exist; needs building against the existing `RagQuestion` data (the data exists, the dedicated view doesn't).
- **Overview → operational dashboard** reframing — mostly a restructure of the existing Overview tab's content plus adding the "People allocated" table with per-person counts (the counts themselves are derivable from existing data).
- **Person-scoped RAG record** (Overview/Conversations/Alerts/Actions/Activity for one employee within one RAG) — new view, though it can likely reuse/compose from Communications + the person's existing note/alert-rule data once Section 5's blockers (real conversation/alert data) are resolved.
- **"Answer + add to RAG knowledge"** — new capability; currently answering a pending question doesn't feed back into the RAG's knowledge base at all.
- **Change history on Knowledge/Risk Rules changes** (changed-by/what/when/version) — partially covered by the existing audit ledger (every mutation already writes an audit entry), but there's no dedicated, human-readable "version history" view surfacing it per-document/per-rule the way Neil describes.
- **Tab rename/reorder** (Test → folded into "Settings & Testing") — small, mechanical once the content split is agreed.

---

## 10. Calendar

**Client wants** a 70/30 (or 72/28) split layout: a large calendar on the left, a persistent "Upcoming Appointments" panel on the right showing the next 6, regardless of which calendar view is active. Three explicit view modes — **Day** (hour-by-hour timeline), **Month** (current behaviour), **Year** (12-month overview, click a month → month view, click a date → day view) — plus a **Today** button. Clicking any entry opens a **side panel** (not a page navigation) with full details and Edit/Reschedule/Cancel/Join-meeting actions. Person names in entries should be clickable through to their profile.

**Currently in the prototype** (`frontend/src/app/calendar/page.tsx`): **Month view only** — no Day or Year toggle, no Today button beyond implicit current-month display. Layout is roughly 2/3 calendar, 1/3 sidebar (close to the requested ratio already). The "Upcoming" panel exists and lists bookings + RAG review-date entries chronologically, capped at 4 visible before scroll (a deliberate earlier choice, not 6) — this now needs reconciling with Neil's "next 6" spec. Clicking a day selects it and shows that day's bookings in a card in the sidebar (not a side panel from clicking the entry itself); there's no dedicated per-entry side panel with Edit/Reschedule/Cancel actions — the only entry-level action today is creating a new booking via a modal. Person names aren't clickable.

**Gap:**
- **Day and Year views** — don't exist; only Month does. This is the largest piece of net-new calendar work.
- **Per-entry side panel** with Edit/Reschedule/Cancel/Join-meeting — doesn't exist; entries aren't individually actionable beyond being part of the day's list, and there's no edit/reschedule/cancel capability on an existing booking at all today (only create).
- **Upcoming panel count** — currently 4-before-scroll; needs to become 6 to match this feedback (a small, direct conflict with the earlier "cap at 4" instruction from the previous round of feedback, worth flagging back to Neil rather than silently overriding).
- **Clickable person names** → profile — small addition once the target profile page (Section 5) is more built out.
- **"Join meeting" for virtual appointments** — no meeting-link field exists on bookings today.

---

## Cross-cutting new concepts (appear in multiple sections above)

These aren't page-specific — they're foundational and worth building once, consistently, rather than per-page:

1. **A general-purpose "Actions" entity** — referenced on both dashboards, the team profile, and RAG Overview. Currently the closest thing is `AlertTask` (scoped to one alert case only). Needs to become its own first-class, assignable, filterable, status-tracked entity if it's going to appear as a standalone dashboard tile and table.
2. **Severity-driven alert behaviour + scope (employee/global) + change history** — the core of Sections 5, 6, and 7. This is genuinely the biggest architectural piece in the whole feedback set and should be designed once, not three times.
3. **Appointments surfaced outside the Calendar page** — both dashboards now want an upcoming-appointments view; Calendar's own data model can likely feed this, but it means Calendar data needs to be queryable from other pages, not calendar-page-local.
4. **Role/permission model needs extending** — "Safeguarding Lead" as a distinct role, and content-level (not just page-level) visibility rules, are new requirements the current `TeamRole` enum doesn't cover.

## How this maps onto the milestone plan

| Feedback area | Nearest milestone plan item | Note |
|---|---|---|
| Org & Employee Dashboards | Milestone 7 (Organisation Dashboard) | Employee-side dashboard isn't separately scoped in the milestone plan at all — worth raising |
| Help & Learning Hub | Milestone 3 (Onboarding CMS) | Feedback adds substantial new scope (sprints, achievements, assignment, multi-channel share) beyond the original 7 tasks |
| Team list bulk actions, archive | Milestone 4 (Team Management) | "Archive" status is new scope; original task list didn't include it |
| Team member profile redesign | Milestone 4 (Team Management) tasks 32-34 | These were the tasks already flagged as hard-blocked on Milestone 5 in `backend/README.md` — this feedback confirms and substantially expands what those tasks need to become |
| Alert Rules / Global Alert Library | Milestone 12 (Audit, Compliance & Security) | The milestone plan's task 78 (audit trail) is adjacent but doesn't cover this severity/scope/escalation model at all — this is new scope |
| RAG Communications / operational dashboard | Milestone 5 (AI Knowledge Base) | Builds directly on the RAG engine once it exists |
| Calendar Day/Year views, side panel | Milestone 10 (Calendar & Scheduling) | Consistent with the milestone's own scope, just more detailed than originally specified |

**Net effect:** this feedback doesn't just ask us to finish the milestones as planned — it meaningfully expands several of them (3, 4, 7, 10, and adds new scope that doesn't map cleanly to any existing milestone, principally the Alert Rules/Global Alert Library governance model). That's worth a direct conversation with Neil about sequencing and, if this is still inside a fixed-price scope, about re-costing — not something to silently absorb.
