# Running Cost Model (Milestone 1, item 9)

**Status:** DRAFT PROPOSAL, illustrative. This is a parametrized model, not a final number — it is explicitly blocked on confirmed client scale (see §6) and on ADR-001/ADR-002 moving from `PROPOSED` to `ACCEPTED`. Unit prices below are indicative AWS list-price ranges for planning purposes and **must be re-validated against current AWS eu-west-2 (or nearest confirmed region) pricing before being used in a fixed-price commitment.**

## 1. Purpose

The fixed price for this project needs a defensible running-cost floor underneath it. This document builds that floor from the architecture in `solution-architecture-aws-design.md`, parametrized so it can be recalculated the moment the client confirms real scale — rather than guessing a single number now and being wrong in either direction.

## 2. Cost drivers

| Driver | What it affects |
|---|---|
| Number of organisations (tenants) | Aurora schema count, OpenSearch index/collection count, baseline per-tenant overhead |
| Employees per organisation | Auth/session volume, dashboard/API request volume |
| RAGs per organisation | OpenSearch index sizing, document volume |
| Documents & pages per RAG | Ingestion cost (extraction/OCR), embedding cost, storage volume |
| Questions per day per organisation | LLM generation cost (the largest single variable line) |
| Content-placement / classification calls per day | Smaller-model Bedrock cost (§4 of the architecture doc's model-tiering lever) |
| Real-time minutes per month (calls + screen-share) | Chime SDK cost |
| Document retention period (for audit purposes) | S3 storage volume, including old versions kept for the ledger |

## 3. Indicative unit costs (eu-west-2 / nearest confirmed region, to be re-validated)

| Item | Indicative unit cost | Notes |
|---|---|---|
| Claude (larger tier, grounded generation) via Bedrock | ~$3–15 / million input tokens, ~$15–75 / million output tokens (varies by exact model tier) | Confirm exact model/tier once ADR-001 is accepted |
| Claude (smaller tier, classification/placement) via Bedrock | ~$0.25–1 / million input tokens, ~$1–5 / million output tokens | Used for the model-tiering cost lever |
| Titan/Bedrock embeddings | ~$0.02–0.10 / million tokens | One-time per chunk/version, not per question |
| Amazon OpenSearch Service | ~$0.10–0.35 / OCU-hour (Serverless) or standard instance-hour pricing for provisioned | Crossover point between Serverless and provisioned needs real volume data (§5) |
| Amazon Aurora PostgreSQL | ~$0.06–0.12 / ACU-hour (Serverless v2), or standard instance pricing | Schema-per-tenant does not multiply this cost — one cluster, many schemas |
| Amazon S3 (Standard) | ~$0.023 / GB-month | Falls materially once lifecycle-tiered to IA/Glacier for old versions (§5) |
| ECS Fargate | ~$0.04 / vCPU-hour, ~$0.004 / GB-hour | Application tier + ingestion workers; Spot pricing materially lower for ingestion |
| Amazon Chime SDK | ~$0.0017–0.004 / attendee-minute (audio/video), similar order for screen-share | Billed only for active session time |
| Data transfer (egress) | ~$0.09 / GB after free tier | Mainly relevant for video/screen-share and document downloads |

*(These are planning-grade figures based on general AWS list pricing patterns, not a quote. AWS pricing pages and Bedrock's model pricing page for the confirmed region should be checked directly before this table is relied on for a contractual number.)*

## 4. Worked example tiers

These tiers are **illustrative scenarios**, not a prediction of the client's actual scale — they exist to show how the model behaves at different sizes so the shape of the cost curve (and where it's dominated by LLM generation versus infrastructure baseline) is visible ahead of the real numbers landing.

| Assumption | Small | Medium | Large |
|---|---|---|---|
| Organisations | 10 | 50 | 200 |
| RAGs (total) | 25 | 150 | 700 |
| Employees (total) | 150 | 1,500 | 8,000 |
| Questions / day (total) | 75 | 600 | 3,500 |
| Real-time minutes / month (total) | 500 | 4,000 | 25,000 |
| Documents ingested / month (total) | 50 | 400 | 2,000 |

**Approximate monthly cost by line (Small / Medium / Large), USD:**

| Line | Small | Medium | Large |
|---|---|---|---|
| LLM generation (grounded answers) | $40–120 | $300–900 | $1,800–5,000 |
| LLM classification/placement (smaller tier) | $5–15 | $30–90 | $150–400 |
| Embeddings (ingestion) | $2–10 | $15–50 | $80–250 |
| OpenSearch | $150–300 | $400–900 | $1,500–3,500 |
| Aurora PostgreSQL | $100–200 | $200–450 | $700–1,500 |
| S3 storage | $10–25 | $50–120 | $250–600 |
| Fargate (app + ingestion) | $150–300 | $350–700 | $1,000–2,200 |
| Chime SDK (real-time) | $1–4 | $10–30 | $60–170 |
| Misc. (WAF, CloudWatch, data transfer, SES) | $50–100 | $100–250 | $300–700 |
| **Approx. total / month** | **$510–1,075** | **$1,455–3,490** | **$5,840–14,320** |
| **Approx. per organisation / month** | **~$51–108** | **~$29–70** | **~$29–72** |

The wide ranges reflect genuine unknowns (exact model tier, real question volume, real document volume) — they will narrow substantially once the client confirms the numbers requested in §6, and once spike 2(a) gives a real tokens-per-question figure instead of an estimate.

**This is infrastructure running cost only.** It does not include: one-off build cost, ongoing support/SLA cost, or commercial margin — those are separate decisions layered on top of this floor.

## 5. Cost-reduction levers already designed in

These are described in full in `solution-architecture-aws-design.md` §7; summarised here against the lines they affect:

- **Model tiering** (small model for classification, large model only for final grounded answers) — reduces the LLM generation line, typically the largest lever available.
- **Prompt caching** — reduces LLM input-token cost on multi-turn sessions within the same RAG.
- **Embed-once, version-aware chunking** — keeps the embeddings line flat as content grows, since unchanged content is never re-embedded.
- **Fargate Spot for ingestion** — reduces the Fargate line for the non-latency-sensitive ingestion workers specifically.
- **S3 lifecycle tiering** — old document versions kept only for audit purposes move to Infrequent Access/Glacier, reducing the storage line without deleting anything the ledger needs to reference.
- **OpenSearch Serverless vs. provisioned crossover** — worth a direct comparison once real per-tenant volume is known; Serverless likely wins for the long tail of small organisations, provisioned likely wins once a tenant's volume is large and predictable.
- **Reserved Capacity / Savings Plans** — once usage is predictable (post-launch, not at MVP), Aurora and Fargate both support commitment-based discounts of roughly 20–40% over on-demand.
- **Per-tenant soft quotas** — caps the tail risk of one organisation's unexpectedly high usage inflating the whole bill unnoticed.

## 6. What's needed to finalise this model

This is the concrete ask that should come out of the requirements workshops (item 1):

1. Confirmed number of organisations expected at launch, and at 12 months.
2. Expected RAGs per organisation, and average documents/pages per RAG.
3. Expected questions per employee per day (even a rough estimate materially changes the LLM generation line, the model's largest variable).
4. Expected real-time (call/screen-share) usage — is this a daily-use feature or an occasional one?
5. Document retention expectations for the audit ledger (does old-version content need to stay in fast storage, or can it move to cold storage after N months?).

Once these are confirmed, this document should be re-run with real numbers rather than the Small/Medium/Large illustrative tiers above, and the unit prices in §3 re-validated against the live AWS price list for the confirmed region.
