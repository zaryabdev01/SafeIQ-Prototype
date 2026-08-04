# ADR-005: Audit Ledger Technology

**Status:** PROPOSED - not ready to accept. Needs explicit client sign-off, since it reinterprets a literal brief requirement (see Consequences).

## Context

The brief states: "the RAG data needs to sit in blockchain so their an audit of the data, who added it and a audit trail of its usage by any assigned users" - specifically so an organisation can prove an employee was given correct advice via the RAG if it's later sued or prosecuted. Milestone 1, item 8, separately identifies a conflict this creates: an immutable ledger is in direct tension with GDPR's right to erasure, and recommends resolving it as "hash, version, timestamp and owner on a tamper-evident append-only ledger; PII and full documents held off-ledger and erasable."

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Literal blockchain** (permissioned Hyperledger Fabric network, or hash-anchoring to a public chain) | Satisfies the brief's literal wording | Heavy, unusual infrastructure for a single-vendor SaaS audit trail; does not actually solve the GDPR-erasure conflict any better than a database ledger (a hash on a public/immutable chain still can't be un-published, and anchoring introduces its own retention questions); materially higher build and ops cost for no clear evidential benefit over the alternative below |
| **Application-level hash-chained append-only table** - each ledger row includes the previous row's hash (classic tamper-evident log construction), storing only hash + version + timestamp + owner + event-type per entry; the actual document content and any PII live in normal, erasable storage (S3/Postgres) and are only *referenced* from the ledger by hash | Directly implements item 8's own recommended resolution; tamper-evidence without blockchain's operational weight; erasure requests delete the underlying content while the ledger entry itself remains (proving *that* an event happened, without needing to retain the personal content that made it sensitive) | Requires careful implementation discipline (insert-only DB permissions, hash-chain verification tooling) to actually be tamper-evident, not just tamper-*labelled* |
| **Amazon QLDB** (managed, cryptographically verifiable ledger database) | AWS-native, purpose-built for exactly this pattern, removes the need to hand-roll hash-chaining | Narrower/niche AWS service - worth a due-diligence check on long-term product roadmap and support before committing a client-facing evidential system to it |

## Recommendation

An application-level hash-chained append-only ledger (or Amazon QLDB if due-diligence confirms it as a safe long-term choice), storing only `hash + version + timestamp + owner + event-type` per entry. All actual document content and personal data live in normal erasable storage, referenced from the ledger by hash rather than stored in it. This is item 8's own recommended shape, applied specifically to the RAG audit requirement.

## Consequences

- **This does not literally implement "blockchain" as the brief states it.** That substitution needs to be surfaced explicitly to the client as part of the requirements addendum (item 1) - not assumed - since "blockchain" may carry specific expectations (e.g. decentralisation, public verifiability) that a tamper-evident database ledger does not provide. Flag this as an open item requiring explicit sign-off, not a technical detail to quietly resolve.
- On a GDPR erasure request: the referenced content is deleted/anonymised; the ledger entry remains, proving an event occurred (e.g. "a document existed and was viewed by user X at time T") without resolving to readable personal content. This flow needs to be written up and reviewed as part of `security-compliance-design.md`, ideally with legal input given its evidential purpose.
- Every RAG document version (per the brief's own requirement: "if each RAG accepts documents if anything ever updated it logs the version") produces a ledger entry, tying this ADR directly to the document-versioning design in `rag-architecture.md`.

## What would change this decision

- The client, once shown this substitution, insists on a literal blockchain for contractual, marketing, or evidential-standard reasons - in which case the cost and delivery-risk implications need to be re-costed under item 9 and re-planned under item 12, likely pushing it to a phase-2 item.
