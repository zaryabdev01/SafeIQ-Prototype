# Security & Compliance Design (Milestone 1, item 8)

**Status:** DRAFT PROPOSAL. The GDPR-erasure/audit-ledger resolution below should be reviewed by legal counsel before sign-off, given its evidential purpose. The safety-feature section flags items that need legal review before any phase-1 commitment.

## 1. Data residency & encryption

- Primary hosting: AWS London (eu-west-2), per the brief's "Data kept in UK for mvp - AWS."
- Any managed service that cannot be confirmed as London-hosted (see ADR-001's Bedrock-region question and ADR-004's Chime SDK question) is an open item that must be resolved, not assumed, before this section can be signed off.
- Encryption at rest via KMS-managed keys for S3, RDS/Aurora, and OpenSearch; TLS 1.2+ for all data in transit. This satisfies the brief's "all data encrypted so if leaks can't be read."

## 2. Tenant isolation

See ADR-003. Schema-per-tenant relational isolation plus per-tenant vector-store namespace isolation (ADR-002). No query path may span tenant schemas except the control-plane registry itself.

## 3. GDPR erasure vs. immutable audit trail

This is the specific conflict item 8 calls out, and ADR-005 proposes the resolution:

- The audit ledger (`audit_ledger` table, see `multi-tenant-schema.md`) never stores personal data or document content directly - only a hash, version number, timestamp, event type, and owner reference.
- The actual content that could be personal data (documents, chat messages, question text) lives in ordinary, erasable storage (S3, Postgres tables), referenced from the ledger by hash.
- **On a verified GDPR erasure request:** the referenced content is deleted or irreversibly anonymised in its normal storage location. The ledger entry remains, unchanged - it continues to prove that *an event of a given type occurred, at a given time, involving a given (now-erased) subject* without retaining readable personal data. The entry_hash chain (ADR-005) is unaffected because it never depended on the erasable content itself, only its hash.
- **Flag for legal review, not just engineering sign-off:** confirm this construction actually satisfies the organisation's evidential need ("prove the employee was given correct advice") *after* an erasure has occurred - i.e. can a hash-referenced, now-deleted document still support that claim in practice, or does the organisation need a retention-vs-erasure carve-out (e.g. a lawful-basis "legitimate interest / legal claims" retention period) negotiated with data subjects up front. This is a legal question, not a database design question, and should not be assumed away.

## 4. Authentication & access control

- Standard KYC at sign-up for both Organisation and Employee accounts, per the brief.
- Two-factor authentication and IP allow-listing, per-account opt-in (already validated at the UX level in the prototype).
- Role hierarchy, as clarified with the client:
  - **Super Admin** - the organisation's original sign-up account; full control.
  - **Administrator** - a promoted team member with full org-console access (create/allocate RAGs, invite people, promote others).
  - **Manager / Support** - team members eligible to be assigned as an alert owner; no distinct capability beyond that has been defined yet (flagged as an open item in the requirements addendum).
  - **Employee** - base team-member access: their own assigned RAGs, their own alerts, the floating agent.
  - **SafeIQ Internal** - a control-plane-level account (not a tenant role) with cross-tenant read access to RAGs and alert cases, for platform support. Its own access must be logged to a control-plane audit trail, separate from any tenant's ledger, since it touches multiple tenants.
- All administrative actions (role changes, RAG creation, document changes, alert-case closure) write an audit-ledger entry with the acting user's ID.

## 5. Regulatory posture

- UK GDPR and the Data Protection Act 2018 apply; AWS London hosting supports but does not by itself satisfy this - a DPIA (Data Protection Impact Assessment) is very likely required given the nature of the data.
- **Special-category data flag:** safeguarding disclosures and health-adjacent content (e.g. "Client Care Plans") are highly likely to constitute special-category data under UK GDPR Article 9. This raises the compliance bar materially (explicit conditions for processing, stricter access controls, breach-notification implications) and should be confirmed with legal counsel and reflected in the DPIA before launch - this is not resolved by the technical design above.

## 6. Safety-feature legal exposure (cross-reference: Milestone 1 items 2(d) and 12)

The lock-screen audio recording feature and the "sound an alert and notify police" siren feature (both demonstrated as clearly-labelled UI simulations in the prototype, deliberately not wired to anything real) carry genuine legal exposure that a technical design alone cannot resolve:

- Recording consent/wiretap-style rules vary by jurisdiction and can apply even to an employer-provided device.
- Any feature that purports to contact emergency services needs to be built (if at all) in a way that cannot create false confidence - a "police have been notified" message must be backed by something that actually works, every time, or it must not exist.
- iOS platform constraints on background audio/screen recording, and App Store policy risk, need dedicated legal and platform-engineering review (item 2(d)) before any commitment.

**Recommendation:** treat this whole feature set as phase-2, gated behind its own legal review and technical spike, consistent with item 12's own suggested MVP/phase-2 split. Do not include it in the phase-1 fixed-price scope.
