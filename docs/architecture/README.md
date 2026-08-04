# Architecture Documents - Milestone 1 (Discovery)

Draft technical proposals for five of Milestone 1's thirteen items, written to move
discovery forward while the remaining items - the technical spikes (item 2), the
requirements addendum (item 1), the cost model (item 9), and the delivery-plan
refinement (item 12) - are still outstanding.

**None of this is signed off.** Every document below is marked `PROPOSED` or
`DRAFT` and states explicitly what would need to be true to accept it. Nothing
here should be quoted to the client as a committed decision.

## What's here

| Item | Document | Depends on |
|---|---|---|
| 3 | [ADR-001: LLM provider](adr/0001-llm-provider.md) | Spike 2(a) |
| 3 | [ADR-002: Vector database](adr/0002-vector-database.md) | Item 9 (cost), region confirmation |
| 3 | [ADR-003: Tenant isolation model](adr/0003-tenant-isolation.md) | Confirmed client scale |
| 3 | [ADR-004: Real-time stack](adr/0004-realtime-stack.md) | Spike 2(c) |
| 3 | [ADR-005: Audit ledger technology](adr/0005-audit-ledger.md) | **Explicit client sign-off** - reinterprets "blockchain" in the brief |
| 5 | [Multi-tenant schema](multi-tenant-schema.md) | ADR-002, ADR-003 |
| 6 | [AI / RAG architecture](rag-architecture.md) | ADR-001, ADR-002; validated by item 7 |
| 8 | [Security & compliance design](security-compliance-design.md) | ADR-005; needs legal review (GDPR erasure flow, special-category data, safety-feature exposure) |
| 10 | [API specification](api-specification.md) + [OpenAPI skeleton](api-spec.openapi.yaml) | Multi-tenant schema |

## The one item that needs a client conversation, not just engineering sign-off

ADR-005 proposes replacing the brief's literal "blockchain" requirement with a
tamper-evident, hash-chained append-only ledger - which is what actually resolves
the GDPR-erasure conflict item 8 identifies, and a literal blockchain doesn't
solve that conflict any better. This is a legitimate technical substitution, but
it changes what the brief literally asked for. **Raise it explicitly in the
requirements addendum (item 1) rather than letting the client discover it later.**

## Still outstanding from Milestone 1

- **Item 1** - requirements addendum. The Monday-board thread resolved a real batch
  of concerns (team roles, alert workflow, dashboards, calendar, settings) but
  Manager-vs-Support capabilities, Super-Admin-vs-Administrator distinction, and
  the SafeIQ Internal account's real scope are still open. Not compiled into a
  signed document yet.
- **Item 2** - the technical spikes. Nothing here substitutes for actually testing
  RAG grounding on real client documents, proving out a floating-widget delivery
  mechanism, running a real-time media round trip, or getting a legal/technical
  read on iOS lock-screen recording. These are the highest-risk items on the list
  and the documents above all say so explicitly where they depend on spike results.
- **Item 7** - the RAG evaluation harness (grounding/hallucination testing,
  citation accuracy, refusal red-teaming) - tests the pipeline in
  `rag-architecture.md`, not designed here.
- **Item 9** - running cost model. Blocked on ADR-001/002 and confirmed client scale.
- **Item 11** - repos, Terraform, environments, CI/CD, secrets, cost observability.
  Not started for the product (the prototype's own repo/Netlify pipeline is
  unrelated demo scaffolding).
- **Item 12** - delivery plan, dependency graph, MVP vs. phase-2 split. One
  concrete input already exists: `security-compliance-design.md` §6 recommends
  the whole Safety feature set (siren, lock-screen recording, safe word) sit in
  phase 2, behind its own legal review and spike - consistent with the
  milestone's own suggested split.
- **Item 13** - the discovery pack + sign-off. Can't exist before the above do.
