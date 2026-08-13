# Solution Architecture & AWS Design (Milestone 1, item 4)

**Status:** DRAFT PROPOSAL. This document ties ADR-001 through ADR-005 together into one coherent system view and adds the AWS services those ADRs don't individually cover. It is not implementation-ready: the real-time media leg depends on spike 2(c), the LLM/embedding leg depends on spike 2(a), and one genuine gap is flagged below (identity & access management has no ADR yet — see §8).

## 1. Design principles

- **AWS-native, single-region (London, eu-west-2) for MVP.** Every service below is chosen to keep a single cloud vendor relationship and a single data-residency story, per the brief's "Data kept in UK for mvp - AWS." Where a service's exact regional availability is unconfirmed, that is called out explicitly rather than assumed.
- **Isolation by construction, not by query discipline.** Schema-per-tenant (ADR-003) and per-tenant vector namespaces (ADR-002) mean a cross-tenant data leak requires an infrastructure-level mistake, not just an application bug — appropriate given this data may become legal evidence.
- **One real-time backbone, two transports.** Text/event traffic (chat, live dashboard feeds) and interactive media (voice/video/screen-share) are architecturally one design (ADR-004), split into the transport each is actually suited for, not four bolted-on systems.
- **Every irreversible choice sits behind an ADR**, and every ADR is `PROPOSED`, not `ACCEPTED`, until its stated blocking condition (a spike, a cost figure, a client sign-off) is resolved. This document inherits that status from its inputs.

## 2. Logical architecture

```
                                   ┌─────────────────────────┐
                                   │   Route53 + CloudFront   │
                                   │      + AWS WAF/Shield    │
                                   └────────────┬─────────────┘
                                                │
                     ┌──────────────────────────┼──────────────────────────┐
                     │                          │                          │
              ┌──────▼──────┐          ┌────────▼────────┐        ┌────────▼────────┐
              │  API Gateway │          │  API Gateway /   │        │   Amazon Chime   │
              │    (REST)    │          │  AppSync (WS)     │        │       SDK        │
              │ core CRUD API│          │ chat + live feeds │        │ voice/video/share│
              └──────┬──────┘          └────────┬────────┘        └────────┬────────┘
                     │                          │                          │
                     └──────────────┬───────────┴──────────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   ECS Fargate      │   core API service, ingestion
                          │   application tier │   workers, AI orchestration
                          │                    │   service, notification service
                          └─────────┬─────────┘
                                    │
        ┌───────────────┬──────────┼──────────┬───────────────┬────────────────┐
        │               │          │          │               │                │
 ┌──────▼──────┐ ┌───────▼──────┐ ┌─▼──────┐ ┌─▼────────────┐ ┌─▼─────────────┐ ┌▼──────────────┐
 │   Aurora     │ │  OpenSearch  │ │   S3   │ │   Bedrock     │ │  audit_ledger  │ │  SQS/EventBridge│
 │  PostgreSQL  │ │  (per-tenant │ │(per-   │ │(Claude gen +  │ │ (hash-chained, │ │ (async ingestion│
 │schema-per-   │ │  vector +    │ │tenant  │ │ embeddings +  │ │  ADR-005;      │ │  job queue)     │
 │tenant,ADR-003│ │  hybrid,     │ │prefix) │ │ re-rank via   │ │  append-only)  │ │                 │
 │              │ │  ADR-002)    │ │        │ │ small model)  │ │                │ │                 │
 └──────────────┘ └──────────────┘ └────────┘ └───────────────┘ └────────────────┘ └────────────────┘

 Cross-cutting: KMS (encryption) · Secrets Manager · IAM · CloudWatch + X-Ray (incl. AI cost/token
 metrics) · CloudTrail · GuardDuty · Terraform (IaC) · CodePipeline/CI-CD
```

## 3. AWS service inventory

| Service | Role in this platform | Status |
|---|---|---|
| **Route53 + CloudFront + WAF/Shield** | DNS, edge caching for the static app, edge protection against common web attacks | Standard, no open questions |
| **API Gateway (REST)** | Core CRUD API surface — see `api-specification.md` | Standard |
| **API Gateway WebSocket API or AWS AppSync** | Chat messages + live dashboard/widget event feed (`question.created`, `alert.opened`, etc.) — one publish path, multiple subscribers | ADR-004, PROPOSED |
| **Amazon Chime SDK** | Voice call, video call, and screen-share media routing for direct and group conversations | ADR-004, PROPOSED — blocked on spike 2(c) and confirming UK/EU media-routing region |
| **ECS Fargate** | Application compute: core API service, async ingestion workers, the AI orchestration ("answer generation") service, notification service. Fargate over EC2 to avoid managing instances for a small platform team | Standard |
| **AWS Lambda** | Lightweight event-driven glue: S3-upload trigger → enqueue ingestion job; scheduled jobs for review-date reminders and login-history retention cleanup | Standard |
| **Amazon Aurora PostgreSQL** | Relational data, schema-per-tenant (ADR-003) plus the shared control-plane schema — see `multi-tenant-schema.md` | ADR-003, PROPOSED — blocked on confirmed client scale |
| **Amazon OpenSearch Service** | Hybrid (BM25 + k-NN) retrieval over per-tenant vector namespaces — see `rag-architecture.md` | ADR-002, PROPOSED — blocked on cost-at-scale (item 9) |
| **Amazon S3** | Document storage (per-tenant prefix), Terraform state, access logs, static asset hosting behind CloudFront | Standard |
| **Amazon Bedrock** | Hosts the LLM (Claude, ADR-001) for grounded answer generation, AI-assisted content placement, and the organisation's "research using AI" feature; also hosts the embedding model (Amazon Titan Embeddings, or a Bedrock-hosted alternative confirmed alongside ADR-002) | ADR-001, PROPOSED — blocked on spike 2(a) and confirming a London/UK-acceptable Bedrock region |
| **Re-ranking model** | A small cross-encoder re-ranking step over the top-N hybrid results, run as a lightweight Fargate/Lambda service (not a managed AWS product — see `rag-architecture.md` §4) | Design proposed, not vendor-selected |
| **audit_ledger (Aurora table) or Amazon QLDB** | Tamper-evident, hash-chained event log — see ADR-005 | ADR-005, PROPOSED — needs explicit client sign-off (reinterprets "blockchain" in the brief) |
| **Amazon SES** | Transactional email: magic-link invites, review-date reminders, password resets | Standard |
| **SQS / EventBridge** | Decouples document upload from the ingestion pipeline so large files never block the HTTP request; also carries scheduled/cron-style events | Standard |
| **KMS** | Encryption-at-rest keys for S3, Aurora, OpenSearch | Standard, satisfies the brief's "all data encrypted" requirement |
| **Secrets Manager + Systems Manager Parameter Store** | API keys, DB credentials, per-environment config | Standard |
| **IAM** | Least-privilege roles per service; a distinct role boundary for anything touching the audit ledger (insert-only, no update/delete, per ADR-005) | Standard |
| **CloudWatch + X-Ray** | Observability, including **AI cost/token metrics per tenant** (item 11) — this is what makes the cost-reduction levers in §7 actually enforceable rather than aspirational | Standard, scope defined here for the first time |
| **CloudTrail + GuardDuty** | AWS-account-level audit and threat detection — distinct from, and in addition to, the product's own `audit_ledger` | Standard |
| **Terraform + CodePipeline/CodeBuild (or GitHub Actions)** | Infrastructure-as-code and CI/CD, including automated per-tenant schema and OpenSearch-index provisioning on organisation sign-up (item 11) | Not started — see `README.md` outstanding items |
| **Amazon Cognito** *(recommended, not yet an ADR)* | Authentication/session issuance for the `/auth/*` endpoints in `api-specification.md`. Proposed shape: **one shared User Pool with a custom `org_id` attribute**, rather than a pool per tenant, to avoid provisioning sprawl as organisations are onboarded; session tokens carry the tenant claim that every downstream service uses to select the right Aurora schema and OpenSearch namespace | **Gap identified while writing this document** — none of the five existing ADRs cover identity/auth. Recommend adding **ADR-006: Identity & Access Management** before this is treated as decided |

## 4. Shared real-time backbone, expanded

Per item 4's explicit ask for "the shared real-time backbone... used by chat, calls, screen share and the live feeds," this is one design, not four:

- **Text and event transport** (chat messages, the dashboard's "live questions" panel, alert-opened/alert-message/alert-closed notifications, booking-created events) all flow through a single WebSocket/AppSync channel per `api-specification.md`'s `/realtime` endpoint. One publish path server-side, fanned out to however many subscribers (dashboard, widget, mobile later) are listening — no per-screen polling implementation.
- **Interactive media** (voice, video, screen-share, for both 1:1 and group conversations) is carried by Chime SDK, which handles the SFU/TURN relay problem that a self-hosted alternative (LiveKit/mediasoup + coturn) would otherwise put on this team's operational plate. Signalling (who's in a call, mute state) piggybacks on the same event channel above; only the media stream itself uses Chime's own transport.
- **Group calls** (per the group-chat feature already validated in the prototype) use Chime SDK's native multi-attendee session model directly — no bespoke fan-out logic needed on our side.

This design is explicitly **not final**: it is what spike 2(c) exists to validate. If Chime SDK cannot meet latency/quality/data-residency requirements in practice, the fallback is a self-hosted SFU inside the same VPC, which changes the operational-cost line in the cost model but not the logical shape of "one backbone, two transports" above.

## 5. A concrete request walkthrough

To make the diagram legible to a non-engineer reader, here is what actually happens when an employee asks a RAG a question through the floating widget:

1. Browser sends `POST /rags/{id}/ask` through CloudFront → WAF → API Gateway → the core API service on Fargate.
2. The API service authenticates the session (Cognito-issued token, carrying the tenant claim), confirms the RAG assignment and access code, and hands the question to the AI orchestration service.
3. The orchestration service embeds the question, runs hybrid retrieval against that RAG's OpenSearch namespace only (ADR-002), re-ranks the top results, and calls Bedrock/Claude (ADR-001) with the re-ranked chunks and a strict grounding instruction.
4. Claude returns either a grounded answer with citations, or a structured "insufficient grounding" signal.
5. In parallel, a deterministic keyword scan (independent of the LLM call, per `rag-architecture.md` §6) checks the raw question text against the RAG's configured alert keywords.
6. The result (answered / pending / escalated) is written to `rag_questions`, an `audit_ledger` entry is appended (hash-chained, ADR-005), and an event is published on the real-time channel so the organisation's dashboard and the employee's widget update without polling.
7. If a keyword matched, an `alert_case` is created and routed to the assigned alert owner regardless of what the LLM did in step 4 — safety detection does not depend on model behaviour.

## 6. Multi-tenant onboarding walkthrough

When a new organisation signs up: a control-plane `organisations` row is created; Terraform-driven automation (item 11) provisions a new Aurora schema (`tenant_<org_id>`) and a new OpenSearch index/collection, and creates the Cognito custom-attribute mapping for that tenant. This must be fully automated from day one — a manual per-tenant setup step does not scale past a handful of clients, and directly determines how cheaply the platform can onboard organisation #50 versus organisation #5.

## 7. AI services — cost-reduction discussion

This is the specific ask in the brief for milestone 1 item 4 ("discuss the things like how can we reduce the cost") applied to each AI-related service. Dollar figures are modelled separately in `cost-model.md`; this section is the *levers*, not the bill.

- **Amazon Bedrock (Claude) — model tiering.** Not every AI call needs the same model. Grounded answer generation (the evidential, client-facing output) justifies the larger/more capable Claude tier; cheaper, more deterministic tasks — AI-assisted content-placement classification, near-duplicate detection scoring, and any re-ranking-adjacent work — should run on a smaller, materially cheaper Claude tier. This alone is typically the single biggest lever on the AI bill, because classification/placement calls likely outnumber actual question-answering calls once organisations are actively uploading content.
- **Prompt caching.** Bedrock/Claude supports prompt caching for repeated system-prompt and retrieved-context content within a session — since the grounding instruction and retrieved chunks for a given RAG session are often reused across a short exchange, caching avoids paying full input-token price on every turn.
- **Embed once, not on every question.** Chunk embeddings are computed at ingestion time and stored (ADR-002); a question only costs one embedding call, not a re-embedding of the RAG's content. Combined with the version-aware chunking design in `rag-architecture.md` §2, unchanged content is never re-embedded on document update — only the new version's changed sections are.
- **Bounded re-ranking.** The re-ranking stage only processes a fixed top-N (e.g. 20) of the hybrid retrieval results, not the full candidate set, keeping that call small and cheap by construction.
- **Batch/async inference for non-interactive work.** Anything that doesn't need a live user waiting (nightly re-indexing, bulk re-embedding after a pipeline change) should use Bedrock's batch inference pricing tier rather than the real-time endpoint, where the two differ materially in cost.
- **OCR only when needed.** Text extraction (`rag-architecture.md` §1) attempts direct extraction first and only falls back to OCR for image-only content — OCR is the more expensive path and most uploaded policy/procedure documents won't need it.
- **Fargate Spot for ingestion workers.** The async ingestion queue (SQS-driven, not latency-sensitive to the end user) is a good fit for Fargate Spot pricing, which is materially cheaper than on-demand for interruptible batch-style work.
- **OpenSearch sizing matched to actual tenant volume.** Per-tenant index isolation (ADR-002) should not mean per-tenant over-provisioning — OpenSearch Serverless is worth evaluating for small/low-volume tenants versus a shared provisioned cluster for larger ones, with the crossover point quantified once real usage data exists (see `cost-model.md` §5).
- **Per-tenant usage observability and soft caps.** CloudWatch-based token/cost metrics broken out per tenant (§3 above) mean a single organisation's runaway usage is visible before it becomes a bill surprise, and a soft quota can throttle or flag it — this is an operational safety net as much as a cost control.
- **Chime SDK billed only for active media time.** Unlike a self-hosted SFU (which has a baseline running cost whether or not anyone is in a call), Chime SDK's per-attendee-minute billing means idle periods cost nothing — relevant given calls/screen-share are expected to be an occasional feature, not constant usage.

## 8. Open items this document surfaces

- **No ADR yet for identity & access management.** Recommend **ADR-006: Identity & Access Management**, proposing Amazon Cognito with a shared User Pool + tenant custom attribute, before this architecture can be treated as complete.
- **Bedrock and Chime SDK regional confirmation** — both ADR-001 and ADR-004 already flag this; it is repeated here because it is the single fact most likely to force a design change (fallback to a non-AWS LLM provider or a self-hosted media stack) if it doesn't resolve favourably.
- **Terraform/IaC scope (item 11)** is described here at the service level but not yet started as actual code — the prototype's own repository has no relationship to this design.

## 9. What would change this document

- Spike 2(a) or 2(c) results change ADR-001 or ADR-004's recommendation.
- Confirmed client scale (organisations at launch and at 12 months) changes the OpenSearch/Aurora sizing assumptions in §3 materially enough to justify a different tenant-isolation cost profile.
- ADR-005's blockchain-wording conversation with the client changes the audit-ledger technology.
