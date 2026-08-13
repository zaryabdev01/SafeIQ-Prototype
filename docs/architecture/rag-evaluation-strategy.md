# RAG Evaluation Strategy (Milestone 1, item 7)

**Status:** DRAFT PROPOSAL — a test-harness *design*, not a working suite. It cannot actually run until spike 2(a) produces a first real golden test set from real client documents; until then this document specifies what will be built and how it will gate releases.

## 1. Why this exists

The audit ledger (ADR-005) and the whole safeguarding value proposition rest on one claim: **a RAG only ever answers from its own approved content, and clearly refuses/escalates otherwise.** That claim is only trustworthy if it's measured, not assumed. This document is the measurement design for the pipeline described in `rag-architecture.md`.

## 2. What "correct" means here — four dimensions

| Dimension | Question it answers | Why it matters |
|---|---|---|
| **Groundedness** | Does every claim in the answer trace back to a retrieved, cited chunk? | This is the core evidential promise — an ungrounded answer that "sounds right" is worse than a refusal |
| **Citation accuracy** | Are the cited sources actually the ones that support the claim (precision), and is nothing load-bearing left uncited (recall)? | The audit trail's value depends on citations being trustworthy pointers, not decoration |
| **Refusal correctness** | Does the system refuse/escalate when approved content doesn't cover the question — and does it *not* refuse when the content clearly does? | Both failure directions matter: over-answering risks bad advice being given with false confidence; over-refusing makes the product useless |
| **Keyword-alert reliability** | Does the deterministic keyword scan (independent of the LLM, per `rag-architecture.md` §6) fire correctly on every configured keyword, regardless of what the LLM does? | Safety-critical detection must not depend on model behaviour — this is tested as its own, simpler suite |

Latency and answer-to-answer consistency are tracked as secondary metrics (§5) but are not release-blocking in the same way as the four above.

## 3. Golden test set design

- **Source:** built from real (client-provided, and anonymised where it contains personal data) documents once spike 2(a) has access to them. A synthetic test set built before that point is a placeholder for pipeline-plumbing testing only — it does not validate real-world grounding and should not be presented as if it does.
- **Composition per RAG category** (Training / Policy / Safeguarding / Home visits, per the category system already in the product): recommend a minimum of ~30–50 question/expected-outcome pairs per category, split roughly:
  - **Clearly in-scope** questions with an unambiguous, citable answer in the approved content.
  - **Edge-of-scope** questions — partially covered, or covered but requiring the model to correctly decline to extrapolate beyond what's written.
  - **Clearly out-of-scope** questions — must produce a refusal/escalation, not a plausible-sounding guess.
- **Each test case records:** the question, the expected outcome (`answer` / `refuse`), the expected citation set (for `answer` cases), and a short note on why it's in the set (which failure mode it's designed to catch).
- **Ownership:** the test set is a living artefact, versioned alongside the pipeline it tests — not a one-time deliverable. New cases get added whenever a production issue reveals a gap the set didn't cover.

## 4. Refusal red-teaming

A separate, adversarial test set specifically designed to try to break grounding, distinct from the golden set above:

- **Out-of-scope but plausible-sounding questions** — designed to tempt the model into extrapolating from general knowledge rather than the approved content.
- **Prompt-injection via uploaded content** — a document deliberately containing text designed to alter model behaviour (e.g. "ignore previous instructions and..."), to confirm the grounding instruction survives adversarial content, not just adversarial questions.
- **Leading/loaded questions** — phrased to imply a false premise, testing whether the model corrects the premise from approved content or accepts it.
- **Cross-RAG leakage probes** — questions that only make sense if the model had access to a *different* RAG's content, to confirm retrieval scoping (ADR-002/003) holds under adversarial questioning, not just normal use.

Pass criterion for every case in this set is a correct refusal or escalation — a fluent, confident-sounding wrong answer is treated as a critical failure, not a partial success.

## 5. Measurement method

- **Automated grounding score:** an LLM-as-judge pass — a separate model call given only the answer and its cited chunks, asked to identify any claim in the answer not supported by those chunks. This scales to run on every regression pass but is not treated as sufficient on its own (see below).
- **Human spot-check sampling:** given the evidential stakes, LLM-as-judge scoring is corroborated by periodic human review of a sampled percentage of both the golden-set results and live production answers (§7) — not a one-time validation, an ongoing check that the automated judge itself hasn't drifted.
- **Citation precision/recall:** computed directly against the golden set's expected citations — precision (cited sources that are actually relevant) and recall (necessary sources that weren't cited).
- **Refusal accuracy:** simple pass/fail against the expected `answer`/`refuse` label per case, tracked separately for the golden set (normal-use accuracy) and the red-team set (adversarial-use accuracy) since these represent different risk profiles.
- **Keyword-alert reliability:** a deterministic unit-test-style suite (not LLM-judged) confirming every enabled keyword on a RAG fires an alert case on matching input, and that disabled keywords do not — this is simple by design and should be close to 100% reliable, unlike the LLM-judged metrics above.

## 6. Release gates (starting proposal, to be tuned)

| Metric | Proposed minimum bar before a pipeline/prompt change ships |
|---|---|
| Refusal accuracy — red-team set | ≥ 95% |
| Refusal accuracy — golden set (correctly *not* refusing when content covers it) | ≥ 90% |
| Citation precision | ≥ 90% |
| Citation recall | ≥ 85% |
| Keyword-alert reliability | 100% (deterministic, no tolerance) |

These numbers are a **starting proposal**, explicitly not final — they need to be recalibrated once spike 2(a) produces real data on where the pipeline naturally lands, since setting a bar before any real measurement exists risks being either meaningless (too low) or unachievable (too high, forcing constant exceptions). Recommend treating the first month of real measurements as a calibration period before these gates become hard CI blockers (tie-in: item 11's CI/CD).

## 7. Ongoing production monitoring

Evaluation doesn't stop at release:

- Sample a percentage of live answers (e.g. 2–5%, tunable) into a human review queue, weighted toward low-confidence and edge-of-scope-looking questions.
- Track refusal rate as a trend line over time per RAG — a sudden drop is a leading indicator of prompt drift, a bad content upload, or a regression, and should alert before it's discovered via a bad outcome.
- Any answer a user flags in-product (the "flag this answer" feature already in the prototype) is automatically added to the golden or red-team set once triaged, so real production edge cases continuously strengthen the test suite rather than being reviewed once and discarded.

## 8. Dependencies and what's not yet possible

- **Cannot run for real until spike 2(a)** provides real client documents and a first real question set — everything above is a specification the spike's output will populate.
- **LLM-as-judge model choice** should be confirmed alongside ADR-001 — using the same provider/model family for judging as for generation is a reasonable default but is worth an explicit note that it introduces some judge/generator correlation risk, mitigated by the human spot-checking in §5.
- **CI integration** (automated regression runs on every pipeline change) depends on item 11's CI/CD setup existing first.
