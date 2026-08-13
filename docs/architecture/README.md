# Architecture Documents - Milestone 1 (Discovery)

Draft technical proposals for ten of Milestone 1's thirteen items, written to move
discovery forward while the remaining items - the requirement workshops (item 1)
and the technical spikes (item 2) - are still outstanding. Those two cannot be
substituted with documents: they require real client engagement and real testing,
not more writing.

**None of this is signed off.** Every document below is marked `PROPOSED` or
`DRAFT` and states explicitly what would need to be true to accept it. Nothing
here should be quoted to the client as a committed decision.

**Client-facing pack:** [00-milestone-1-summary-for-client.md](00-milestone-1-summary-for-client.md)
is the cover note written for Neil - start there when assembling the docx pack.

## What's here

| Item | Document | Depends on |
|---|---|---|
| - | [Client summary / cover note](00-milestone-1-summary-for-client.md) | Everything below |
| 3 | [ADR-001: LLM provider](adr/0001-llm-provider.md) | Spike 2(a) |
| 3 | [ADR-002: Vector database](adr/0002-vector-database.md) | Item 9 (cost), region confirmation |
| 3 | [ADR-003: Tenant isolation model](adr/0003-tenant-isolation.md) | Confirmed client scale |
| 3 | [ADR-004: Real-time stack](adr/0004-realtime-stack.md) | Spike 2(c) |
| 3 | [ADR-005: Audit ledger technology](adr/0005-audit-ledger.md) | **Explicit client sign-off** - reinterprets "blockchain" in the brief |
| 4 | [Solution architecture & AWS design](solution-architecture-aws-design.md) | ADR-001 through 005; identifies a new gap (no IAM/ADR-006 yet) |
| 5 | [Multi-tenant schema](multi-tenant-schema.md) | ADR-002, ADR-003 |
| 6 | [AI / RAG architecture](rag-architecture.md) | ADR-001, ADR-002; validated by item 7 |
| 7 | [RAG evaluation strategy](rag-evaluation-strategy.md) | Spike 2(a) for a real golden test set; design-only until then |
| 8 | [Security & compliance design](security-compliance-design.md) | ADR-005; needs legal review (GDPR erasure flow, special-category data, safety-feature exposure) |
| 9 | [Cost model](cost-model.md) | ADR-001/002; illustrative tiers only until client scale is confirmed |
| 10 | [API specification](api-specification.md) + [OpenAPI skeleton](api-spec.openapi.yaml) | Multi-tenant schema |
| 12 | [Delivery plan & phasing](delivery-plan-phasing.md) | Items 1 and 2 for real dates; sequencing/MVP-split proposal stands without them |

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
  signed document yet. **Cannot be produced as a document** - needs the client
  workshops themselves; flagged as an explicit ask in the client summary note.
- **Item 2** - the technical spikes. Nothing here substitutes for actually testing
  RAG grounding on real client documents, proving out a floating-widget delivery
  mechanism, running a real-time media round trip, or getting a legal/technical
  read on iOS lock-screen recording. These are the highest-risk items on the list
  and the documents above all say so explicitly where they depend on spike results.
  **Cannot be produced as a document** - needs real testing against real client
  content.
- **Item 11** - repos, Terraform, environments, CI/CD, secrets, cost observability.
  Not started for the product (the prototype's own repo/Netlify pipeline is
  unrelated demo scaffolding). Service-level scope is now described in
  `solution-architecture-aws-design.md` §3, but no IaC exists yet - this is an
  engineering setup task, not a review document, and shouldn't be faked as one.
- **Item 13** - the discovery pack + sign-off. The pack itself (this README's
  table, docx-converted) is now assemblable; the **sign-off** still requires items
  1 and 2 to close first, per `delivery-plan-phasing.md` §2.
