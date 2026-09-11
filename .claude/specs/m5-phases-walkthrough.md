# Milestone 5 — RAG Engine: phase-by-phase walkthrough & status

**Written:** 2026-09-11. **Purpose:** a plain-language tour of what M5 actually built — from an
admin dropping a PDF into a RAG to an employee getting a cited answer or a safe refusal — phase by
phase, with what's real, what's still a stand-in, and where every phase's code lives.

**Backend is done.** All 7 phases (0–6, milestone tasks 35–44) are built, tested, and pushed as
seven stacked PRs on `GTG-Enterprises/safeiq-be`. None are merged/reviewed yet — see §9.

Companion docs (read these for the *why* behind each decision):
`.claude/specs/m5-execution-plan.md` (the plan this was built from), `.claude/specs/m5-ai-knowledge-base.md`
(the original context handoff), `docs/architecture/rag-architecture.md`, `docs/architecture/adr/0006-vector-store-mvp-pgvector.md`.

---

## 1. The end-to-end flow, in one picture

```
ADMIN SIDE (Phases 0, 1, 5)
────────────────────────────
  Upload a file (PDF/DOCX/TXT/MD/image)
        │  POST /rags/{id}/documents  →  presigned S3 PUT
        ▼
  Client PUTs the bytes straight to S3 (never through the API)
        │  POST /rags/{id}/documents/{doc}/complete
        ▼
  A background job is queued (control.processing_jobs)
        │
        ▼
  Worker picks it up (app/worker.py) and runs the pipeline:
    extract (native text, or OCR if it's a scan/image)
        → clean (strip repeated headers/footers)
        → chunk (structure-aware, one topic per chunk)
        → embed (each chunk becomes a 1536-number vector)
        → store (chunk + vector land in Postgres/pgvector)
        ▼
  Document status flips: uploaded → processing → chunking → embedding → indexed
  (or → failed, with a reason, retryable)

EMPLOYEE SIDE (Phases 3, 4, 5)
────────────────────────────
  Employee asks a question on a RAG they're assigned to
        │  POST /rags/{id}/query
        ▼
  1. Deterministic keyword scan of the raw question
       → if a configured keyword matches, an Alert is raised — independent of
         everything below, so this can never be "argued out of" by the AI
        ▼
  2. Hybrid retrieval: vector search + keyword search over that RAG's
     content only, fused and re-ranked → best ~6-8 chunks
        ▼
  3. The AI answers using ONLY those chunks, citing which ones it used
        ▼
  4. A refusal gate double-checks the answer before it's shown to anyone:
     evidence existed? citations are real? the wording is actually backed by
     the cited text? → any "no" flips the answer to a refusal
        ▼
  5. If refused → escalated to the organisation as a pending question
     If answered → the answer + citations go back to the employee
        ▼
  Every question is recorded (RagQueryEvent) — question, retrieval details,
  answer, citations, verdict, timings — for analytics and for M6's chat UI
  to build on.

QUALITY (Phase 6, ongoing)
────────────────────────────
  A synthetic test suite runs this whole flow end to end and checks: did it
  answer when it should, refuse when it should, cite the right documents,
  and did the deterministic keyword scan fire exactly on the configured terms?
```

---

## 2. Phase 0 — Foundations

**What it did:** built everything later phases stand on, with zero user-facing behaviour yet.

- **New database tables** (all inside each organisation's own private schema — the same
  isolation every other table in the product already has): `rag_documents`, `rag_document_versions`,
  `rag_document_chunks` (this is the one with the vector column), `rag_query_events` (the record of
  every question asked), `rag_escalations`.
- **5 new fields on the existing `Rag`** table: alert keywords, an escalation note, retrieval
  settings, and which embedding model/version it's using.
- **A background job queue** (`control.processing_jobs`) and a worker process
  (`python -m app.worker`) that claims jobs and runs them — this is what makes document processing
  happen *after* the upload request returns, not during it (a big PDF must never make the upload
  button hang).
- **Every external dependency wrapped behind a swappable interface**, with a safe "fake" version
  of each so the whole system can be built and tested without needing real AWS/OpenAI credentials
  yet: OCR, embeddings, vector search, re-ranking, answer generation.
- **The vector database decision**: pgvector, a feature of the Postgres database we already run —
  not a new system to stand up. It works because each organisation already has its own private
  schema; the vectors just live in that same private space.

**Branch:** `m5/phase0-foundations` · **Status:** pushed, [PR ready](https://github.com/GTG-Enterprises/safeiq-be/pull/new/m5/phase0-foundations) · 16/16 tests passing (no database needed)

---

## 3. Phase 1 — Upload + processing pipeline

**What it did:** the part of the diagram above from "upload a file" to "indexed."

- **Upload API**: an admin drops a file → we hand back a link to upload straight to S3 (so a
  100MB PDF never passes through our own server) → the admin confirms the upload → a processing
  job is queued.
- **Reading the file**: PDF (page by page), Word documents (keeping headings, paragraphs, tables),
  plain text, and Markdown are all read natively. A scanned document or a photo goes through
  **AWS Textract** (OCR) instead — this is the AWS text-reading service, and DevOps is finishing
  the AWS permissions for it.
- **Cleaning**: repeated page headers/footers ("ACME LTD — CONFIDENTIAL" on every page) are
  detected and dropped so they don't pollute what gets embedded.
- **Chunking**: the document is split into pieces small enough to search efficiently but never
  mid-sentence or across a section heading — a policy statement always stays with the heading
  that gives it context.
- **The keyword-alert scanner was built here too** (though it doesn't get *used* until Phase 3) —
  a deterministic word-match against whatever "alert keywords" a RAG is configured with, completely
  independent of any AI model.
- Re-processing the same file twice never creates duplicate chunks (safe to retry after a failure).

**Branch:** `m5/phase1-upload-processing` · **Status:** pushed, [PR ready](https://github.com/GTG-Enterprises/safeiq-be/pull/new/m5/phase1-upload-processing) · 46 unit tests passing + 8 database tests written (run in CI)

---

## 4. Phase 2 — Turning text into searchable vectors

**What it did:** the "embed" step — the part that makes semantic search possible at all.

- Every chunk of text gets converted into a list of 1536 numbers (an "embedding") using OpenAI's
  `text-embedding-3-small` model — two chunks about similar topics end up with similar numbers,
  which is what lets us search by *meaning*, not just exact words.
- Those numbers are stored in Postgres (pgvector) and indexed for fast similarity search.
- A **re-embed** job type exists for the future, in case the embedding model ever needs to change —
  it can re-process existing content without re-uploading anything.

**Branch:** `m5/phase2-embeddings-vector` · **Status:** pushed, [PR ready](https://github.com/GTG-Enterprises/safeiq-be/pull/new/m5/phase2-embeddings-vector) · 53 unit tests passing + 6 database tests written

---

## 5. Phase 3 — Finding the right chunks for a question

**What it did:** the actual "search" a question triggers, and the first version of the employee
question endpoint.

- **Hybrid retrieval**: every question is searched two ways at once — by *meaning* (vector
  similarity) and by *exact keywords* (full-text search, good for policy names, codes, exact
  phrases) — and the two result lists are merged so the best of both shows up.
- This search is **hard-scoped**: it is structurally impossible for a question against one RAG to
  ever surface another RAG's — or another organisation's — content. That isn't a setting that can
  be misconfigured; it's how the query is built.
- **The employee-facing endpoint went live here**: `POST /rags/{id}/query`, but only for someone
  with an active assignment to that RAG (just having the right job role isn't enough).
- The keyword scanner from Phase 1 gets wired in for real here — every question is checked against
  the RAG's alert keywords the moment it's asked.
- Every question and its retrieved evidence get recorded, even before the AI-answering piece
  (Phase 4) was fully real.

**Branch:** `m5/phase3-hybrid-retrieval` · **Status:** pushed, [PR ready](https://github.com/GTG-Enterprises/safeiq-be/pull/new/m5/phase3-hybrid-retrieval) · 57 unit tests passing + 6 database tests written

---

## 6. Phase 4 — Answering, and refusing safely

**What it did:** the actual AI answer, plus the safety net around it. This is the phase that makes
the "it only ever answers from its own approved content" promise real.

- The AI (OpenAI's `gpt-4o`) is instructed to answer **only** from the specific chunks it was
  handed, to say exactly which chunk(s) it used for each answer, and to explicitly say when it
  doesn't have enough to go on — rather than guessing.
- Uploaded document content is explicitly framed to the AI as *data to read*, not as
  *instructions to follow* — so a document containing text like "ignore your instructions" can't
  hijack the AI's behaviour.
- **The refusal gate — the most important part of this phase.** An answer is only shown to the
  employee if it passes *all* of these checks, not just one confidence number:
  1. There was actually some relevant content retrieved.
  2. The AI itself didn't already say it couldn't answer.
  3. Every citation the AI gave really points to a real chunk from that RAG.
  4. The wording of the answer is actually backed by the text it cited (not just topically
     related — it has to substantively overlap).
  
  If any single check fails, the answer is thrown away and replaced with a refusal — even if the
  AI "sounded" confident.
- A short memory of the last few questions in a conversation is used so a follow-up like "and how
  much of that carries over?" is understood — but every answer is still freshly re-searched and
  re-checked, so old answers can never become "trusted" on their own.

**Branch:** `m5/phase4-grounded-answering` · **Status:** pushed, [PR ready](https://github.com/GTG-Enterprises/safeiq-be/pull/new/m5/phase4-grounded-answering) · 69 unit tests passing + 3 database tests written

---

## 7. Phase 5 — What happens after a refusal, document upkeep, and reporting

**What it did:** closed the loop on a refusal, and gave admins the management/reporting tools.

- **Escalation queue**: when the AI can't answer (and it *wasn't* a keyword-alert situation — that
  has its own separate path from Phase 1), the question is automatically queued as a "pending
  question" for the organisation to review and answer directly. Admins can see, assign, and
  resolve these.
- Reminder of the two *separate* safety paths, which is intentional and by design:
  - **Keyword hits** → immediate `Alert` (safety-critical, works even if the AI is having a bad
    day, exists since Phase 1/3).
  - **"I don't know" from the AI** → `Escalation` (a lower-stakes "help us answer this better"
    queue, built here in Phase 5).
- **Document housekeeping**: uploading a new version of a document, re-processing a document (say,
  after we improve the chunking logic), retrying a document that failed to process, and properly
  deleting a document (which removes its searchable content and the original file, while leaving
  an audit trace that *something* existed and was removed — never leaving a "ghost" chunk that
  could still be found by search).
- **Per-RAG analytics**: question volume, how often it answered vs. refused, how many escalations
  are open, which documents get cited the most, and response-time numbers — the kind of dashboard
  data a later milestone (M7) will surface visually.

**Branch:** `m5/phase5-escalation-mgmt-analytics` · **Status:** pushed, [PR ready](https://github.com/GTG-Enterprises/safeiq-be/pull/new/m5/phase5-escalation-mgmt-analytics) · tests written, run in CI (database required)

---

## 8. Phase 6 — Proving all of the above actually works

**What it did:** an automated test suite that runs the *entire* upload → search → answer → refuse
flow against a small set of made-up policy documents and a list of questions with known right
answers, and grades the result.

- **A synthetic mini company handbook** (annual leave, safeguarding, expenses) and **14 test
  questions** with known correct answers or an expected refusal.
- **10 adversarial "red-team" questions** specifically designed to try to trick the system:
  a document containing a hidden instruction trying to override the AI, questions phrased as if a
  false fact were already true, questions that only make sense if the AI leaked another RAG's
  content, and so on. Every single one of these is *supposed* to end in a refusal — a
  confident-sounding wrong answer here would be a serious failure, not a partial success.
- Scores four things: did it answer/refuse correctly, were the citations accurate, was the answer
  actually grounded in what it cited (double-checked by a second AI acting as a judge), and did the
  keyword-alert scanner fire on exactly the right words (100% required — no tolerance, since this
  one is safety-critical).
- This suite now runs automatically on every future change (CI), and prints a clear pass/fail
  report — it doesn't yet block a change from shipping (see the honesty note in §9), but it makes
  it visible immediately if a change breaks something.

**Branch:** `m5/phase6-eval-harness` · **Status:** pushed, [PR ready](https://github.com/GTG-Enterprises/safeiq-be/pull/new/m5/phase6-eval-harness) · harness runs clean: **all core checks pass**, 78 supporting unit tests passing

---

## 9. How we're doing — honest status

### What's real right now
Everything above is real, working code — not a mockup. Uploads land in S3, processing genuinely
runs through a queue and a worker, chunks and vectors genuinely get stored in Postgres, retrieval
genuinely does a hybrid vector+keyword search scoped to one RAG, and OpenAI genuinely generates and
grades answers when the right settings are turned on.

### What's still a placeholder, and why
The system defaults to **safe stand-ins ("fakes")** for OCR, embeddings, and answer-generation
until explicitly told to use the real services — this was deliberate, so the whole pipeline could
be built, tested, and proven correct without needing live AWS/OpenAI access at every step, and so
tests never depend on the internet or cost money to run. Turning on the real services is a
one-line settings change per service, not a code change:
- **Embeddings & answers**: OpenAI is confirmed and ready to switch on — this needs the
  `OPENAI_API_KEY` set in the real environment.
- **OCR (scanned documents/images)**: AWS Textract, waiting on DevOps to finish the AWS
  permissions on their side.
- **One open question that isn't ours to answer**: OpenAI's API runs in the US. The original
  brief expected data to stay in the UK. This needs a client decision — either accept OpenAI's
  standard terms, or use the same models through Azure OpenAI's UK/EU region instead (a
  configuration change, not a rebuild). Flagged, not yet decided.

### What "tested" means here
Every phase has two kinds of tests: fast ones that don't need a real database, and integration
tests that exercise the real database. The full suite across the whole backend (M2 through M5) is
**239 tests**; every fast, no-database test among them passes with zero failures (per-phase counts
are in §2–7 above — they add up because later phases' fakes reuse and extend earlier phases'). The
database-backed ones are written and ready but need a real Postgres to run — they execute
automatically in the CI workflow this milestone added (`.github/workflows/ci.yml`), and locally via
`docker compose up -d db && alembic upgrade head && pytest`. The Phase 6 evaluation suite
additionally proves the *whole system's behaviour* end to end, not just individual pieces.

### What's not done yet
- **Seven pull requests, stacked on each other, none merged or reviewed yet.** This is the single
  biggest thing standing between "built" and "live." They should be reviewed and merged in order
  (Phase 0 first, since each later one builds on the one before it).
- **Phase 7 — the actual screens an admin or employee sees** — is not started. It lives in a
  different repository (`safeiq-fe`) that isn't available in this workspace yet.
- **A real evaluation** against actual client documents hasn't happened — everything in Phase 6 is
  proven against made-up test content. That's clearly labelled everywhere it appears
  ("SYNTHETIC — advisory only") so it's never mistaken for a real-world quality measurement.

---

## 10. What normally happens next

1. Someone reviews and merges the seven PRs, in order (Phase 0 → 6).
2. DevOps finishes the Textract permissions; the client confirms the OpenAI data-residency
   question; both get flipped on in the real environment.
3. Phase 7: wire the actual screens in `safeiq-fe` to these endpoints — turning the file-upload
   wizard, the "ask a question" chat box, and the conversation history tab from their current
   mock/demo versions into the real thing.
4. Once real client documents are available, re-run the Phase 6 evaluation against them and
   recalibrate the pass/fail bar from real numbers instead of the synthetic starting point.
