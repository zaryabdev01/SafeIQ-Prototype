# ADR-006: Vector store for MVP — pgvector on Aurora (supersedes ADR-002 for MVP)

**Status:** ACCEPTED (2026-09-10), for the MVP / Milestone 5. Supersedes the
recommendation in [ADR-002](0002-vector-database.md) for the MVP timeframe;
ADR-002's OpenSearch analysis stays on file as the scale-out option.

## Context

ADR-002 recommended Amazon OpenSearch Service (native hybrid BM25 + kNN,
per-tenant index). Since it was written:

- The platform is running on **Aurora PostgreSQL 15.15**, whose engine build
  ships **pgvector** as an available extension (`terraform/aurora.tf`).
- Milestone 5's scope and timeline (~3.5 weeks, 3 engineers) put a premium on
  not standing up and operating a second datastore, a second per-tenant
  provisioning path, and a second isolation story.
- The client has confirmed the LLM stack is OpenAI (`text-embedding-3-small`,
  1536-dim) — see `.claude/specs/m5-execution-plan.md` §1. 1536 dims sits
  inside pgvector's HNSW index limit (2000).

## Decision

Store embeddings in a `vector(1536)` column on `rag_document_chunks`, **inside
each tenant's Postgres schema**, indexed with HNSW (`vector_cosine_ops`).
Hybrid retrieval = pgvector kNN + Postgres full-text search (`tsvector` +
GIN), fused with Reciprocal Rank Fusion in application code. Re-ranking is a
separate interface (passthrough for MVP).

## Why this is not a weaker isolation story

The concern raised in `.claude/specs/m5-ai-knowledge-base.md` §3 was "a shared
pgvector table with a `tenant_id` filter column". **That is not what this is.**
`tenant_provisioning.py` already creates a dedicated Postgres schema per
organisation, and `rag_document_chunks` — vector column included — lives in
that schema like `users`, `rags`, and `alerts`. Cross-tenant retrieval is
prevented by schema isolation (ADR-003), not by a `WHERE tenant_id = ?`
clause. See `docs/architecture/m5-vector-isolation.md` for the full design.

## Consequences

- `CREATE EXTENSION vector` is database-scoped (objects land in `public`). Run
  once per database: in `alembic/versions/0005_*` and at the top of
  `provision_tenant_schema`. On Aurora the app migration role may lack CREATE
  privilege — DevOps installs it once with the RDS master user before deploy
  (`scripts/check_pgvector.py` reports readiness). `IF NOT EXISTS` keeps every
  other call a no-op.
- Postgres FTS is not true BM25. It is adequate for policy names / codes /
  exact terminology; if evaluation shows it is the weak link, revisit
  OpenSearch per ADR-002 (the retrieval layer is behind a `VectorStore` /
  retrieval interface precisely so that swap stays contained).
- No per-tenant index provisioning, no OpenSearch domain cost, no second
  vendor.
- Chunk-level metadata (document id, version, section, page) is stored on the
  same row as the vector, so citations point back to a specific versioned
  source (ADR-005).

## What would change this decision

- Retrieval quality on real client documents (spike 2a) is materially better
  with OpenSearch's hybrid search, and the gap matters for the evidential
  bar.
- Confirmed tenant/document scale pushes Aurora storage or HNSW build/query
  cost past what a single cluster should carry — at which point ADR-002's
  per-tenant OpenSearch index is the documented next step.
