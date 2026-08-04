# ADR-001: LLM Provider

**Status:** PROPOSED - not ready to accept. Blocked on Milestone 1 item 2(a), the RAG grounding spike against real client documents.

## Context

The platform needs an LLM for three distinct jobs:

1. Generating RAG answers that are strictly grounded in an organisation's approved documents, with source citation, and a hard refusal/escalation path when the approved content doesn't cover the question (this is the behaviour the audit trail's evidential value depends on - see item 7 and the security design in `security-compliance-design.md`).
2. The "AI-assisted content placement" the PRD requires - classifying and filing dropped-in documents into the right place inside a RAG with minimal manual work.
3. The organisation-facing "research using AI" feature, used to find more material to add to a RAG.

Constraints that shape this decision:

- Data is contractually UK-only for MVP, hosted on AWS in London (see brief: "Data kept in UK for mvp - AWS"). The chosen provider's regional hosting and data-handling terms must support this without a bespoke DPA negotiation delaying delivery.
- No use of customer content for provider-side model training.
- Strong instruction-following for **refusal** behaviour - the model must reliably decline to answer rather than hallucinate when retrieval coverage is weak. This is a harder requirement than typical chatbot use cases.
- Structured output / tool-calling support, to return citations and a machine-readable "insufficient grounding" signal rather than relying on prompt-parsing.
- Predictable per-token pricing, since the running-cost model (item 9) needs a defensible per-question cost figure.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Anthropic Claude via AWS Bedrock** | Single-vendor story alongside the AWS-native architecture; Bedrock offers contractual no-training and regional data-handling commitments; Claude's instruction-following is well-suited to strict grounding/refusal prompting | Need to confirm Bedrock's Claude model availability in London specifically vs. nearest EU region (Ireland/Frankfurt) - open question |
| **OpenAI (Azure OpenAI or direct API)** | Widely adopted, mature function-calling/structured-output support | Direct OpenAI API is US-hosted by default; Azure OpenAI can offer EU regions but adds a second cloud vendor relationship alongside AWS |
| **Self-hosted open-source (Llama, Mistral) on SageMaker** | Full data control, no per-token vendor lock-in | Materially higher engineering/ops burden to reach the same refusal reliability; higher delivery risk inside a fixed-price project |

## Recommendation

Anthropic Claude via AWS Bedrock, in whichever EU region Bedrock supports closest to London (confirm exact region as part of the spike). Keeps a single cloud vendor relationship, fits the AWS-native London design, and Claude's grounding/refusal instruction-following is a good match for the evidential requirement the whole audit trail depends on.

## Consequences

- Model/provider choice should sit behind an internal abstraction (a thin "answer generation" service interface) so swapping providers later is a code-level change, not an architecture rewrite - this keeps the decision "irreversible" only at the vendor-contract level, not the codebase level.
- Embedding model choice (for the RAG pipeline, see `rag-architecture.md`) does not have to come from the same provider - to be confirmed once ADR-002 (vector database) is settled.

## What would change this decision

- Spike 2(a) shows unacceptable refusal reliability or citation accuracy on real client documents.
- Bedrock cannot offer a London (or client-acceptable EU) region for the required model.
- Commercial terms are materially worse than an alternative once actual client scale (item 9) is known.
