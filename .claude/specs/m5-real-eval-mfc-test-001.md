# M5 — first real-document grounding evaluation (RAG-MFC-TEST-001)

**Run:** 2026-09-11, updated same day after a fix. **What this is:** the client provided a real
test document + a question/answer key (`evaluation_docs/`) — this is the "spike 2a" real-content
grounding validation `.claude/specs/m5-execution-plan.md` §2 #4 flagged as the single biggest thing
missing from the Phase 6 evaluation harness (that harness runs against a synthetic corpus we wrote
ourselves; this is the first run against content we didn't write). **Headline: the real pipeline
ran end to end against real content for the first time, found two real bugs in itself (one
extraction bug, one ranking bug), both got fixed same-day, and the document is now a permanent
regression fixture — final score after the fixes: 5/5 real questions correct, 0 hallucinations.**

**Update:** after §5's root-cause was found, `LlmReranker` was implemented and the run was
repeated. Q3 now passes. See §5a. The document (not the answer key) is now committed as
`eval/real_documents/mfc_test_001.py` + `eval/datasets/real/mfc_test_001/source.docx`, graded on
every future `python -m scripts.run_eval` run — see §8.

## 1. What was provided, and what it's designed to test

- `VTH_RAG_Test_Document_Missing_from_Care.docx` — a fictional children's-home "missing from care"
  procedure (`RAG-MFC-TEST-001`), 17 text sections **plus three screenshots pasted directly into
  the Word document** (an on-call escalation matrix, an incident-record form, a return/follow-up
  dashboard) whose exact figures and codes exist **only** in the images, not in the surrounding
  text — a deliberate OCR test.
- `VTH_RAG_Test_Questions_and_Answer_Key.docx` — 5 questions with expected answers, expected
  sources, and a scoring rubric (Pass / Strong pass / Fail / Critical fail), explicitly marked
  **"DO NOT UPLOAD THIS FILE INTO THE KNOWLEDGE BASE."** It wasn't — only the source document was
  ever read by the pipeline; the answer key was used solely by me, afterwards, to grade the output.

## 2. A real bug this surfaced, fixed before running the eval

Our DOCX extraction (`app/services/rag/extraction.py`, written in Phase 1) only ever read
`document.paragraphs` and `document.tables`. **An image pasted directly into a Word page — exactly
what this test document does three times — was silently dropped.** Nothing failed; the content
just never became searchable, with no error to say so. This wasn't specific to the test document;
it would happen to any real client document with an inline screenshot.

Fixed on branch `m5/fix-docx-embedded-images` (pushed, PR open) before running this evaluation:
`OcrProvider` gained a `extract_text_from_bytes` method (Textract's inline-`Bytes` API path, for
image content that isn't its own S3 object), and DOCX extraction now walks each paragraph's XML for
an embedded picture, OCRs it, and attaches the result under that paragraph's nearest heading — so
an embedded screenshot now cites exactly like a native paragraph would.

## 3. What was real in this run, and what was a stand-in

| Piece | Status |
|---|---|
| DOCX text + embedded-image extraction, cleaning, structure-aware chunking | **Real** — the exact Phase 1 code, post-fix |
| Embeddings | **Real** — OpenAI `text-embedding-3-small`, live API call |
| Hybrid retrieval (vector + keyword, RRF fusion) | **Real** — the exact Phase 3 code |
| Answer generation | **Real** — OpenAI `gpt-4o`, live API call, the exact Phase 4 prompt |
| The multi-check refusal gate | **Real** — the exact Phase 4 `evaluate_grounding` code |
| OCR for the 3 embedded screenshots | **Stand-in.** Real AWS Textract isn't wired up in this environment yet (DevOps still finishing the IAM role). Each screenshot's exact text was transcribed by reading the images directly and served back through the same `OcrProvider` interface Textract will eventually implement — so the *pipeline* code path being tested is real, only the OCR *backend* is substituted. This should be re-run against real Textract once it's live, to confirm OCR accuracy on the actual images (handwriting-free, clean UI screenshots — low risk, but unverified). |
| Vector store | **Stand-in.** In-memory (`FakeVectorStore`) rather than pgvector, because no Postgres is reachable from this environment (same constraint noted throughout M5 development). The retrieval *logic* (hybrid fusion, scoping, ranking) is identical Phase 3 code either way; only the storage engine differs. |

Nothing here was mocked in the sense of "faked to look good" — every number below is a real model
output, graded honestly against the client's own rubric, including the one it got wrong.

## 4. Results, graded against the client's rubric

| # | What it tests | Verdict | Notes |
|---|---|---|---|
| **Q1** | Text retrieval + synthesising across several sections | **Pass** | Correctly explains the risk escalation and lists 5 of the ~7 expected immediate actions (dynamic risk assessment, notify police, notify management, start the missing-from-care record, share material changes). Missed two minor items (explicitly "attempt safe contact without threatening language"; "only safe/proportionate checks"). No invented content. |
| **Q2** | OCR-only precision (figures that exist *only* inside Screenshot A) | **Strong pass** | All four required facts exact: **On-Call Manager**, **10-minute** window, code **MFC-ESC-02**, and correctly flags **MFC-ESC-01 as retired**. This is the single most important result in this run — it's direct proof the embedded-image OCR fix works end to end, not just in a unit test. |
| **Q3** | Combining text + *two* screenshots (A and B) in one answer | **Fail** | Part (a) (what to report) was answered well. Parts (b) and (c) — the Screenshot A escalation specifics and the Screenshot B incident-record/validation rule — were missing entirely. Root cause identified below: this was a retrieval-ranking miss, not a hallucination or an extraction miss. |
| **Q4** | Scenario reasoning + Screenshot C's four follow-up targets | **Strong pass** | Got all four image-only targets exactly right (60 min / 24 hr / 72 hr / next-activity-or-24hr) and correctly recognised the "second episode in 6 days → manager strategy review" trigger rule. |
| **Q5** | Grounded refusal (medication-fridge question the document explicitly excludes) | **Pass (behaviour)**, with a product note | Correctly refused rather than inventing a temperature — no hallucination, which is what actually matters here. But the API currently returns a bare `answer: null` on refusal rather than a stated message like the client's own expected answer ("state that this isn't in the supplied document"). That's a UI/prompt polish gap, not a grounding failure — see §6. |

**Original scoreline: 2 strong pass, 2 pass, 1 fail — 0 critical fails.** No hallucinated fact
anywhere in five answers, including the one designed specifically to invite one (Q5) and the one
that got a sub-part wrong (Q3 never invented Screenshot A/B content — it just didn't produce it).

**After the fix in §5a: 3 strong pass (Q2, Q3, Q4), 2 pass (Q1, Q5) — 5/5, 0 fails.**

## 5. Root cause of the one failure (Q3) — and it's a good failure to have found

Re-running retrieval for Q3 alone and printing the ranked candidates: **the correct Screenshot A
and Screenshot B chunks were retrieved** (the pgvector/FTS scoping and chunking are working) **but
ranked 12th and 10th out of 30** — outside the `top_k=8` window handed to the generator. Raising
`top_k` to 14 for the same query surfaces both immediately.

This is exactly the gap Phase 3 flagged honestly rather than hid: it shipped a **passthrough**
re-ranker (`PassthroughReranker`), with a real re-ranker explicitly called out as a fast-follow in
`m5-execution-plan.md` Phase 3. A long, multi-part, narrative-heavy question (Q3 describes a whole
scenario before asking three sub-questions) embeds closer to other narrative chunks than to the
short, dense, form-field-style chunks the screenshots produce — so they lose the ranking race even
though they were correctly retrieved as candidates.

**Concrete next steps, in order of effort — (2) was implemented and confirmed, see §5a:**
1. Cheapest: raise the default retrieval `top_k` a bit for compound questions (or just in general,
   given this document is small — cost/latency tradeoff to weigh at real scale). Not done - (2) was
   the more durable fix and was cheap enough to just do.
2. **Done.** Real re-ranker (Phase 3's own flagged follow-up, `app/services/rag/reranker.py`
   `LlmReranker`, branch `m5/fix-llm-reranker`) — `gpt-4o-mini` judges relevance to the *whole*
   question directly, rather than by embedding proximity, so a short form-field-style chunk isn't
   penalised against long narrative chunks.
3. For genuinely compound questions ("describe (a), (b), and (c)"): query decomposition — retrieve
   per sub-question and merge — remains a further option if a bigger real golden set later shows
   the re-ranker alone isn't enough. Not needed for this result.

## 5a. Confirmed: the re-ranker fix closes the gap

Re-ran with `LlmReranker` (`gpt-4o-mini`) in place of `PassthroughReranker`, nothing else changed.
Q3 now cites all three required sources — `5.1 Information to provide when reporting`,
`8. Screenshot A - On-call escalation matrix`, `11. Screenshot B - Incident record form` — and its
answer correctly combines the reporting checklist, the On-Call Manager → Responsible Individual
escalation chain with response windows, and the incident-record validation rule (police reference
required, PENDING + 30-minute update if not yet available), without confusing the three sources.
One minor completeness note: part (b)'s answer didn't restate the `MFC-ESC-02` code by name even
though it cited the section containing it (Q2's answer, from the same source, does state it) — a
wording completeness nit, not a grounding error, and not disqualifying against the rubric's own
"Fail" bar ("misses a key required element, confuses similar details, or supplies information not
present"). Q1/Q2/Q4/Q5 were re-checked too and are unchanged. **Final: 5/5, 0 fails, 0 hallucinations.**

## 6. A product note from Q5 (not a grounding bug)

The refusal path is working correctly (`status=refused`, `insufficient_grounding=true`, no
citations) but the response the employee-facing API currently returns on refusal is `answer: null`
— the actual friendly "this isn't covered by the approved documents" message the client's own
expected answer shows is not yet generated or surfaced. Phase 4's grounding gate deliberately
discards the model's own text on a forced refusal (so a partially-hallucinated answer can never
leak through), which is correct, but it means **there is currently no canned refusal message for
the frontend to show**. Worth a small, cheap fix: a fixed, non-AI-generated refusal string (already
partly what the Escalation record's `reason` captures) — flag for Phase 7 (or a quick Phase 4/5
addendum) rather than something to fix inside this eval.

## 7. What this does and doesn't unblock

- **Unblocked:** "does the pipeline work at all against content nobody on this team wrote" — yes,
  demonstrably, on **5 of 5** real questions after the re-ranker fix, including the hardest
  pure-OCR one (Q2) and the hardest multi-source one (Q3). This is meaningfully different evidence
  than the synthetic Phase 6 harness, which only proves the plumbing is wired correctly, not that
  real documents ground correctly.
- **A genuinely useful side finding**: re-running the *synthetic* Phase 6 red-team set (unrelated
  to this document) with real `gpt-4o` + the new re-ranker scored `refusal_accuracy_redteam =
  0.900` against the §11 gate of `0.95` — one miss out of ten. At `n=10` that threshold effectively
  demands a perfect score; worth either growing the red-team set (so one miss doesn't swing the
  rate by 10 points) or revisiting the threshold once there's a larger sample, per
  `rag-evaluation-strategy.md` §6's own "calibration period" caveat. Not a regression — this is the
  first time that suite has run against a real model at all.
- **Not unblocked:** this is one document and five questions — nowhere near the ~30-50
  questions-per-category golden set `rag-evaluation-strategy.md` §3 calls for, and it's a
  purpose-built RAG test document, not organic client content (policies, real safeguarding
  procedures at natural length and messiness). Treat this as a strong first data point, not a
  release gate.
- **Still open:** real Textract accuracy on these specific images is unverified (a transcription
  stood in). Re-run once Textract is live (see §6 of the DevOps-readiness note this session also
  produced — the `rag_documents` S3 bucket + its Textract grant + a worker ECS service don't exist
  in Terraform yet, independent of the application code).

## 8. What was done with this (resolved)

The client clearly built this document to be a reusable test fixture (it's got a document ID,
`RAG-MFC-TEST-001`, and an explicit "End of test knowledge source" marker) — so, per the "fix then
commit" decision: the re-ranker gap was fixed and confirmed (§5a), and the document (never the
answer key) is now a permanent regression fixture:

- `eval/datasets/real/mfc_test_001/source.docx` — the source document only.
- `eval/real_documents/mfc_test_001.py` — the OCR stand-in (clearly commented as a stand-in for
  Textract) + the 5 cases, encoded as load-bearing-fact checks (e.g. Q2 requires the answer to
  contain "on-call manager", "10 minute", "mfc-esc-02", "mfc-esc-01", case/hyphenation-insensitive)
  rather than exact-string matching, so paraphrasing doesn't fail a genuinely correct answer.
- Cases are tiered like the synthetic harness: 4 are `plumbing` (meaningful even under
  `FakeEmbedder`/`FakeGenerator` — confirmed 4/4 pass under fakes, since word-overlap retrieval and
  echo-back generation genuinely prove the content is reachable and citable); the refusal case
  (Q5) is `llm`-tier and advisory-only under fakes (a naive word-overlap generator can false-
  positive an "answer" from an irrelevant boilerplate chunk in a way a real model doesn't -
  confirmed `gpt-4o` refuses it correctly both before and after the re-ranker change).
- `python -m scripts.run_eval` now runs this alongside the synthetic suite by default
  (`--no-real-doc` to skip); `--provider openai --gate` requires all 5 real cases to pass in
  addition to the synthetic gate.

Branch: `m5/real-document-eval-mfc` (stacked on `m5/fix-llm-reranker`, which stacks on
`m5/fix-docx-embedded-images`).
