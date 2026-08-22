# ADR-0007: Establish a Daily-based video calling foundation with staged activation

## Status

Accepted

## Context

Shura needs a production-ready video session system for mental-health counseling that enforces strict privacy controls, deterministic lifecycle state, and backend ownership checks. Existing legacy WebRTC and Socket.IO call paths are placeholders and do not provide the required provider boundary, token policy, webhook durability, or operational safety for secure session joining.

The approved video design defines Daily as the provider target and requires phased rollout: data model and provider boundary first, then dedicated video routes and client integration, without silently activating provider behavior through legacy endpoints.

## Decision

- Select Daily as the backend video provider boundary for authenticated session operations.
- Keep provider integration behind `services/video/videoProvider.js` with explicit startup configuration validation.
- Use private rooms and room-bound short-lived meeting tokens; do not rely on browser-side secrets.
- Persist video lifecycle and participant state in dedicated `video_sessions` and `video_participants` tables.
- Persist webhook events in a durable `video_webhook_events` inbox with dedupe keys and lease-based processing.
- Treat provider webhook processing as idempotent and stale-worker-safe through attempt-count compare-and-set updates.
- Stage activation: keep legacy `POST /api/client/sessions/:id/join` unavailable for provider-backed non-text joins while dedicated `/api/video/...` routes are implemented.
- Keep recording and transcription disabled by default for this integration path.

## Rationale

Daily provides managed real-time media capabilities while preserving a server-controlled trust boundary for room and token issuance. A dedicated database-backed lifecycle model separates booking/payment state from live-call state, allowing deterministic retries, idempotency, and recovery from provider/network failures.

Staged activation prevents accidental production exposure of partially migrated call flows. Explicitly gating legacy joins avoids dual-path behavior that is difficult to test and audit.

## Alternatives

- Keep legacy call signaling and defer provider integration. Rejected because it does not meet reliability and security requirements.
- Enable Daily directly on legacy join routes. Rejected because it bypasses the approved dedicated API rollout and increases regression risk during migration.
- Defer durable webhook storage to in-memory processing. Rejected because delivery ordering/retries require durable, idempotent handling.

## Consequences

- `VIDEO_PROVIDER=daily` configuration can be validated and wired without enabling provider-backed joins on legacy endpoints.
- Future phases must implement and harden dedicated `/api/video/...` routes before production video activation.
- Operations must provision and protect Daily credentials and webhook secrets server-side.
- Architecture and runbook documentation must track staged rollout state to avoid deployment ambiguity.
