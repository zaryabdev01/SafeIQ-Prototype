# Milestone 5 — AI Knowledge Base (RAG Engine): execution plan

**Written:** 2026-09-10. **Owner:** dev team (2 AI engineers + 1 backend engineer).
**Companion docs — read first:**

- `.claude/specs/m5-ai-knowledge-base.md` — the context bridge (what M4 shipped, what's decided, what's client-blocked). This plan assumes you've read it.
- `.claude/specs/SafeIQ_M5_RAG_Engine_Agent_Implementation_Guide.docx` — the per-task engineering handbook (contracts, security invariants, DB shapes, DoD).
- `docs/architecture/rag-architecture.md`, `rag-evaluation-strategy.md`, `adr/0001..0005`.

This document is the **merge** of the two planning docs above plus the decisions taken on
2026-09-10, expressed as a phase-by-phase build plan with concrete data models, provider
interfaces, and a definition of done per phase. Where it differs from the companion docs, the
differences are called out in §3.

---

## 1. Decisions locked (2026-09-10)

| # | Decision | Resolution | Consequence for this plan |
|---|---|---|---|
| 1 | **Vector store** | **pgvector on the existing Aurora PostgreSQL 15.15** (`aurora.tf:15` — pgvector is an available extension on our engine). No OpenSearch. | Vectors live in a `vector` column on the chunk table **inside each tenant schema** — same isolation guarantee as every other M4 table. No OpenSearch driver, no per-tenant index provisioning, no separate vendor. ADR-002's OpenSearch recommendation is superseded for MVP; note the hybrid-retrieval design cost in §8. |
| 5 | **OCR provider** | **AWS Textract** — sync (`DetectDocumentText`) and async (`StartDocumentTextDetection` / `GetDocumentTextDetection`), IAM role being provisioned by DevOps (`${project}-${env}-textract-ocr-access` on the ECS task role), reading from the new `aws_s3_bucket.rag_documents` bucket. `AnalyzeDocument` / `StartDocumentAnalysis` (FORMS/TABLES) granted but **deferred** — enable only if a real client document needs structured extraction. | OCR is a real, available backend from day one. Build the `OcrProvider` abstraction anyway (§7) so tests don't hit Textract, but the Textract impl is in scope for Phase 1, not stubbed. |
| 2·3 | **LLM stack — generation + embeddings** | **OpenAI**, reusing the existing `OPENAI_API_KEY` + `openai_base_url` httpx pattern already in `app/services/onboarding_search.py`. Embeddings: `text-embedding-3-small`, **1536-dim**, cosine. Generation: `gpt-4o` recommended for strict grounding/refusal (the config default `gpt-4o-mini` is measurably looser on refusal — validate in Phase 4 eval). No AWS Bedrock, no Claude. | Phases 2 and 4 are **no longer blocked on AWS Bedrock model access** — the real path is available from day one; the `Fake*` impls stay for CI only. **Compliance caveat (now a client sign-off item, §2):** the OpenAI API is US-hosted, in tension with ADR-001 / `security-compliance-design.md`'s UK-only-for-MVP + no-training bar. |

## 2. Decisions still open — chase in parallel, do NOT let them block

| # | Decision | Blocks | Fallback so work continues |
|---|---|---|---|
| 2 | **Data residency / processing location.** The chosen LLM stack is the **OpenAI API (US-hosted)**. ADR-001 and `security-compliance-design.md` set a UK-only-for-MVP + no-provider-training bar, so using OpenAI needs an explicit client decision. | Nothing in the code — contractual/compliance only. | Two acceptable endings, both ≈zero code change: (a) client accepts US processing under OpenAI's API terms (no training on API data by default; optionally a zero-retention / enterprise agreement); or (b) **Azure OpenAI in an EU region** — identical models, EU data residency, same `AnswerGenerator` / `Embedder` code with a different `base_url` + auth. Build on the OpenAI API for dev/CI now; the production endpoint is a config swap. |
| 4 | **Real client documents** for the grounding spike + evaluation golden set. | *Validating* Phases 4/6 against reality. Does **not** block building the harness. | Synthetic golden + red-team sets, clearly labelled "pipeline validated, real-world grounding not yet measured" (see `rag-evaluation-strategy.md` §3). |
| 6 | **AWS enablement** — confirm `TEXTRACT_REGION` == `rag_documents` bucket region; confirm the `rag_documents` bucket + the processing-worker task/service exist in Terraform. | Phase 1 (OCR) and Phase 2+ in a real environment. Local dev is unaffected — pgvector is just Postgres, OpenAI is just an API key. | DevOps is already on the Textract role + bucket. |

**Client message** covering #2 (data residency) and #4 (real documents) is being sent by the user
in parallel with Phase 0/1 starting.

## 3. Where this plan differs from the companion docs

1. **Async job infrastructure does not exist in the codebase.** No Celery / RQ / arq, no Redis,
   no `BackgroundTasks` usage anywhere in `safeiq-be`. Both companion docs say "process
   asynchronously" as though it's free. It is a Phase 0 build. This plan uses a **DB-backed job
   queue** (`ProcessingJob` table + a dedicated worker process using `SELECT … FOR UPDATE SKIP
   LOCKED`) — no new infra dependency, naturally idempotent/retryable, "persist processing-stage
   errors" falls out for free, and it runs on the same Aurora cluster. See §5 and §9.
2. **The keyword-alert path ships in Phase 1**, not Phase 5. It is a deterministic regex scan with
   zero AI dependency and it is the safety-critical path — see Phase 1.
3. **The conversation/QA record (`RagQueryEvent`) is designed in Phase 0**, not deferred to
   Phase 4. Four M5 consumers need it (analytics, escalation, eval sampling, the Employee×RAG
   "Conversations" tab stub) and M6 builds conversation threading directly on top of it.
4. **The pgvector isolation story is strong, not weak.** `.claude/specs/m5-ai-knowledge-base.md`
   §3 point 5 worries about "a shared pgvector table + tenant_id filter". We are not doing that —
   `tenant_provisioning.py` already gives every org its own schema, and the chunk+vector table
   lives in it. This is the same guarantee as `users`, `rags`, `alerts`.
5. **Provider abstractions are a firm Phase 0 deliverable** for all five external dependencies,
   copying the existing `app/services/media_storage.py` pattern (ABC + `Null*` + settings switch).
6. **The monorepo `backend/` here is pre-M4.** M5 builds on M4's `Rag` / `RagAssignment` /
   `Alert`. See §4 — this must be reconciled before Phase 0 code lands.

## 4. Prerequisite before Phase 0

`safeiq-be/` (clone of `GTG-Enterprises/safeiq-be`, on `main`) has the full M4 backend:
`app/api/routes/rags.py`, `alerts.py`, `actions.py`, `team_profile.py`, `app/services/access_code.py`,
the `Rag` / `RagAssignment` / `Alert` / `AlertStageTransition` / `Action` models in
`app/models/tenant.py`. The monorepo `backend/` in this working tree does **not** — it predates M4.

**Action:** confirm which tree M5 backend work commits to. Either (a) work directly in the
`safeiq-be` repo and let the monorepo sync follow, or (b) catch the monorepo `backend/` up to
`safeiq-be@main` first. This plan's file paths are written against the `safeiq-be` layout.
Frontend (Phase 7) targets `safeiq-fe` — clone it when Phase 7 starts.

**Branch/PR policy:** every phase is its own branch + PR + teammate review. Never commit to `main`
(company policy, hook-enforced).

---

## 5. Data model

All new tables carry `__table_args__ = _TENANT_SCHEMA` (or a tuple ending in it) and live in the
tenant schema, exactly like the M4 tables. `metadata.create_all` (in `provision_tenant_schema`)
picks up new **tables** automatically for new tenants; `scripts/backfill_m5.py` runs `create_all`
+ the `ALTER` statements for new **columns on `rags`** against existing tenant schemas.

### 5.1 `Rag` — additive columns only (ALTER + backfill)

Per the M4 hand-off contract (`m4-team-management.md` §4.1, echoed in the `RagStatus` docstring):
**do not** rename `rags`, drop `id` / `name` / `status`, or change `RagStatus` values.
`RagAssignment.rag_id`, `Alert.rag_id`, `Action.rag_id`, `RagActivityEvent.rag_id` all FK it.

| Column | Type | Purpose | Wizard step |
|---|---|---|---|
| `alert_keywords` | `JSON` (list of `{term, severity}`) default `[]` | Deterministic keyword-alert config. A column, not a table, unless the client wants keyword-change history — then promote to `RagAlertKeyword` with its own audit rows. | Alert criteria |
| `escalation_note` | `String(2000)` nullable | Free-text "what happens when this RAG can't answer". | Escalation |
| `retrieval_config` | `JSON` nullable | `top_k`, hybrid weights, score thresholds, rerank on/off, refusal-gate params. Audit the mock "Settings" step against this once its fields are read in full. | Settings |
| `embedding_model` | `String(100)` nullable | The RAG's active embedding contract, e.g. `text-embedding-3-small`. | (internal) |
| `embedding_version` | `String(50)` nullable | e.g. `te3-small-1536`. Key for a future re-embed migration. | (internal) |

### 5.2 New tables

**`RagDocument`** — one logical source file per row.
`id, rag_id→rags, filename, content_type (MIME), source_type (enum: policy|procedure|guidance|
template|regulation|faq|website|other — matches frontend ContentType), storage_key (S3),
byte_size, sha256, status (enum: uploaded|queued|processing|chunking|embedding|indexed|failed),
current_version_id→rag_document_versions nullable, uploaded_by→users, uploaded_at,
processed_at nullable, error_detail JSON nullable`

**`RagDocumentVersion`** — retained on update, never deleted (rag-architecture §2, ADR-005).
`id, document_id→rag_documents, version_no (int, 1-based), storage_key (S3 — each version its own
object), sha256, status (same enum), chunk_count, chunking_version, embedding_model,
embedding_version, is_active (bool — exactly one active per document), created_by→users,
created_at, superseded_at nullable`

**`RagDocumentChunk`** — the retrievable unit.
`id, document_id→rag_documents, document_version_id→rag_document_versions, rag_id→rags
(denormalised for the hard filter), chunk_index (int), text (Text), section (String nullable),
page_number (int nullable), source_location (JSON nullable — bbox / char offsets for citations),
source_type, token_count (int nullable), chunking_version (String),
content_tsv (TSVECTOR — generated: to_tsvector('english', text)),
embedding (Vector(1536) nullable — null until Phase 2 embeds it),
embedding_model (String nullable), embedding_version (String nullable), created_at`

Indexes:
- `hnsw (embedding vector_cosine_ops)` `WITH (m=16, ef_construction=64)` — declared via
  `Index(..., postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"},
  postgresql_with={"m": 16, "ef_construction": 64})` so `create_all` emits it.
- `GIN (content_tsv)`
- `btree (rag_id, document_version_id)`, `btree (document_id, chunk_index)`

**`ProcessingJob`** — see §9 for the queue design. **Decision point flagged, not silently
taken:** either (a) per-tenant `ProcessingJob` table (isolation-clean, worker polls every tenant
schema) or (b) a **control-plane** `processing_jobs` table carrying `tenant_schema` + document
UUID + status only, worker sets `schema_translate_map` per job. This plan recommends **(b)** —
job rows hold no document content, only ids/status/schema, matching how `control.onboarding_videos`
already holds cross-tenant catalogue data; full error detail stays in the per-tenant
`RagDocument.error_detail`, the control-plane row keeps a generic reason. Confirm with the team
before Phase 0 migration.
Fields: `id, tenant_schema, document_id (uuid), document_version_id (uuid nullable),
job_type (enum: ingest|reindex|reembed|ocr), status (enum: pending|running|succeeded|failed|
cancelled), attempts (int), max_attempts (int default 5), stage (String — human step),
error_reason (String nullable — generic), scheduled_at, started_at nullable, finished_at nullable,
locked_by (String nullable), locked_at nullable, created_at`

**`RagQueryEvent`** — the M6-ready conversation substrate. One row per employee question.
`id, rag_id→rags, user_id→users (the employee), assignment_id→rag_assignments nullable,
conversation_id (uuid — M5 sets one per question or per session; M6 groups threads by it),
question_text, normalized_question nullable,
retrieval_meta (JSON — candidate count, top scores, applied filter set),
answer_text nullable, status (enum: answered|refused|error),
insufficient_grounding (bool), citations (JSON — [{chunk_id, document_id, document_version_id,
label, location}]), grounding_verdict (JSON nullable — from citation validation / judge),
keyword_hits (JSON nullable), escalation_id→escalations nullable,
latency_ms_retrieval, latency_ms_rerank, latency_ms_generation, latency_ms_total,
model_name nullable, created_at`

**`Escalation`** — the "pending question surfaced to the org" lighter path.
**Keyword-triggered alerts do NOT come here** — they go to the existing `Alert` table
(stage `keyword_detected`). Escalation is for LLM refusal / low confidence.
`id, rag_id→rags, user_id→users, query_event_id→rag_query_events,
reason (enum: insufficient_grounding|low_confidence|explicit_refusal|error),
question_text (denormalised), retrieval_summary (JSON nullable),
status (enum: pending|acknowledged|answered|closed), assigned_to→users nullable,
resolution_note (String nullable), created_at, resolved_at nullable`

### 5.3 `scripts/backfill_m5.py`

Same shape as `scripts/backfill_m4.py`: iterate `Organisation.tenant_schema`, run
`create_all` per schema (idempotent — new tables only), then the `rags` `ALTER … ADD COLUMN
IF NOT EXISTS` statements. `--dry-run` / apply flags. **Ships in the same PR as the Phase 0
model changes** — this is the M4 login-500 lesson (`m5-ai-knowledge-base.md` §2.3).
The `CREATE EXTENSION IF NOT EXISTS vector` runs once at the database level (see §8), not per
schema — put it in a control-plane Alembic migration and in `provision_tenant_schema` before
`create_all`.

---

## 6. Embedding contract (lock in Phase 0)

```
provider          = OpenAI (reuse OPENAI_API_KEY + openai_base_url — same httpx
                    pattern as app/services/onboarding_search.py)
model_name        = "text-embedding-3-small"
dimension         = 1536
metric            = "cosine"                # pgvector vector_cosine_ops / <=> operator
embedding_version = "te3-small-1536"
```

`text-embedding-3-small` @ 1536 is the pick over `-3-large` (3072) because **pgvector's HNSW
index caps at 2000 dimensions** — 3072 would force dimension reduction or an IVFFlat index with
worse recall. The config default `openai_embedding_model` is already `text-embedding-3-small`.

Persist `embedding_model` + `embedding_version` on **every** chunk row, version row, and on the
RAG. A model/dimension change later is: re-embed job + one `ALTER TABLE … ALTER COLUMN embedding
TYPE vector(N)` + HNSW index rebuild, keyed off `embedding_version`. Generation model: `gpt-4o`
recommended for strict refusal discipline; validate against the cheaper `gpt-4o-mini` in Phase 4
eval before committing.

---

## 7. Provider interfaces (Phase 0 deliverable)

Copy the `app/services/media_storage.py` pattern exactly: an ABC, a `Fake*` / `Null*` default, a
real impl, selected by a string setting in `app/core/config.py` (like `media_storage_backend`,
`onboarding_search_provider`). New settings:

```
ocr_provider           = "textract" | "none" | "fake"       # Phase 1
embedding_provider      = "openai" | "fake"                  # Phase 2
vector_store            = "pgvector"                         # only impl
reranker                = "passthrough" | "llm"              # Phase 3
answer_generator        = "openai" | "fake"                  # Phase 4
# OpenAI reuses the existing openai_api_key / openai_base_url / openai_model /
# openai_embedding_model settings already in app/core/config.py.
openai_answer_model     = "gpt-4o"        # generation; distinct from openai_model (onboarding)
rag_documents_s3_bucket = ""
rag_documents_s3_prefix = "rag/"          # tenant-scoped: rag/<schema>/<doc_id>/<version>/<file>
textract_region         = "eu-west-2"    # == rag_documents bucket region
```

| Interface | Methods | Default impl | Real impl (phase) |
|---|---|---|---|
| `DocumentStorage` | `create_upload(filename, content_type, key) -> PresignedPut`; `get_object_ref(key)`; `delete(key)` | reuse/extend `S3MediaStorage` shape | S3, per-tenant prefix (Phase 1) |
| `OcrProvider` | `extract_text(*, s3_bucket, s3_key, content_type, mode="text") -> OcrResult{text, blocks[], page_count}` | `FakeOcrProvider` (fixture text) | `TextractOcrProvider` (Phase 1) — §9 |
| `Embedder` | `model_name`, `dimension`, `metric`; `embed(text)`; `embed_batch(texts)` | `FakeEmbedder` (sha256 → deterministic 1536-d unit vector) | `OpenAiEmbedder` (Phase 2 — `/embeddings`, batched `input`, reuse the `onboarding_search.py` httpx pattern) |
| `VectorStore` | `upsert_chunks(chunks)`; `knn(*, rag_id, query_vector, k, filters) -> [Candidate]`; `delete_by_version(version_id)` | — | `PgVectorStore` (Phase 2) — operates on the tenant-scoped `AsyncSession`, never a global one |
| `Reranker` | `rerank(*, query, candidates, top_n) -> [Candidate]` | `PassthroughReranker` (return top_n by fused score) | LLM listwise rerank via `gpt-4o-mini` (Phase 3, non-blocking) |
| `AnswerGenerator` | `generate(*, question, evidence, conversation) -> GroundedAnswer{status, answer, citations[], insufficient_grounding, raw}` | `FakeGenerator` (deterministic answer/refuse from evidence overlap) | `OpenAiGenerator` (Phase 4 — `/chat/completions`, `response_format=json_object`, `temperature=0`) |

`insufficient_grounding` is a **first-class boolean on the structured output**, never parsed from
answer text (rag-architecture §5, docx §11 & §15).

---

## 8. pgvector implementation notes

- **Extension:** `CREATE EXTENSION IF NOT EXISTS vector;` is database-scoped (objects land in
  `public`). Run it once in a control-plane Alembic migration (`alembic/versions/0005_pgvector.py`)
  **and** at the top of `provision_tenant_schema` before `create_all`, so a brand-new tenant's
  `create_all` can resolve the `vector` type. Tenant sessions use
  `schema_translate_map={"tenant": "tenant_x"}`; `public` stays on the search_path so `vector`
  resolves unqualified. Confirm no session sets a restrictive `search_path`.
- **Version:** Aurora PG 15.15 ships pgvector ≥ 0.7 — HNSW is available (needs ≥ 0.5.0). Verify
  with `SELECT extversion FROM pg_extension WHERE extname='vector';` in the target environment
  during Phase 0.
- **Column & index:** `embedding vector(1536)` (inside HNSW's 2000-dim limit); HNSW with `vector_cosine_ops`. Build the index
  after the first bulk load per environment if load time matters; for MVP volumes, `create_all`
  emitting it upfront is fine.
- **Hybrid retrieval (the design cost pgvector adds vs OpenSearch, `m5-ai-knowledge-base.md`
  Phase 3):** pgvector gives kNN only. Keyword side = Postgres full-text search — `content_tsv`
  generated column + GIN index, ranked with `ts_rank_cd`. It is not true BM25 but is adequate for
  policy-name / code / exact-term matching. **Do not** assume the ParadeDB/`pg_search` BM25
  extension is available on Aurora — it is not; stick to native FTS. Fuse the two result lists
  with **Reciprocal Rank Fusion** (k = 60) in application code, then hand top-N to the reranker.
- **Hard filters are SQL `WHERE`, applied in the same query as / before kNN** — `rag_id = :rag`
  `AND document_version_id IN (active versions)` `AND` (tenant is already the schema).
  Similarity score is **never** an authorization mechanism (docx §9, §10).
- **Deletion vs supersede:**
  - *Supersede* (new version uploaded): old version rows **retained**, `is_active=false`;
    retrieval filters `is_active=true`. Audit ledger can still reconstruct history.
  - *Delete* (document removed / GDPR erasure): hard-delete the chunk rows (and their vectors)
    and the S3 objects; leave the ledger hash entry. `VectorStore.delete_by_version` +
    `DocumentStorage.delete`. The "deleted content no longer retrievable" test (§10) exercises
    this path.
  - Retention policy for erasure vs the evidential need is an **open client question** (ADR-005,
    `security-compliance-design.md`) — surface it; default to retain-all + soft-delete until told
    otherwise.

---

## 9. Async processing (Phase 0) + Textract (Phase 1)

### 9.1 Job queue

- `processing_jobs` control-plane table (§5.2 option b). A **worker process** (`app/worker.py`,
  new container / ECS service — coordinate with DevOps) loops:
  `SELECT … WHERE status='pending' AND scheduled_at <= now() ORDER BY created_at
   FOR UPDATE SKIP LOCKED LIMIT n` → mark `running`, `locked_by`, `locked_at` → run the pipeline
  stage → on success `succeeded`; on transient failure `attempts++`, back to `pending` with
  exponential `scheduled_at` backoff up to `max_attempts`, then `failed`.
- **Idempotency:** every stage is safe to re-run. `ingest` deletes any partial chunks for
  `(document_version_id)` before re-chunking; `embed` upserts by `chunk_id`; re-running a
  `succeeded` job is a no-op.
- The HTTP upload endpoint only: validates, writes `RagDocument` + `RagDocumentVersion`, uploads
  to S3 (presigned PUT — bytes never transit the API), enqueues one `ingest` job, returns
  `{document_id, status: "queued"}`. No parsing/OCR/embedding inline.
- Stage sequence: `PROCESSING → (OCR if needed) → CHUNKING → EMBEDDING → INDEXED`, or `FAILED`
  with `RagDocument.error_detail` populated so the UI can explain it.

### 9.2 Textract

- OCR is invoked **conditionally**: run the native extractor first (PDF text layer, DOCX, TXT,
  MD); if text density is below a threshold or the input is an image type, fall back to Textract.
- **Sync** `DetectDocumentText`: JPEG / PNG, single page only.
- **Async** `StartDocumentTextDetection` → poll `GetDocumentTextDetection(JobId)` with bounded
  backoff until `JobStatus ∈ {SUCCEEDED, FAILED}`: multi-page PDF, TIFF. No SNS topic needed —
  the granted IAM actions support polling.
- Input is an **S3 object reference** (`{S3Object: {Bucket, Name}}`) into the `rag_documents`
  bucket (Textract has `s3:GetObject` there) — never send bytes.
- `TEXTRACT_REGION` must equal the `rag_documents` bucket region (eu-west-2 expected; Textract is
  available there). Confirm with DevOps.
- Enforce an upload size / page limit comfortably under Textract's async ceilings
  (≈ 3000 pages / 500 MB PDF).
- `AnalyzeDocument` / `StartDocumentAnalysis` (`mode="forms_tables"`) — interface path exists,
  implementation deferred until a real client doc needs it.
- Note the per-page Textract cost in `docs/architecture/cost-model.md`; keep OCR conditional, not
  a default step.

---

## 10. Security invariants — required tests every phase (docx §9)

Non-negotiable, wired into CI:

1. **Cross-tenant retrieval** — a user in org A can never retrieve org B's chunk (schema
   isolation makes this structural; test it anyway).
2. **Cross-RAG retrieval** — a query against RAG X never returns RAG Y's chunk.
3. **Unassigned-RAG** — a user with no active `RagAssignment` to a RAG cannot query it or
   retrieve its content.
4. **Archived / superseded** — `is_active=false` versions never appear in active retrieval.
5. **Deleted content** — after a document delete, no stale vector row is retrievable.
6. **No query param overrides scope** — `rag_id` / tenant come from the session + assignment, not
   from client-supplied filters.
7. **Similarity is not authorization** — a high cosine score never bypasses a failed hard filter.
8. **Document prompt injection** — a chunk containing "ignore previous instructions…" is treated
   as untrusted data, not an instruction (Phase 6 red-team, but assert the prompt structure in
   Phase 4 unit tests: system/policy → retrieval instructions → question → UNTRUSTED CONTENT).

---

## 11. Evaluation gates (Phase 6, from `rag-evaluation-strategy.md` §6 — starting bar, to recalibrate on real data)

| Metric | Starting minimum |
|---|---|
| Refusal accuracy — red-team set | ≥ 95% |
| Refusal accuracy — golden set (not over-refusing) | ≥ 90% |
| Citation precision | ≥ 90% |
| Citation recall | ≥ 85% |
| Keyword-alert reliability | 100% (deterministic, no tolerance) |

First month of real measurements = calibration period before these become hard CI blockers.
Ship the harness + synthetic sets in M5; treat ongoing golden/red-team-set growth as expected,
not scope creep.

---

## 12. Phases

Each phase = one branch + PR + review. Estimates assume the 3-person team and parallel work
(AI Eng 1 on ingestion, AI Eng 2 on retrieval/generation/eval, Backend Eng on models/APIs).

### Phase 0 — Foundations & contracts — **unblocked** — ~2–3 days

**Goal:** every later phase can start without a schema change.
- Reconcile the repo (§4).
- `Rag` additive columns; `RagDocument`, `RagDocumentVersion`, `RagDocumentChunk`,
  `RagQueryEvent`, `Escalation` models; control-plane `processing_jobs`.
- `CREATE EXTENSION vector` migration + provisioning hook; verify pgvector version in the target
  env.
- `scripts/backfill_m5.py` (same PR).
- The six provider interfaces + `Fake*` / `Null*` impls + config settings (§7).
- `app/worker.py` skeleton: claim / run / retry / backoff loop against `processing_jobs`
  (no real stages yet — a no-op stage that flips status).
- Lock the embedding contract (§6) in code constants.
- Write `docs/architecture/m5-vector-isolation.md` (pgvector-in-tenant-schema design + deletion
  semantics) and an ADR addendum noting ADR-002 is superseded by decision §1.1.

**DoD:** migrations apply clean on a fresh DB and via backfill on a seeded multi-tenant DB;
`create_all` emits the HNSW + GIN indexes; worker claims and completes a no-op job; all provider
fakes importable and unit-tested; `pytest` green.

### Phase 1 — Upload + processing pipeline (tasks 35/36) — **unblocked** — ~4–5 days

**Goal:** drop a file → it ends up as chunks with citation metadata; keyword alerts fire.
- `POST /rags/{id}/documents` (presigned PUT), `GET /rags/{id}/documents`,
  `GET /rags/{id}/documents/{doc_id}` (status + error), `DELETE` (soft).
- Native extraction: PDF (text + page), DOCX (headings/lists/tables where feasible), TXT, MD
  (heading hierarchy). `OcrProvider = textract` for image / low-text PDF (§9.2).
- Cleaning: strip repeated headers/footers when safely detectable, normalise whitespace, preserve
  headings/list structure and source locations.
- **Structure-aware chunking** with `chunking_version`; every chunk carries `document_id`,
  `document_version_id`, `rag_id`, `section`, `page_number` / `source_location`, `source_type`,
  `chunk_index`, `token_count`. Populate `content_tsv`.
- Hash-based near-duplicate detection against existing docs in the same RAG (flag, don't block).
- Video = metadata row only, no processing.
- **Keyword-alert path:** on the employee question endpoint (stub the retrieval side for now, or
  land the endpoint in Phase 3 and the scanner here as a service), a deterministic regex/`in`
  scan of the raw question against `rag.alert_keywords` writes an `Alert` (stage
  `keyword_detected`, `keyword=<term>`, `severity` from config) + the initial
  `AlertStageTransition`. Independent of the LLM entirely. Also writes the audit ledger.

**DoD:** upload → worker → `INDEXED` with chunk rows for a real PDF/DOCX/TXT/MD; a scanned-image
PDF routes through Textract; failures surface in `error_detail`; re-running the job produces no
duplicate chunks; keyword scan fires an `Alert` on a configured term and nothing on a disabled
one (deterministic test suite); authorization tests 1–6 pass for the document endpoints.

### Phase 2 — Embeddings + vector storage (task 37) — **unblocked** (pgvector + OpenAI both available) — ~3 days

- `OpenAiEmbedder` (`/embeddings`, batched `input`, reuse the `onboarding_search.py` httpx
  pattern) + keep `FakeEmbedder` for CI. Batch in the worker (`embed_batch`), bounded
  retry/backoff on 429s.
- `PgVectorStore.upsert_chunks` writes the `embedding` column; `knn` does cosine `<=>` with the
  hard `WHERE` filters; `delete_by_version` clears rows.
- Worker `EMBEDDING` stage: embed all chunks of the new version, set `embedding_model` /
  `embedding_version`, flip version → `indexed`, document → `indexed`.
- `reembed` job type for a future model change.

**DoD:** a document reaches `INDEXED` with non-null 1536-d vectors; `knn` returns that document's
chunks for a paraphrased query (via `OpenAiEmbedder`, and `FakeEmbedder` in CI); HNSW index is
used (`EXPLAIN`); cross-RAG / cross-tenant kNN returns nothing (tests 1–2, 7).

### Phase 3 — Hybrid retrieval + re-ranking (task 38) — after Phase 2 — ~3 days

- Retrieval service: query normalisation / optional rewrite → **authorization + hard metadata
  filters** → parallel (kNN, FTS) → RRF fuse → `Reranker.rerank` (passthrough default) →
  top-K evidence. Stable result contract (docx §10/§14 JSON shape).
- `Reranker` is optional here — land the interface + `PassthroughReranker` (RRF order); an LLM
  listwise rerank (`gpt-4o-mini`) is a fast-follow. Not a blocker.
- Employee question endpoint (`POST /rags/{id}/query` or `/employee/rags/{id}/ask`) lands here,
  gated by an active `RagAssignment`, wired to retrieval + the Phase 1 keyword scanner. Answer
  generation stubbed via `FakeGenerator` until Phase 4.

**DoD:** end-to-end retrieval for an indexed RAG returns ranked, correctly-scoped evidence;
keyword scan still fires independently; unassigned user → 403; all authorization tests pass.

### Phase 4 — Strictly grounded answering + refusal (task 39) — **unblocked** (OpenAI available) — ~3 days

- `OpenAiGenerator`: `/chat/completions` with `response_format={"type":"json_object"}`,
  `temperature=0`, strict-grounding system prompt (answer only from supplied evidence; cite
  chunk(s); untrusted-content framing) → `{status, answer, citations[], insufficient_grounding}`.
- **Multi-check refusal gate** (not one threshold): retrieval score floor **AND** evidence-
  sufficiency check **AND** post-generation claim-support / citation-entailment check. Any fail →
  `refused` + `insufficient_grounding=true`.
- Citation validation: each citation must resolve to a real chunk **and** support its claim.
- Write the full `RagQueryEvent` (question, retrieval_meta, answer, citations, verdict,
  latencies, model). Audit-ledger the event.
- Conversation context: used only to resolve follow-ups into a standalone query; the answer is
  always re-retrieved and re-grounded. Prior model answers are never authoritative.

**DoD:** in-scope question → grounded answer with citations that resolve and support; out-of-scope
question → refusal + `insufficient_grounding`; a prompt-injection string in a chunk does not
change behaviour (unit test on prompt assembly + a Phase 6 red-team case); `RagQueryEvent` rows
complete.

### Phase 5 — Escalation + RAG management + analytics (tasks 40/41/42) — ~3 days

- Refusal / low-confidence → `Escalation` row (`reason`, `status=pending`), linked from the
  `RagQueryEvent`, surfaced via `GET /rags/{id}/escalations` and an org-side list. Keyword hits
  continue to the `Alert` table (Phase 1) — two distinct paths, both audit-ledgered.
- Management: `GET /rags/{id}/documents/{doc}/versions`, `POST …/versions` (update → new version
  → re-process), `POST …/reindex` (re-chunk/re-embed existing content after a strategy change),
  archive/delete semantics per §8, processing-status + retry visibility.
- Analytics (operational only, M7 consumes): `GET /rags/{id}/analytics` — total / answered /
  refused / escalated question counts, refusal rate trend, top-cited documents, retrieval /
  generation / total latency percentiles, indexed-content + active-user counts. No dashboards.

**DoD:** version history correct across an update; re-index reproduces chunks with a new
`chunking_version`; archive hides content from retrieval, delete removes it (test 4, 5);
analytics numbers reconcile against `RagQueryEvent` rows.

### Phase 6 — Evaluation harness + red team (tasks 43/44) — harness unblocked; real golden set waits on §2 #4 — ~3 days

- Golden-set schema (question, expected `answer|refuse`, expected citation set, failure-mode
  note) + a **synthetic** set per category, labelled "pipeline-only, not real-world validated".
- Evaluators: LLM-as-judge groundedness, citation precision/recall vs expected, refusal accuracy
  (golden + red-team tracked separately), deterministic keyword-alert suite. Judge and generator
  are both OpenAI → same-family judge/generator correlation (`rag-evaluation-strategy.md` §8);
  the mandatory human spot-check of a sample is the mitigation, and a second-vendor judge can be
  swapped in later.
- Red-team set: doc prompt-injection, cross-RAG / cross-tenant leakage probes, leading/loaded
  questions, "answer from general knowledge", "use previous conversation", assignment-bypass
  attempts.
- Regression gate script → CI (item 11 CI/CD), thresholds §11, calibration period before hard
  block. Any in-product flagged answer feeds back into the sets.

**DoD:** `make eval` runs the full suite against a seeded RAG and prints per-metric scores + a
pass/fail gate; red-team suite all-pass on refusal; keyword suite 100%; CI job wired
(non-blocking initially).

### Phase 7 — Frontend wiring — after the matching backend phase — ~4–5 days

Target repo: `safeiq-fe`. **Any new dynamic-id page uses `?id=…`, not `/[id]`** (the
`output: "export"` lesson, `m5-ai-knowledge-base.md` §2.3).
- Make the mock wizard steps real, one at a time: Knowledge ↔ Phase 1, Alert criteria ↔ Phase 1
  keyword config, Settings ↔ Phase 0 `retrieval_config` audit, Review & create ↔ whatever's done.
- **Rewire the existing employee chat mock** (`src/app/employee/my-rags/page.tsx` —
  `askRag(ragId, userId, text)` against `useApp()`) to the real `POST /rags/{id}/query`:
  grounded answer + citation chips + a refusal/escalation message when the RAG can't answer.
  This is a rewire, not net-new — the spec's claim that no mock exists is wrong.
- Wire the Employee×RAG "Conversations" tab to real `RagQueryEvent` data, replacing the stub.
- Document version history / upload / re-index UI on the RAG detail page.

**DoD:** a demo persona and a real session both: create a RAG, upload a document, watch it
index, ask it an in-scope question and get a cited answer, ask an out-of-scope question and get a
refusal that appears as an escalation to the org.

---

## 13. Critical path, parallelisation, fallback

- **Start now, in parallel:** Phase 0 (Backend Eng), Phase 1 native extraction + chunking
  (AI Eng 1), Phase 1 keyword-alert scanner (AI Eng 2 or Backend Eng). None blocked.
- **No external access now blocks the build.** OpenAI (key in hand), Textract (DevOps role in
  flight), and pgvector (just Postgres) are all available. The one open item — data-residency
  sign-off (§2 #2) — is contractual and resolves to a production `base_url` swap (OpenAI API ↔
  Azure OpenAI EU), not a code change. `Fake*` impls exist for CI only.
- **Real client documents (§2 #4)** gate only the honesty label on Phase 6 results, not the
  build. Say "pipeline validated, real-world grounding not yet measured" until they arrive.
- **pgvector version check** in Phase 0 is a 5-minute task that de-risks the whole vector path —
  do it first.

## 14. Team ownership (from docx §18/§24)

| Role | Phases / surface |
|---|---|
| **AI Engineer 1** | Ingestion, parsers, Textract/OCR, cleaning, chunking, metadata, embeddings, indexing, processing worker (Phases 1–2) |
| **AI Engineer 2** | Query processing, hybrid retrieval, RRF, re-ranking, grounded generation, citations, refusal gate, escalation logic, evaluation + red-team harness (Phases 3–4, 6) |
| **Backend Engineer** | Models, migrations, backfill, document/RAG/version/job/analytics APIs, permissions, M4 assignment integration, tenant isolation, `RagQueryEvent` / `Escalation` persistence, frontend contracts (Phases 0, 5; support 1–4, 7) |

## 15. Open items to put to the client (with the credentials message)

1. **Data residency (§2 #2):** the LLM stack is the OpenAI API (US-hosted). Confirm the client
   accepts OpenAI API processing under its no-training terms, or wants Azure OpenAI in an EU
   region instead (same code, production `base_url` swap). This is in tension with ADR-001 /
   `security-compliance-design.md`'s UK-only-for-MVP bar and needs an explicit answer.
2. **Models:** confirm `text-embedding-3-small` (1536-dim, baked into the schema) and `gpt-4o`
   for generation are acceptable.
3. **Real documents:** sample anonymised client documents for the grounding spike + golden set;
   likely needs the NDA / data-handling agreement in place. (§2 #4)
4. **Document retention on erasure:** confirm the retain-all + soft-delete default vs the
   evidential need for erased content (ADR-005 / security-compliance-design.md open legal point).
5. **AI-assisted content placement** (PRD "auto-organises content"): in or out for M5? Recommend
   Phase 1 files to an explicit uploader-chosen RAG; AI classification (an OpenAI call) as a
   fast-follow.
6. **"Research using AI"** (org-side ungrounded search): recommend explicitly **out** of M5 — it
   risks UI confusion with grounded answers (rag-architecture §7).
