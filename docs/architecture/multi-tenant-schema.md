# Multi-Tenant Database Schema & Isolation Strategy (Milestone 1, item 5)

**Status:** DRAFT PROPOSAL - first pass for engineering review, not implementation-ready. Depends on ADR-002 (vector database) and ADR-003 (tenant isolation model) being accepted.

This document proposes the relational schema and describes how it maps to the schema-per-tenant isolation model from ADR-003 and the per-tenant vector namespace from ADR-002. Field names carry over the vocabulary already validated against the client through the UX prototype (`src/lib/types.ts` in this repo) - that prototype is a single-tenant, in-memory sketch and is **not** a schema; this document redesigns it properly for isolation, versioning, and audit.

## Two tiers of data

1. **Control plane** (one shared schema, `control` - cross-tenant by nature): the organisation registry, and the SafeIQ-internal support account(s) that read across every tenant.
2. **Tenant schema** (one Postgres schema per organisation, e.g. `tenant_<org_id>`, provisioned automatically on sign-up per ADR-003): everything specific to one organisation - team members, RAGs, documents, questions, alerts, bookings, audit entries.

A tenant schema never references another tenant schema. Any cross-tenant view (the SafeIQ-internal overview) is composed at the application layer by iterating the control-plane registry, not by a cross-schema SQL join.

## Control-plane schema

```sql
create table control.organisations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  sector            text not null,
  tenant_schema     text not null unique,        -- e.g. 'tenant_8f3a...'
  kyc_verified_at   timestamptz,
  created_at        timestamptz not null default now()
);

create table control.internal_users (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text not null unique,
  two_factor_enabled boolean not null default true,
  created_at        timestamptz not null default now()
);
```

## Tenant schema (template, provisioned per organisation)

```sql
-- Team members. The organisation's own "Super Admin" account is the first
-- user row created at sign-up; team_role differentiates everyone else.
create type team_role as enum ('employee', 'manager', 'support', 'administrator');

create table users (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text not null unique,
  team_role           team_role not null default 'employee',
  job_title           text,
  country             text not null,
  language            text not null,
  two_factor_enabled  boolean not null default false,
  ip_lock_enabled     boolean not null default false,
  created_at          timestamptz not null default now()
);

create table invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  status        text not null check (status in ('pending', 'accepted', 'cancelled')),
  magic_link_token text not null unique,
  sent_at       timestamptz not null default now(),
  responded_at  timestamptz
);

-- One row per RAG. vector_namespace points at the corresponding
-- per-tenant OpenSearch index/collection from ADR-002.
create table rags (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  access_password_hash text not null,
  vector_namespace  text not null unique,
  created_by        uuid not null references users(id),
  created_at        timestamptz not null default now()
);

create table rag_documents (
  id            uuid primary key default gen_random_uuid(),
  rag_id        uuid not null references rags(id) on delete cascade,
  name          text not null,
  storage_key   text not null,       -- S3 object key for the current version
  current_version int not null default 1,
  added_by      uuid not null references users(id),
  created_at    timestamptz not null default now()
);

-- Every update creates a new version row rather than mutating the document -
-- this is what lets the audit ledger prove what content existed at time T.
create table document_versions (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references rag_documents(id) on delete cascade,
  version       int not null,
  storage_key   text not null,
  content_hash  text not null,
  uploaded_by   uuid not null references users(id),
  note          text,
  created_at    timestamptz not null default now(),
  unique (document_id, version)
);

-- Who can use which RAG, their unique access code, and who owns their alerts
-- on this specific RAG (per the client's clarified requirement).
create table rag_assignments (
  rag_id          uuid not null references rags(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  access_code     text not null unique,
  alert_owner_id  uuid references users(id),
  assigned_at     timestamptz not null default now(),
  primary key (rag_id, user_id)
);

create table alert_keywords (
  id         uuid primary key default gen_random_uuid(),
  rag_id     uuid not null references rags(id) on delete cascade,
  keyword    text not null,
  enabled    boolean not null default true
);

create type question_status as enum ('answered', 'pending', 'escalated');

create table rag_questions (
  id            uuid primary key default gen_random_uuid(),
  rag_id        uuid not null references rags(id),
  user_id       uuid not null references users(id),
  text          text not null,
  answer        text,
  status        question_status not null default 'pending',
  asked_at      timestamptz not null default now()
);

create type alert_case_status as enum ('open', 'closed');

create table alert_cases (
  id            uuid primary key default gen_random_uuid(),
  rag_id        uuid not null references rags(id),
  user_id       uuid not null references users(id),   -- the flagged person
  owner_id      uuid not null references users(id),   -- who recovers the alert
  keyword       text not null,
  question_id   uuid references rag_questions(id),
  status        alert_case_status not null default 'open',
  created_at    timestamptz not null default now(),
  closed_at     timestamptz,
  closed_by     uuid references users(id)
);

create table alert_case_messages (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references alert_cases(id) on delete cascade,
  sender_id     uuid not null references users(id),
  text          text not null,
  sent_at       timestamptz not null default now()
);

create table bookings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  with_user_id  uuid not null references users(id),
  starts_at     timestamptz not null,
  rag_id        uuid references rags(id),
  notes         text,
  google_event_id text                       -- set once Google Calendar sync (ADR pending) writes back
);

create table login_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  ip          inet not null,
  location    text,
  device      text,
  logged_in_at  timestamptz not null default now(),
  logged_out_at timestamptz
);

-- Append-only, hash-chained per ADR-005. Application must enforce insert-only
-- (revoke UPDATE/DELETE at the DB-role level) for this to be tamper-evident.
create table audit_ledger (
  id            bigint generated always as identity primary key,
  event_type    text not null,             -- e.g. 'document.version_created', 'rag.question_answered'
  subject_id    uuid not null,             -- the entity the event is about
  owner_id      uuid references users(id),
  content_hash  text not null,             -- hash of the referenced (erasable) content, not the content itself
  prev_hash     text not null,
  entry_hash    text not null,             -- hash(prev_hash || event_type || subject_id || content_hash || created_at)
  created_at    timestamptz not null default now()
);
```

## Open questions for engineering review

- `conversations` / `chat_messages` (peer-to-peer chat between assigned end users) are omitted above pending ADR-004 - their shape depends on whether chat history is replayed from the WebSocket/AppSync event log or persisted relationally in parallel; recommend deciding this alongside ADR-004, not before it.
- `rags.access_password_hash`: confirm hashing scheme (Argon2id recommended) as part of `security-compliance-design.md`.
- Whether `document_versions.storage_key` content should ever be hard-deleted (vs. tombstoned) needs to match the GDPR-erasure flow in `security-compliance-design.md` exactly.
