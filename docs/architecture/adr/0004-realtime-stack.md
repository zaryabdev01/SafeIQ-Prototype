# ADR-004: Real-Time Stack (chat, calls, screen share, live feeds)

**Status:** PROPOSED - not ready to accept. Blocked on Milestone 1 item 2(c), a real voice/video/screen-share round-trip spike.

## Context

The brief requires the floating AI agent to carry live chat, voice calls, and screen share between assigned end users, plus near-real-time dashboard feeds (live questions coming in, alerts). Item 4 asks specifically for "the shared real-time backbone... used by chat, calls, screen share and the live feeds" - i.e. one coherent design reused across all four, not four separate bespoke systems bolted together.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Fully self-hosted**: WebSocket service (ECS/Fargate) for chat/live-feeds + a self-managed SFU (e.g. LiveKit or mediasoup) and TURN server (coturn) for calls/screen-share, all in AWS London | Full control, clean data-residency story, no per-minute vendor fee | Real engineering lift and ongoing operational burden (SFU/TURN are not "set and forget") - exactly the kind of cost/risk item 2(c) exists to surface before committing to a fixed price |
| **Managed media platform** (Amazon Chime SDK, or a third party such as Agora/Twilio/Vonage) for the call/screen-share leg, combined with a lighter self-hosted layer (API Gateway WebSockets or AppSync subscriptions) for chat and live feeds | Materially faster to ship; offloads SFU/TURN operations to a vendor with an SLA | Media-server region footprint needs verifying against the UK-only data-residency requirement; recurring per-minute cost needs modelling in item 9; a third-party platform (if not Chime) adds a vendor relationship outside AWS |

## Recommendation

Amazon Chime SDK for the call/screen-share leg (keeps the vendor relationship inside AWS, easiest to reason about alongside the rest of the London-region design), with API Gateway WebSockets or AppSync subscriptions carrying chat messages and the live dashboard feeds (new questions, new alerts). This is "one backbone" in the sense of one coherent real-time transport layer, split into two purpose-fit transports rather than forcing interactive media through the same channel as text/event messages.

## Consequences

- Chime SDK's exact media-routing region must be confirmed before this can move past PROPOSED - if it cannot guarantee UK/acceptable-EU media routing, the self-hosted SFU option becomes the default instead, with a corresponding increase in delivery risk and cost that must be reflected in the estimate.
- The live-feed transport (WebSockets/AppSync) should be designed so the same event stream backs both the organisation dashboard's "live questions" panel and the employee's floating widget - a single publish path, multiple subscribers, rather than separate polling implementations per screen.

## What would change this decision

- Spike 2(c) finds Chime SDK cannot meet the round-trip latency, quality, or data-residency bar in practice.
- Confirmed usage volume (item 9) makes the self-hosted SFU materially cheaper at scale than the managed platform's per-minute pricing, and the team accepts the added operational risk.
