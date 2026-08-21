# ADR-0006: Use Resend with a durable PostgreSQL email outbox

## Status

Accepted

## Context

Shura sends service emails from workflows that also mutate sensitive scheduling, intake, assignment, and payment state. Synchronous or post-commit best-effort delivery can lose email intent during process failure, while provider acceptance alone does not prove delivery. Email payloads and idempotency identifiers must also minimize personal and health-related data.

## Decision

- Send application email through the Resend HTTPS API behind the application-owned email service boundary.
- Persist every email intent in PostgreSQL before provider delivery. Insert intent in the originating domain transaction where practical.
- Treat the worker switch as a provider-claim pause only; disabling it never causes a synchronous fallback or pauses retention cleanup.
- Distinguish provider `accepted` from webhook-confirmed `delivered`, with `bounced`, `complained`, retryable `failed`, and exhausted/permanent `dead` states.
- Verify signed Resend webhooks and commit event deduplication with the state transition in one transaction.
- Use opaque stable event keys, minimal administrative templates, and explicit plain-text alternatives.
- Purge accepted/terminal payload and error fields plus old webhook deduplication records after 30 days while retaining minimal delivery metadata.
- Preserve legacy `sent` only for rolling migration compatibility.

## Rationale

The HTTPS API exposes structured provider IDs and retry signals without an additional mail transport layer. A PostgreSQL outbox uses the application's existing durable store, supports transactionally coupled intent, and coordinates replicas through row locking. Signed webhooks provide evidence of delivery and suppression outcomes. Explicit retention reduces unnecessary storage of recipient and message content.

## Alternatives

- Synchronous provider delivery was rejected because a committed domain change could lose its notification when the process or provider fails.
- A provider relay retaining the previous transport abstraction was rejected because it did not solve lifecycle, atomicity, idempotency, or retention requirements.
- A separate general-purpose queue was deferred because PostgreSQL already provides the required transactional boundary and current volume does not justify another operational system.

## Consequences

- Migrations 017 and 018 must exist before the Resend-only runtime is deployed.
- Production requires Resend API, sender, webhook, administrative recipient, and worker-switch configuration.
- Pausing delivery can grow pending rows and therefore requires backlog monitoring.
- Provider calls and webhook handling must remain idempotent and order tolerant.
- Auth0 identity emails remain outside this decision.
- Reminder scheduling, SMS, campaigns, and platform-update delivery require separate product and architecture decisions.
