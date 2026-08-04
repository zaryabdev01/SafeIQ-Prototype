# ADR-002: Vector Database

**Status:** PROPOSED - not ready to accept. Blocked on Milestone 1 item 9 (cost-at-scale validation) and confirmation of regional service availability.

## Context

Every organisation's RAG must be fully isolated from every other organisation's - the brief is explicit: "ensure all accounts are kept separate" and each RAG is described as an isolated system an organisation creates as many of as it wants. Retrieval needs to be hybrid (keyword + semantic, see item 6 and `rag-architecture.md`), and the whole stack must sit inside the AWS London-region design (item 4).

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Amazon OpenSearch Service (k-NN / vector engine)** | Native AWS, available in London; hybrid BM25 + vector search built in; natural per-tenant index/namespace model; one vendor relationship | Re-ranking (cross-encoder stage) isn't native - needs a thin service layered on top |
| **Pinecone** | Purpose-built vector DB with strong multi-tenant namespace primitives | External vendor outside AWS - needs its own data-residency/contractual review against the UK-only requirement; extra recurring cost line |
| **pgvector on Amazon RDS/Aurora Postgres** | Vector storage sits alongside relational data in one engine; simplest ops for a small team | Hybrid search and re-ranking are less mature than a dedicated search engine; scale-out story is weaker |

## Recommendation

Amazon OpenSearch Service, with one index (or serverless collection) per organisation for hard tenant isolation at the vector-store layer, paired with the schema-per-tenant relational isolation in ADR-003. This satisfies the hybrid-retrieval requirement in item 6 natively and keeps the whole data path inside AWS.

## Consequences

- Per-tenant index provisioning needs to be part of the organisation-onboarding automation (Terraform/IaC, item 11) - not a manual step.
- A re-ranking stage (cross-encoder over the top-N hybrid results) is a separate, small service in the RAG pipeline - see `rag-architecture.md`.
- Chunk-level metadata (source document ID, version, section, upload owner, timestamp) must be stored alongside each vector so citations in the grounded answer can point back to a specific, versioned source (ties to ADR-005's audit ledger).

## What would change this decision

- OpenSearch is confirmed unavailable (or has an unacceptable feature gap) in the actual region chosen for London/UK hosting.
- The cost model (item 9) shows per-tenant index overhead is materially worse at the client's confirmed organisation count than a shared-index-with-metadata-filtering approach.
