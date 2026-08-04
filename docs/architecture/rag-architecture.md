# AI / RAG Architecture End-to-End (Milestone 1, item 6)

**Status:** DRAFT PROPOSAL - describes the intended pipeline shape. Every stage below must be validated against Milestone 1 item 2(a) (the grounding spike on real client documents) before being treated as final; item 7 (the evaluation strategy) tests this pipeline, it doesn't design it.

This is the technical design behind behaviour already validated at the product/UX level in the prototype: a RAG only answers from its own approved content, cites what it used, and escalates to a human (as a keyword-flagged alert or a plain pending question) rather than guessing.

## Pipeline overview

```
 Upload            Ingestion              Index                Query-time
 ──────            ─────────              ─────                ──────────
 organisation  ─▶  validate & extract ─▶  chunk & embed  ─▶    hybrid retrieve
 drops a file      text (per file type)   write to per-tenant   (BM25 + kNN)
                    │                     OpenSearch index      │
                    ▼                     (ADR-002)             ▼
             AI content-placement                          re-rank top-N
             classification (which                              │
             RAG / section this                                 ▼
             belongs to, dedupe                          grounded answer
             check)                                      generation (ADR-001)
                                                                  │
                                                     ┌────────────┴────────────┐
                                                     ▼                         ▼
                                            sufficient grounding      insufficient grounding
                                            → answer + citations      → refuse + escalate
                                                                       (pending question /
                                                                        alert case if a
                                                                        keyword matched)
```

## 1. Ingestion

- Upload lands in S3 (per-tenant prefix), triggers an async ingestion job (not inline with the HTTP request - large PDFs must not block the UI).
- File-type validation and text extraction (PDF, DOCX, images via OCR where needed, plain text). Extraction failures surface back to the organisation as a clear error, not a silent drop.
- **AI-assisted content placement** (the PRD's "AI automatically organises content into the correct places" requirement): when a document is dropped without an explicit RAG target, or when it's ambiguous which section/category within a RAG it belongs to, an LLM classification call proposes a placement, which the organisation can accept or override in the UI - this keeps a human in the loop rather than silently auto-filing.
- Near-duplicate detection against existing documents in the same RAG (hash + embedding-similarity check) to flag likely re-uploads before they're chunked twice.

## 2. Chunking & embedding

- Semantic chunking (paragraph/heading-aware, not fixed-character-count) with overlap, tuned per document type - policy documents chunk differently to spreadsheets or flowcharts.
- Each chunk is embedded and written to the RAG's per-tenant OpenSearch index (ADR-002), carrying metadata: source document ID, **version** (ADR-005 depends on this), section/page, uploader, timestamp.
- On document update, new chunks are written under the new version; old-version chunks are retained (not deleted) so the audit ledger can reconstruct what was true at any point in time, per the brief's own versioning requirement.

## 3. Retrieval

- Hybrid retrieval: BM25 keyword search + kNN vector search over the same per-tenant index, combined via reciprocal rank fusion - this is why OpenSearch was chosen in ADR-002 rather than a vector-only store.
- Retrieval is always scoped to exactly one RAG's namespace. There is no cross-RAG or cross-tenant retrieval path, by construction, not by query-time filtering alone.

## 4. Re-ranking

- Top-N hybrid results pass through a cross-encoder re-ranking step (a small, separate model call) before being handed to the generation stage - this is the piece OpenSearch doesn't provide natively and needs its own service.

## 5. Grounding, citation, and refusal

- The generation call (ADR-001) is constrained to the re-ranked chunks only, with an explicit instruction to answer *only* from the provided content, cite which chunk(s)/source document(s) it used, and return a structured "insufficient grounding" signal rather than free-text hedging when the retrieved content doesn't cover the question.
- The refusal signal is a first-class, machine-readable output (not inferred by parsing the answer text), so the escalation path in step 6 is deterministic.

## 6. Escalation & keyword alerting

- On refusal (or retrieval confidence below a set threshold), the question is recorded as `pending` and surfaced to the organisation - already validated in the prototype's dashboard.
- **Keyword-triggered alerts run independently of the LLM path.** A deterministic keyword/regex scan against the raw incoming question text (against the RAG's configured `alert_keywords`) decides whether this becomes an `alert_case` routed to the assigned alert owner, regardless of whether the LLM would have grounded an answer. Safety-critical detection must not depend on model behaviour - this mirrors exactly what the prototype demonstrates functionally today.
- Both paths (plain escalation and keyword alert) write to the audit ledger (ADR-005).

## 7. Organisation-side "research using AI"

- A separate, lower-stakes flow: the organisation asks the LLM (with general web/knowledge access, not RAG-scoped) to help find material to add to a RAG. Output here is a *drafting aid*, explicitly not grounded or audit-ledgered the same way - the UI must not let this be confused with a RAG's own grounded answers.

## Evaluation hook (item 7)

Every stage above needs to be swappable/mockable independently so the evaluation harness (item 7: grounding/hallucination testing, citation-accuracy measurement, refusal red-teaming) can exercise the pipeline stage-by-stage, not just end-to-end. Recommend designing the retrieval and generation stages as separately-callable services from day one for exactly this reason.
