# M5 vector-store isolation & deletion semantics

**Status:** design note for Milestone 5, 2026-09-10. Companion to
[ADR-006](adr/0006-vector-store-mvp-pgvector.md) and
`.claude/specs/m5-execution-plan.md` §8.

## Isolation

Embeddings live in `rag_document_chunks.embedding` (`vector(1536)`), and
`rag_document_chunks` is a **tenant-schema table** — declared once against the
placeholder `tenant` schema and translated to `tenant_<org_id>` per request by
`schema_translate_map` (see `app/db/session.py`, ADR-003). Consequences:

- **Cross-tenant retrieval is structurally impossible**, not filter-enforced.
  A session bound to `tenant_a` cannot name `tenant_b.rag_document_chunks` in
  any statement — there is no `tenant_id` column and no query that could carry
  one.
- **Cross-RAG retrieval** is prevented within a tenant by a hard `WHERE
  rag_id = :rag` on every retrieval query (`rag_id` is denormalised onto the
  chunk row for exactly this). A similarity score never substitutes for that
  filter (`m5-execution-plan.md` §10).
- **Unassigned-RAG access** is gated at the API layer: the employee query
  endpoint resolves the caller's active `RagAssignment` rows and refuses any
  `rag_id` not among them, before retrieval runs.

`CREATE EXTENSION vector` installs into `public` (one per database). Tenant
sessions keep `public` on the search path, so the `vector` type resolves
unqualified inside every `tenant_<org_id>` schema. The extension is created in
`alembic/versions/0005_*` and again (idempotently) at the top of
`provision_tenant_schema`.

## Deletion semantics

Two distinct operations, deliberately different:

| Operation | What happens to chunks/vectors | Retrievable after? | Why |
|---|---|---|---|
| **Supersede** (a new document version is uploaded) | Old version's chunk rows are **kept**; `rag_document_versions.is_active` flips to `false` | No — retrieval filters `is_active = true` | The audit ledger must be able to reconstruct what a RAG knew at any past time (ADR-005, rag-architecture.md §2) |
| **Delete** (document removed, or GDPR erasure) | Chunk rows **hard-deleted** (`VectorStore.delete_by_version`), S3 objects deleted | No — the rows are gone | Erasure must actually erase; the ledger keeps only the content hash, which does not resolve to readable data |

The "deleted content is no longer retrievable" security test
(`m5-execution-plan.md` §10, test 5) exercises the second row: after a delete,
a query that would have matched returns nothing, i.e. no stale vector rows.

Retention policy for erasure vs. the organisation's evidential need (can a
hash-referenced-then-deleted document still support "we gave correct advice"?)
is an **open client question** (ADR-005, `security-compliance-design.md`).
Until it is answered the default is retain-all + soft-delete; hard delete is
wired but only invoked on an explicit delete/erasure request.
