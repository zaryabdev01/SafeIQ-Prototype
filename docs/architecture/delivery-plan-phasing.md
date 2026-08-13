# Delivery Plan, Dependency Graph & Phasing (Milestone 1, item 12)

**Status:** DRAFT PROPOSAL — a sequencing and scope-split proposal, not a dated schedule. Real dates depend on spike outcomes and team capacity, neither confirmed yet.

## 1. Dependency graph

```
 Item 1                Item 2                 Item 3
 Requirements          Technical spikes       ADRs 001-005
 addendum              2a RAG grounding       (LLM, vector DB,
 (workshops with       2b widget mechanism    tenant isolation,
 client)               2c real-time media     real-time, ledger)
     │                 2d mobile/iOS               │
     │                      │                       │
     │        ┌─────────────┴──────────┐            │
     │        │                        │            │
     │        ▼                        ▼            ▼
     │   validates ADR-001        validates ADR-004  │
     │   (2a) & feeds item 7      (2c) & item 2b/2d   │
     │   (evaluation harness)     feeds mobile/widget │
     │        │                  delivery decision    │
     │        │                        │              │
     └────────┴───────────┬────────────┴──────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Item 4 Solution architecture & AWS   │◀── Item 9 cost model
        │  Item 5 Multi-tenant schema           │     (needs confirmed
        │  Item 6 RAG architecture              │      client scale from
        │  Item 8 Security & compliance design  │      item 1 workshops)
        └───────────────────┬───────────────────┘
                            │
                            ▼
                  Item 10 API specification
                            │
                            ▼
                  Item 11 Repos / Terraform /
                  environments / CI-CD / secrets
                            │
                            ▼
                  Item 13 Discovery pack +
                  design sign-off  ──────▶  BUILD STARTS
```

Items 4, 5, 6, 8 and 10 (architecture, schema, RAG design, security design, API spec) have already proceeded as detailed drafts ahead of items 1/2/9 landing — this was a deliberate choice to move discovery forward in parallel rather than serially, per the note in `README.md`. What they cannot do is reach `ACCEPTED` status until items 1, 2, and 9 resolve, because several of their central recommendations are explicitly conditional on those results (ADR-001 on spike 2a, ADR-002/003 on confirmed scale, ADR-004 on spike 2c).

## 2. Critical path

Three things genuinely block the start of build, everything else can and has proceeded in draft form ahead of them:

1. **Technical spikes (item 2).** Spike 2(a) (RAG grounding on real documents) and 2(c) (real-time media round-trip) each gate an ADR that the whole architecture depends on. Spikes 2(b)/2(d) (widget delivery mechanism, mobile/iOS feasibility) gate a scope decision (§4) more than an architecture decision, but are equally blocking for estimating that part of the work honestly.
2. **Confirmed client scale.** Blocks ADR-002 (vector DB cost-at-scale), ADR-003 (tenant isolation model), and the cost model (item 9) directly — see `cost-model.md` §6 for the exact numbers needed.
3. **Requirements addendum sign-off (item 1).** Blocks a *committed* fixed price full stop, independent of the engineering work above — several role/capability questions (Manager vs. Support, Super Admin vs. Administrator, SafeIQ Internal's real scope) are still open per `README.md`, and the ADR-005 blockchain-wording question specifically needs the client's explicit answer, not an engineering assumption.

Everything else on the milestone-1 list (schema, RAG architecture, security design, API spec, this plan) can be — and has been — drafted in parallel with the above, but final sign-off on all of it (item 13) cannot happen before these three resolve.

## 3. MVP vs. phase-2 split — recommendation

| Feature area | Recommendation | Why |
|---|---|---|
| **Safety/Emergency module** (real siren, real "notify police," lock-screen audio recording, real GPS-linked safe word) | **Phase 2**, gated behind legal review and spike 2(d) | `security-compliance-design.md` §6: this carries genuine legal exposure (recording consent, false-confidence risk in anything claiming to contact emergency services, iOS platform/App Store constraints) that cannot be resolved by engineering alone. The prototype demonstrates this as a clearly-labelled UI simulation deliberately for this reason. |
| **Literal blockchain ledger** (if the client insists on the brief's literal wording after the ADR-005 conversation) | **Phase 2**, re-costed and re-planned if chosen | ADR-005 recommends a hash-chained database ledger instead, for good technical reasons; a literal blockchain is a legitimate client choice but is heavier infrastructure that should be costed and scheduled deliberately, not folded into the phase-1 estimate by default. |
| **Mobile floating widget** (if spike 2(b)/2(d) shows materially higher risk/cost than the web/desktop delivery mechanism) | **Web-first for MVP**, mobile in phase 2 if the spike result warrants it | Avoids the fixed-price estimate absorbing an unresolved feasibility question (especially iOS lock-screen behaviour, which is as much a platform-policy question as a technical one). |
| **Cross-region disaster recovery** | **Phase 2** (single-region London with Multi-AZ for MVP) | Multi-AZ within eu-west-2 covers standard availability needs; cross-region DR is a real cost and complexity step up that should be an explicit client decision, not a default. |
| **Everything else in the current brief and prototype** (RAG creation/knowledge management, Alerts/Incidents, dashboards, chat/calls/screen-share on web, calendar, Internal account cross-org RAG assignment) | **Phase 1 / MVP** | Already validated at the UX level in the prototype; no open legal or platform-feasibility blocker of the kind the Safety module has. |

## 4. Suggested milestone structure

1. **Milestone 1 — Discovery (current).** This document and its companions. Ends with the discovery pack review below (item 13), not with build starting.
2. **Milestone 2 — Spikes, requirements addendum, ADR sign-off.** Runs the four spikes (item 2), the requirement workshops (item 1), and converts every `PROPOSED` ADR to `ACCEPTED` or revised. Produces the confirmed-scale numbers the cost model needs. **This milestone is what the fixed price for the rest of the project should be committed after, not before.**
3. **Milestone 3 — Environments & platform foundation.** Repos, Terraform, dev/staging/prod environments, secrets management, CI/CD, AI cost/token observability (item 11). Multi-tenant schema and control plane stood up.
4. **Milestone 4 — RAG pipeline & evaluation harness.** Ingestion, chunking, embeddings, hybrid retrieval, re-ranking, grounding/refusal, keyword alerting (`rag-architecture.md`), plus the evaluation harness (`rag-evaluation-strategy.md`) running against real content from spike 2(a).
5. **Milestone 5 — Real-time backbone.** Chat, calls, screen-share, live dashboard feeds (ADR-004), on whichever platform spike 2(c) validated.
6. **Milestone 6 — UAT & compliance sign-off.** Evaluation-harness thresholds met (`rag-evaluation-strategy.md` §6), DPIA and legal review complete (`security-compliance-design.md` §5), security review complete.
7. **Launch — Phase 1 scope only** (per §3 above).
8. **Phase 2** — Safety/Emergency module, mobile widget (if warranted), any deferred items, each with its own spike/legal review where flagged.

## 5. What's needed to accept this plan

- Client engagement on the requirement workshops (item 1) and access/permission to run the technical spikes (item 2), including sample real documents for spike 2(a) — likely needs an NDA or data-handling agreement to be in place first, since real client content is involved even at spike stage.
- Confirmed team capacity, which turns the milestone structure above into an actual dated schedule — deliberately not estimated here, since committing dates before the critical-path items (§2) resolve would be the same estimating-without-data problem this whole discovery phase exists to avoid.
