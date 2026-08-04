# ADR-003: Tenant Isolation Model

**Status:** PROPOSED - not ready to accept. Blocked on confirmed client scale (number of organisations expected at launch and at 12 months).

## Context

The brief requires organisation accounts to be fully separate from one another, and the audit ledger (ADR-005) must be able to prove, per organisation, exactly what content and access existed at a point in time - this matters because the brief describes the data being used as evidence "if the organisation gets sued or prosecuted." Isolation has to hold at both the relational-data layer and the vector-store layer (ADR-002).

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Silo**: separate database (or RDS instance) per tenant | Strongest possible isolation; simplest to reason about for compliance and for clean tenant off-boarding | Migrations and ops multiply per tenant; higher baseline cost per small organisation |
| **Pool**: shared schema, tenant scoped by a `tenant_id` column + row-level security | Cheapest at scale; standard SaaS pattern | Isolation is enforced by application/policy logic, not physical separation - a query or RLS bug is a cross-tenant data leak, which is a serious risk given the safeguarding/legal-evidence purpose of this data |
| **Bridge**: schema-per-tenant on a shared Aurora Postgres cluster | Strong logical isolation without full silo cost; migrations run per-schema but infrastructure is shared | Needs disciplined, scripted per-schema migration tooling from day one, or it becomes an operational burden as organisations are onboarded |

## Recommendation

Schema-per-tenant (the bridge model) on a shared Aurora Postgres cluster, paired with the per-tenant OpenSearch index from ADR-002. This gives isolation at both the relational and vector layers without the cost profile of full silo hosting for what is expected to be a large number of small-to-medium organisations. A dedicated RDS instance per tenant is reserved as an enterprise upgrade path for a large single client, not the MVP default.

A small platform-level **control-plane schema** sits outside any tenant schema, holding the organisation registry (name, sector, schema name, provisioning status) and the SafeIQ-internal support account(s) described in the requirements addendum - these are cross-tenant by definition and cannot live inside a single tenant's schema. See `multi-tenant-schema.md`.

## Consequences

- Schema provisioning and migration must be fully automated (Terraform + a migration runner invoked on organisation sign-up) - a manual per-tenant setup step will not scale past a handful of clients.
- Row-level security can still be layered in as defense-in-depth even with schema-per-tenant isolation, at negligible extra cost.
- The SafeIQ-internal account's cross-tenant read access (item 5 in the requirements addendum) is a control-plane-level permission, not a per-tenant role - it must be modelled and audited separately from any organisation's own role hierarchy.

## What would change this decision

- Confirmed client scale is much larger than assumed (e.g. hundreds of large enterprise tenants) - at that scale, full silo may be justified for the largest tenants.
- Aurora Postgres schema-per-tenant migration tooling proves unworkable in practice during early implementation - would need to fall back to the pool model with RLS as defense-in-depth only.
