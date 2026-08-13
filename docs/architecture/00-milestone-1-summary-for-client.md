# SafeIQ — Milestone 1 Discovery Pack — Summary for Neil

**Prepared as part of Milestone 1 (Discovery).** This note summarises the documents in this pack, what each one is confidently proposing versus still flagging as open, and exactly what we need from you to move from "proposed design" to a signed-off, fixed-price build.

## What's in this pack

Ten documents. If you only read one thing beyond this summary, this section is designed to stand in for the rest — each part below explains what that document actually decided or proposed, not just its title.

| # | Document | One line |
|---|---|---|
| 01 | Solution Architecture & AWS Design | Every AWS service we'll use, why, and how we keep the AI bill down |
| 02 | Cost Model | What this costs to run per month, at three example scales |
| 03 | RAG Design | How each RAG answers only from your approved content and cites its sources |
| 04 | RAG Evaluation Strategy | How we prove that claim is actually true, on an ongoing basis |
| 05 | API Specification | The interface the web app, widget, and future mobile app all call |
| 06 | Multi-Tenant Database Schema | How every organisation's data is kept physically separate from every other's |
| 07 | Security & Compliance Design | Encryption, access control, and the GDPR-vs-audit-trail resolution |
| 08 | Architecture Decision Records | The five irreversible technical choices, and why we'd make each one |
| 09 | Delivery Plan & Phasing | What ships first, what's phase 2, and what's genuinely blocking start of build |

### 01 — Solution Architecture & AWS Design

Everything runs on AWS, hosted in London, as a single region and a single vendor relationship — this satisfies the "data kept in UK" requirement without a second cloud contract to manage. In plain terms, the system has five moving parts:

- The **web app and floating widget** talk to a core API that handles logins, team management, RAGs, alerts, and the dashboard.
- Uploaded documents go through an **AI processing pipeline** that reads, classifies, and files them (with a human confirming the AI's suggestion, never silently auto-filing), then indexes them for search.
- Questions are answered by **Amazon Bedrock**, running Anthropic's Claude model — the same AI service handles the "which document does this belong to" classification and the organisation's "help me find material" research assistant.
- A dedicated **search engine (Amazon OpenSearch)** is what actually finds the right passage of text to answer a question from — combining keyword search and meaning-based search together.
- **Chat, voice calls, video calls, and screen-share** all run through one shared real-time system (built once, reused everywhere) rather than four separate bolted-together features — calls/video/screen-share via Amazon Chime, messages and live dashboard updates via a lightweight always-on connection.

Every organisation's data — team members, RAGs, documents, questions, alerts — sits in its own physically separate database compartment and its own separate search index. That's a structural guarantee, not a setting that could be misconfigured.

**On cost specifically** (the brief asked us to address this directly): the single biggest lever is not using the expensive AI model for everything — routine jobs like filing a new document use a small, cheap model, and the larger model is reserved for actually answering a question. On top of that: documents are only ever processed once (re-editing a document doesn't reprocess the whole thing, only what changed), repeated AI calls reuse cached context instead of paying full price every time, bulk/background jobs run on cheaper compute than live user-facing ones, and every organisation's AI usage is tracked individually so no single client's spend can quietly run away unnoticed.

One gap this document surfaces: we don't yet have a decision on file for *how users log in* (identity/session management) — we're recommending Amazon Cognito, but it needs its own sign-off alongside the other five decisions in document 08.

### 02 — Cost Model

The monthly AWS bill is driven mainly by: how many organisations sign up, how many RAGs each creates, how many questions get asked per day, and how much voice/video calling happens. Because we don't have your real numbers yet, this document models three illustrative scenarios instead of guessing one number:

| Scenario | Organisations | Questions/day | Approx. monthly AWS cost | Approx. per organisation |
|---|---|---|---|---|
| Small | 10 | ~75 | ~$510–1,075 | ~$51–108 |
| Medium | 50 | ~600 | ~$1,455–3,490 | ~$29–70 |
| Large | 200 | ~3,500 | ~$5,840–14,320 | ~$29–72 |

This is **infrastructure running cost only** — it doesn't include the one-off build cost, ongoing support, or margin, which are separate commercial decisions. Once you can give us even a rough sense of your real numbers (see "what we'd like from you" below), we replace these ranges with a real figure.

### 03 — RAG Design

This is the core AI behaviour, written out end to end: a document gets uploaded, the AI reads and suggests where it belongs (you or your team confirm), and it's indexed. When an employee asks a question, the system searches *only that RAG's own approved content*, finds the most relevant sections, and generates an answer using *only* what it found — always naming which document(s) it used. If the approved content doesn't actually cover the question, the system is designed to say so and hand it to a human, rather than guess. Separately, and independently of the AI's judgement, a keyword scan checks every question against your configured alert words — so a safety-critical alert never depends on the AI "deciding" correctly, it's a guaranteed check either way. Every document update is kept as a new version rather than overwriting the old one, so the audit trail can always show what was true at any point in time.

### 04 — RAG Evaluation Strategy

This is how we prove document 03's central claim is actually true, rather than take our own word for it. We test four things: that answers never contain claims the cited document doesn't actually support; that citations are accurate; that the system correctly refuses when it should *and* correctly doesn't refuse when it shouldn't; and that keyword alerts fire reliably every time. This includes deliberately adversarial testing — questions designed to try to trick the AI into guessing or leaking information across organisations — with a starting bar of correctly handling at least 95% of those adversarial cases before any change to the AI pipeline can ship. Testing doesn't stop at launch either: a sample of real answers gets reviewed on an ongoing basis, and anything a user flags as wrong feeds back into the test set.

### 05 — API Specification

The technical contract that the web app, the floating widget, and a future mobile app all call — covering team management, RAGs, alerts, the dashboard, calendar, and a separate set of endpoints just for the SafeIQ Internal support account. It's derived directly from the working prototype's screens, so nothing in it is speculative — every entry traces back to something you've already seen working.

### 06 — Multi-Tenant Database Schema

The database design behind document 01's isolation guarantee. There are two tiers: a small shared registry that just knows which organisations exist, and a completely separate database compartment per organisation holding everything else. No organisation's data can ever be looked up alongside another's — it's not possible by the way the system is built, not just a rule that's supposed to be followed. This document also defines the audit trail itself: an append-only, tamper-evident log of who did what and when.

### 07 — Security & Compliance Design

Confirms UK-only hosting and encryption of everything, at rest and in transit. Lays out the role hierarchy as we understand it today (Super Admin, Administrator, Manager/Support, Employee, plus SafeIQ Internal as a separate cross-organisation support role), with two-factor authentication and IP allow-listing available. The centrepiece is resolving a genuine tension in the brief: GDPR gives people the right to have their data deleted, but the audit trail needs to prove what happened and can't just have gaps. Our proposed resolution: the personal content itself (documents, messages) can be deleted on request; the audit log entry stays, but it only ever held a hash and a timestamp, never the personal content itself — so it still proves *that* something happened without holding onto anything that needed erasing. This document also flags, plainly, that safeguarding and health-related content is very likely to count as a higher-sensitivity data category under UK GDPR, and that the Safety features (siren, lock-screen recording) carry real legal exposure that needs dedicated legal review before we'd commit to building them.

### 08 — Architecture Decision Records

The five choices that are expensive to reverse once built, each with the alternatives we considered:

1. **AI provider** — Anthropic's Claude, via Amazon Bedrock. Keeps everything inside AWS, and Claude is particularly reliable at declining to answer rather than guessing, which matters more here than in a typical chatbot.
2. **Search database** — Amazon OpenSearch, for combined keyword + meaning-based search with built-in per-organisation isolation.
3. **How organisations are kept separate** — a separate database compartment per organisation on shared infrastructure: strong isolation without the cost of a fully separate database per client.
4. **Real-time system** — Amazon Chime for calls/video/screen-share, plus a lightweight always-on connection for chat and live updates.
5. **Audit trail technology** — a tamper-evident hash-chained ledger instead of a literal blockchain. This is the one decision we're explicitly asking you to make rather than assuming (see below).

### 09 — Delivery Plan & Phasing

Lays out what genuinely has to happen before build can start (the workshops and spikes below — nothing else is actually blocking), and recommends what ships in the first release versus phase 2: the Safety/Emergency features (siren, lock-screen recording, real GPS-linked safe word) are recommended for phase 2 pending legal review, since they carry real legal exposure a technical design alone can't resolve; the mobile app may also land in phase 2 depending on what the iOS feasibility spike finds. Everything else you've already seen working in the prototype — RAG creation, alerts, dashboards, chat and calls on the web, the calendar, the internal support account — is recommended for phase 1.

## The honest headline

Everything in this pack is a **proposed design, not a committed one.** We've gone as far as we responsibly can on paper. A handful of things can only be validated by actually testing them — and we'd rather tell you that plainly now than quietly assume our way past it and have it surface as a problem later, in a fixed-price contract, after the fact.

Specifically still open:

1. **A short set of requirement workshops** to close out the remaining open questions (team role permissions, a couple of account-type distinctions, and the exact scope of the SafeIQ internal support account). These are small individually but the fixed price depends on all of them being nailed down first.
2. **Four short technical spikes**, before we'd be comfortable committing a fixed price around them:
   - Testing the AI actually answers only from your real documents, cites its sources correctly, and refuses rather than guesses — run against a real (anonymised where needed) sample of your content.
   - Proving out the floating widget mechanism itself (how it actually gets onto a user's browser or device).
   - A real voice/video/screen-share call round-trip, not just a design on paper.
   - Checking the mobile version — and specifically the lock-screen recording idea — is actually feasible and legal on iOS before we scope it in.
3. **One decision that's specifically yours to make, not ours:** the brief asks for the RAG data to sit in a "blockchain" for audit purposes. Our recommendation (in the Architecture Decision Records) is a tamper-evident, hash-chained ledger instead — it solves the actual problem (proving what happened, and resolving that against GDPR erasure requests) more cleanly than a literal blockchain would. But that's a genuine change from the brief's wording, and we want your explicit sign-off on it rather than quietly substituting it.
4. **Your numbers, not our guesses**, to turn the cost model from an illustrative range into a real figure — see the Cost Model document's final section for the exact five questions.

## What we'd like from you

- A read-through of this pack, at whatever pace suits — none of it requires a same-day response.
- Time for 2–3 short workshops to close out item 1 above.
- A steer on item 3 above (the blockchain question) — this is the one place we're deliberately asking you to make a call rather than deciding it for you.
- The scale numbers in the Cost Model document, whenever you have a rough sense of them — rough is fine to start.
- Sign-off to run the four technical spikes, including sharing a small real sample of documents for the AI-grounding test (happy to discuss an NDA or data-handling agreement for that specifically).

Once those land, we convert every `PROPOSED` decision in this pack to `ACCEPTED`, turn the cost model into a real number, and that's what the fixed price gets built on.

Happy to walk through any of this on a call — it's a lot to read in one sitting, and it's genuinely meant to be discussed, not just approved.
