# Milestone 5 — AI Knowledge Base (RAG Engine): specification & current progress

**Written:** 2026-09-09. **Purpose:** hand a new chat/engineer everything needed to pick up M5 with
zero prior context — what M4 actually shipped, what M5 must build, what's already decided
architecturally, what's still blocked on the client, and how to phase the work so it isn't blocked
end-to-end by the one open decision (vector database) that actually matters least to get started.

**Read this whole file before writing any code.** It supersedes nothing in `docs/architecture/` —
it's the bridge between those design docs (real, already written, mostly `PROPOSED` not `ACCEPTED`)
and the milestone's actual task list (35-44) and delivery phases.

---

## 1. Why this milestone matters more than its number suggests

The client's own framing (verbatim, 2026-09-09): **"without milestone 5, this milestone does not
create any meaning, because we are not operating on actual design, we are creating a lean schema."**
Milestone 4 built real team/RAG/alert/action *management* — who's on the team, who owns what RAG,
what stage an alert is at — but a `Rag` today is an empty shell: a name, a description, a status
enum. There is no document in it, nothing gets embedded, nothing gets retrieved, no employee has
ever asked it a question. M4's value is entirely latent until M5 makes a RAG something you can
actually query. Treat M5 as the milestone that makes the whole platform real, not an incremental
feature add.

## 2. Current state (2026-09-09) — what M4 actually shipped

Both `safeiq-be` and `safeiq-fe` (`GTG-Enterprises` org) are on `main` with all of M4 merged,
deployed, and manually verified end-to-end by the client on `safeiq-dev.theittraininghub.com`,
including two post-merge production bugs found during that testing and fixed (see §2.3). Read
`.claude/specs/m4-team-management.md` for the full M4 spec — the parts of it that matter to M5 are
excerpted below so this file is self-contained.

### 2.1 Backend — real, in `safeiq-be`

- `User.status` (active/archived), `User.is_safeguarding_lead`; safeguarding-lead toggle, archive
  status, team/invite search + pagination, bulk resend/cancel/archive endpoints.
- **`Rag`** (`app/models/tenant.py`) — identity/lifecycle stub only:
  `id, name, description, status(draft|published|archived), created_by, created_at, updated_at`.
  **No documents, no chunks, no embeddings, no vector index reference exist yet.** This is the
  table M5 extends — see §4.1's hand-off contract, copied verbatim below because it is load-bearing:

  > M5 may add columns and related tables (`rag_documents`, retrieval config, vector-namespace
  > ref, …) to this table/schema. M5 must **not** rename `rags`, drop `id`/`name`/`status`, or
  > change `RagStatus` values without a coordinated migration — `RagAssignment.rag_id`,
  > `Alert.rag_id`, `Action.rag_id`, and `RagActivityEvent.rag_id` all FK it.

- **`RagAssignment`** — one active assignment per `(rag, user)` (DB partial-unique index), a
  human-readable `access_code` (issued/rotated/revoked). **Not yet an authentication factor** —
  it exists so a person can be "handed" a RAG, but nothing today uses the code to actually gate
  chat access to that RAG's content. M6 (chat agent) is documented as the milestone that turns this
  into a real auth factor; M5 should not need to touch `RagAssignment` at all except to read it
  (an assignment is what "this RAG has a document uploaded to it, who can query it" hangs off).
- **`Alert`** — a real 6-stage forward-only lifecycle
  (`keyword_detected → signal_generated → context_assessment → alert_level_set → human_review →
  outcome`), plus `AlertStageTransition` (audit trail of stage changes) and `AlertOutcome`. Created
  **manually today** (no RAG engine exists yet to create one automatically). This is the table M5's
  keyword-detection path (task 42, §3 of `rag-architecture.md`) must write into — do not invent a
  parallel alert table for RAG-originated alerts.
- **`Action`** — shared 4-tier pipeline entity (`information_only → recommended_action →
  required_review → urgent_action`), referenced by `rag_id`/`alert_id`/`subject_user_id`, all
  nullable. Also real, also manual-only today.
- `GET /team/{id}/profile` (risk dashboard) and `GET /team/{id}/rags/{rag_id}` (Employee×RAG
  record: overview/alerts/actions/audit-log tabs, plus a **documented stub** `conversations` tab —
  explicitly waiting on M5/M6 for real data).
- `backend/scripts/backfill_m4.py` — the idempotent maintenance script pattern (ALTER + create_all
  against every tenant schema) that M5 will need its own version of, for the same reason: schemas
  provisioned before M5's model changes land won't have the new tables/columns until backfilled.
  Follow this script's shape (dry-run + apply CLI flags) rather than inventing a new pattern.

### 2.2 Frontend — mixed real/mock, in `safeiq-fe`

- **Real (M4 Phase 5a/5b/5c):** Team list (safeguarding lead, archive, bulk ops, search) and Team
  Member profile page are wired to the real backend for real sessions. A minimal **real** RAG list +
  "Create RAG" modal exists (`src/app/rag/_components/real-rag-list.tsx`) — name + description only,
  since that's genuinely all `Rag` supports today. Real RAG assignment create/revoke/rotate exists
  on the Team Member page (`src/app/team/member/_components/member-assigned-rags.tsx` and
  `useTeamMember.ts`'s `revokeRealAssignment`/`rotateRealAssignmentCode`).
- **Mock only, and this is the important part for M5:** `/rag/page.tsx`'s full 7-step RAG-creation
  wizard (`RAG details → Knowledge → People & access → Alert criteria → Escalation → Settings →
  Review & create`) runs entirely against the mock store (`useApp()`) for demo-persona sessions.
  **This wizard's UX is the product's own validated design for what a RAG's authoring flow should
  look like** — the client has been looking at and approving this exact flow since before M4. M5's
  frontend work is substantially "make this wizard's steps real, one at a time," not "design a new
  flow." In particular:
  - **Knowledge step** — currently a mock file-drop UI (`ContentType` enum: Policy/Procedure/
    Guidance/Template/Regulation/FAQ/Website/Other) that adds a fake document to the mock RAG. This
    is task 35/36's real target UI.
  - **Alert criteria step** — mock `alertKeywords` list on the RAG. This is the UI half of task 42's
    keyword-detection path; the real backend already has `Alert`/`AlertStageTransition` to write
    into (§2.1) — this step just needs a real `alert_keywords` column/table on `Rag` and CRUD wired
    to it.
  - **Escalation step** — a free-text "what happens when this RAG can't answer" note. Maps directly
    to task 42's escalation behaviour description; likely becomes a real per-RAG config field.
  - **Settings step** — RAG-level config not yet itemised against real columns; audit against
    `rag-architecture.md` once that step's mock fields are read in full.
  - Employee-side chat UI against a RAG (asking it a question, seeing an answer with citations, a
    refusal message) — **does not exist yet even as a mock**, as far as this spec's author could
    confirm; verify this claim by grep'ing `frontend`/`safeiq-fe` for an employee chat surface before
    assuming it needs to be built from scratch. If it doesn't exist, this is probably the single
    largest net-new frontend surface in M5, not an existing-mock rewire.

### 2.3 Two real production bugs found during M4 manual testing (both fixed, both worth knowing about)

1. **Login 500 on a pre-existing tenant schema** — `users.status`/`is_safeguarding_lead` columns
   were added by the ORM model but never backfilled onto schemas provisioned before that model
   change landed. Fixed by DevOps running `backend/scripts/backfill_m4.py` via `aws ecs
   execute-command` against the live task (the DB is VPC-private; this is the only way to reach it
   from outside AWS). **M5 will hit the exact same class of bug** the moment its own new
   tables/columns land — write and ship its own backfill script *in the same PR* as the model
   change, not as an afterthought.
2. **A real, non-demo team member's profile 404'd for every account except the ~8 seeded demo
   personas** — root cause was specific to `output: "export"` static Next.js and is fully written up
   in git history (`safeiq-fe` commits `6c81fe6`, `7f05bc6` on `main`) if useful precedent, but it is
   **not** expected to recur for M5's own new pages as long as any new dynamic-id page is built with
   a query-string parameter (`?id=...`) rather than a path segment (`/whatever/[id]`) from the start
   — the lesson has already been paid for once, don't re-learn it.

## 3. Architectural context — read before writing code

All of `docs/architecture/` is real, pre-written design work, not this spec re-deriving anything.
Read in this order:

1. `docs/architecture/rag-architecture.md` — the actual pipeline design (upload → ingest → chunk/
   embed → hybrid retrieve → re-rank → grounded answer or refuse/escalate). This is the shape of
   what tasks 35-42 build. **Status: DRAFT PROPOSAL**, explicitly pending validation against
   Milestone 1 item 2(a) (a grounding spike on real client documents) — which, per §5 below, has not
   happened, because the client hasn't provided real documents yet.
2. `docs/architecture/rag-evaluation-strategy.md` — the design for tasks 43/44 (grounding/refusal
   evaluation harness, red-teaming). Four dimensions measured: groundedness, citation accuracy,
   refusal correctness, keyword-alert reliability. Has concrete proposed release-gate numbers
   (§6 of that doc) — treat as a starting point, not a client-confirmed bar.
3. `docs/architecture/adr/0001-llm-provider.md` — **PROPOSED, not accepted.** Recommends Claude via
   AWS Bedrock. Blocked on the same grounding spike as above, plus confirming Bedrock's Claude model
   availability in London vs. nearest EU region.
4. `docs/architecture/adr/0002-vector-database.md` — **PROPOSED, not accepted.** Recommends
   **Amazon OpenSearch Service** (hybrid BM25 + kNN natively, per-tenant index for isolation) —
   **not pgvector.** This directly conflicts with the milestone brief's own task 37 wording
   ("pgvector — TBC with client"), which is a strong signal the brief's author already knew this
   wasn't settled. See §5 — this is the single most consequential open decision in the whole
   milestone and blocks real progress on tasks 37/38, though not on 35/36. **Do not silently default
   to pgvector because the brief mentions it first** — the internal architecture team's own
   recommendation is OpenSearch, for reasons (native hybrid search, per-tenant isolation model) that
   directly serve tasks 38 and the isolation requirement in ADR-003. Surface this to the client
   explicitly (see the drafted client message associated with this spec) rather than picking one
   silently.
5. `docs/architecture/adr/0003-tenant-isolation.md` — **ACCEPTED IN PRACTICE** (schema-per-tenant on
   shared Aurora Postgres is what M2 actually built and M3/M4 have run on since). Still marked
   `PROPOSED` in the doc's own header (blocked on confirmed client scale) but treat the
   schema-per-tenant pattern itself as settled for M5 — every new M5 table lives in the tenant
   schema (`_TENANT_SCHEMA` table arg), exactly like `Rag`/`RagAssignment`/`Alert`/`Action`. If M5
   adds a vector store (OpenSearch or pgvector), it needs its **own** per-tenant isolation story on
   top of this — a shared OpenSearch index or a shared pgvector table with a `tenant_id`/`org_id`
   filter column would be a materially weaker isolation guarantee than everything else in this
   platform and should be flagged as a real design question, not assumed.
6. `docs/architecture/security-compliance-design.md` §1 — encryption at rest (KMS-managed keys for
   S3/RDS/OpenSearch), TLS in transit. Also flags a genuine open legal question (not yet answered):
   whether a hash-referenced-then-deleted document can still support the organisation's "prove the
   employee was given correct advice" evidential need after erasure — worth surfacing to the client
   again if document retention/deletion comes up during M5, since M5 is the milestone that actually
   makes this concrete (M4's audit ledger had nothing to point at yet).
7. `docs/architecture/cost-model.md` — indicative (not final) per-unit costs for Bedrock generation/
   embeddings, OpenSearch, S3, Fargate. Useful for sizing conversations with the client but
   explicitly not a quote.

## 4. Open decisions blocking (part of) the work — resolve before/alongside Phase 2

| # | Decision | Status | Blocks |
|---|---|---|---|
| 1 | **Vector database**: OpenSearch (internal recommendation, ADR-002) vs. pgvector (brief's placeholder, "TBC with client") vs. something else | Open — needs client input | Tasks 37, 38 (embeddings storage, hybrid retrieval). **Does not block** tasks 35/36 (upload + processing pipeline are storage/extraction only, vector-DB agnostic) |
| 2 | **LLM provider/model**: Claude via Bedrock (ADR-001 recommendation) — exact model tier, exact EU region (London vs. Ireland/Frankfurt) | Open — needs a decision + Bedrock model-access request in the client's AWS account | Task 39 (answer generation); indirectly 35 (AI-assisted content placement, if that sub-feature is attempted this milestone) |
| 3 | **Embedding model**: not yet chosen (ADR-001 explicitly defers this until vector DB is settled) | Open, downstream of #1 | Task 37 |
| 4 | **Real client documents** for the grounding spike (M1 item 2(a)) and the evaluation golden set (task 43) | Not yet provided | Blocks *validating* tasks 39/43/44 against reality — a synthetic test set can unblock pipeline plumbing in the meantime but must never be presented as validating real-world grounding (see `rag-evaluation-strategy.md` §3) |
| 5 | **OCR provider** for scanned images / image-based documents (task 35) | Not decided; AWS Textract is the natural AWS-native default given everything else lives in AWS, but nothing in the architecture docs commits to it yet | Task 35/36 for image inputs specifically; plain-text extraction (PDF/DOCX/TXT/MD) is unaffected and can proceed regardless |
| 6 | **AWS account access/permissions** for the dev team to actually provision the above (Bedrock model access, an OpenSearch domain if #1 lands there, any new S3 buckets for document storage) | Unclear whether current DevOps access already covers this or needs a fresh request | All of Phase 2+ |

A ready-to-send message to the client (Neil) covering items 1, 2, 4, 5, 6 was drafted alongside this
spec — ask whoever is running this session where that message ended up (likely earlier in this same
conversation) rather than re-drafting it blind.

## 5. Recommended phasing — don't let #4's open decisions block everything

Mirroring M4's phase style (small, individually-shippable, backend-first): the trap to avoid is
treating tasks 35-44 as one monolithic blocked-until-everything's-decided unit. Tasks 35/36
(upload + processing pipeline) need **no** vector-DB or LLM-provider decision at all — they're pure
file handling, text extraction, chunking. Start there while §4's decisions are being chased with the
client in parallel, the same way M4 didn't block Phase 1 on Phase 4's dashboard design being final.

### Phase 0 — Foundations: extend `Rag`, add document/chunk models, backfill script

- Extend `Rag` per its §4.1 hand-off contract (additive only — see §2.1 above for what must not
  change). Likely new columns: `alert_keywords` (or a related table if keywords need their own
  audit trail), an escalation-behaviour config field, whatever the "Settings" wizard step turns out
  to need once audited against real fields (§2.2).
- New table: `RagDocument` — one row per uploaded source file. Needs at minimum: `id, rag_id FK,
  filename, content_type, storage_key (S3), status (uploaded|processing|processed|failed),
  version, uploaded_by, uploaded_at, processed_at`. Old versions are **retained, not deleted**, on
  update — `rag-architecture.md` §2 is explicit that this is required for the audit ledger to
  reconstruct what was true at any point in time.
- New table (name TBC by vector-DB decision, §4#1): something to track chunk-level metadata even if
  the vectors themselves live in OpenSearch rather than Postgres — source document id, version,
  section/page, chunk text or a pointer to it, embedding-model version used (so a future
  re-embedding migration has something to key off). If pgvector is chosen instead, this table *is*
  where the vector column lives.
- `backend/scripts/backfill_m5.py`, same idempotent shape as `backfill_m4.py`, ships in the same PR
  as this phase's model changes — see §2.3's lesson.

### Phase 1 — Upload + processing pipeline (tasks 35, 36) — unblocked, start immediately

- S3 upload (per-tenant prefix), async ingestion job (not inline with the HTTP request — large PDFs
  must not block the request/response cycle).
- Text extraction per file type: PDF, DOCX, TXT, MD straightforward; images need OCR (§4#5 pending
  decision, but note the extraction *interface* can be built provider-agnostic now — implement
  against an abstraction, swap the OCR call in once #5 is decided); video is metadata-only per the
  milestone brief's own wording ("video metadata"), i.e. no transcription/embedding of video content
  in this milestone, just recording that a video file was attached.
- Chunking: semantic (paragraph/heading-aware), not fixed-character-count, per
  `rag-architecture.md` §2. Tune per document type only if early testing shows fixed chunking is
  clearly wrong for a document type actually seen — don't over-engineer this ahead of real data.
- Near-duplicate detection (hash-based is enough to start; embedding-similarity dedup needs Phase 2
  to exist first) can be deferred to a follow-up if it threatens the phase's timeline.

### Phase 2 — Embeddings + vector storage (task 37) — blocked on §4#1 and #3

- Once the vector-DB decision lands, implement embedding generation + storage. If OpenSearch:
  provision one index/collection per tenant (ties into the org-onboarding automation, per
  ADR-002's consequence #1 — check whether that automation exists yet or whether this needs a
  manual step for now, flagged honestly either way). If pgvector: add the vector column to the
  Phase 0 chunk table, install the extension on the Aurora cluster, and design the per-tenant
  isolation story explicitly (§3 point 5) rather than assuming a shared table + filter column is
  equivalent to the rest of the platform's isolation guarantees.

### Phase 3 — Hybrid retrieval + re-ranking (task 38) — blocked on Phase 2

- BM25 + kNN combined via reciprocal rank fusion if OpenSearch; if pgvector, hybrid retrieval needs
  its own design since pgvector alone doesn't give BM25 natively (likely Postgres full-text search
  `tsvector` + pgvector kNN, fused the same way) — this is a real extra design cost of the pgvector
  path worth putting in front of the client when presenting the two options.
- Re-ranking (cross-encoder over top-N) is a separate small service either way, per
  `rag-architecture.md` §4 — doesn't depend on which vector DB was chosen.

### Phase 4 — Grounded answering (task 39) — blocked on §4#2 (LLM provider)

- Structured output: answer + citations + a first-class machine-readable "insufficient grounding"
  signal (not inferred by parsing free text — `rag-architecture.md` §5 is explicit this needs to be
  deterministic for the escalation path in Phase 5 to work).
- Prompt templates + conversation memory — conversation storage doesn't exist yet anywhere in the
  platform (the Employee×RAG "Conversations" tab is a documented stub per §2.1). This phase likely
  needs to define that storage, even though full chat *UI* is M6's job — M5 needs somewhere to write
  a question+answer+citations+grounding-verdict record to, both for the employee-facing history and
  for the evaluation harness (Phase 6) to sample from.

### Phase 5 — RAG management + assignment analytics + escalation (tasks 40, 41, 42)

- Version history/update/delete/re-index (task 40) builds on Phase 0's document-versioning model.
- Per-RAG analytics (task 41) — question volume, refusal rate, top-cited documents; a natural
  consumer of Phase 4's conversation-record table.
- Escalation (task 42): the deterministic keyword-scan path (independent of the LLM entirely, per
  `rag-architecture.md` §6) writes into the **existing** `Alert` table (§2.1) — do not build a new
  alert table. Non-keyword refusal/escalation (LLM says "insufficient grounding") is a lighter-weight
  "pending question surfaced to the organisation" path — check whether this needs its own table or
  can be a state on the Phase 4 conversation record.

### Phase 6 — Evaluation harness + red-teaming (tasks 43, 44)

- Build per `rag-evaluation-strategy.md` in full — golden test set (needs §4#4's real documents to
  be *real*, not synthetic-only), red-team adversarial set (prompt injection via uploaded content,
  cross-RAG leakage probes, leading questions), LLM-as-judge scoring, release gates.
- This phase is explicitly ongoing/living, not a one-time deliverable — §7 of that doc describes
  production sampling and continuous golden/red-team-set growth from flagged answers. Ship the
  first version of the harness in this milestone; treat its ongoing maintenance as expected, not a
  scope overrun later.

### Phase 7 — Frontend wiring

- Make the mock wizard's steps real one at a time, in roughly the order their backend phase lands
  (Knowledge step ↔ Phase 1, Alert criteria ↔ Phase 5's escalation work, Settings ↔ whatever Phase 0
  audit determines, Review & create ↔ whichever phases are done by the time this is reached).
- Build (or extend, if it turns out to already exist as a mock — verify first, see §2.2) the
  employee-facing chat surface: ask a question, see a grounded answer with citations, see a refusal/
  escalation message when the RAG can't answer.
- Wire the Employee×RAG "Conversations" tab to Phase 4's real conversation records, replacing its
  current documented stub.
- **Apply the query-string-routing lesson (§2.3 item 2) to any new dynamic-id page from day one.**

## 6. Out of scope for M5 (explicitly)

- Turning `RagAssignment.access_code` into a real authentication factor — M6.
- Full chat-agent conversation UX beyond what Phase 4/7 need for grounding+citation+escalation to be
  demonstrable — the polished chat experience is M6's job; M5 needs just enough conversation storage
  to prove the RAG engine itself works and to feed the evaluation harness.
- Org/employee dashboards consuming `Alert`/`Action` broadly — M7, per the M4 close-out notes; M5
  should only touch these tables for the keyword-escalation write path (Phase 5), not build new
  dashboard UI for them.
- Video transcription/embedding — brief says "video metadata" only; treat actual video content
  understanding as out of scope unless the client explicitly asks for it mid-milestone.
- "Research using AI" (organisation-side, ungrounded, general-knowledge search to help find material
  to add to a RAG) — `rag-architecture.md` §7 describes this as a separate, lower-stakes flow. Worth
  scoping explicitly with the client as in/out before Phase 4, since it's easy to conflate with the
  RAG's own grounded answering and the two must never be confused in the UI (per that section).

## 7. Risks / watch-items

- **The vector-DB decision (§4#1) is the single biggest schedule risk.** If it drags, Phases 2-5 all
  stall behind it while Phase 1 alone can't fill 3.5 weeks of a 2-AI-engineer, 1-backend team. Chase
  this decision aggressively and in parallel with Phase 0/1 work, not sequentially after.
- **Real documents (§4#4) not arriving in time** risks shipping an evaluation harness that's only
  ever been tested against synthetic data — deliverable, but must be labelled honestly to the client
  as "pipeline validated, real-world grounding not yet measured" rather than implied as production-
  ready.
- **Schema-per-tenant backfill discipline** — repeat the M4 lesson (§2.3#1): every model change in
  every phase needs its own backfill script update from day one, not bolted on after a production
  incident.
- **Isolation guarantee regression risk if pgvector is chosen** (§3 point 5, §5 Phase 2) — a shared
  pgvector table with a tenant-filter column is a weaker isolation story than every other part of
  this platform (schema-per-tenant relational data, and OpenSearch's per-tenant index if that's the
  path taken instead). If the client picks pgvector for cost/simplicity reasons, this trade-off needs
  to be said out loud, not discovered later.
- **Conversation-memory storage design decided too casually.** Because M6 owns the "real" chat
  experience, it would be easy to under-design Phase 4's conversation record as a throwaway logging
  table. Design it as if M6 will build directly on it, because it will.
