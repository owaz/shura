# ADR-0005: Finalize paid bookings only after payment verification

## Context

Creating a booking before payment can leave unpaid reservations, while accepting a browser payment result without verification is unsafe. Current payment code distinguishes legacy booking-first behavior from a newer payment-intent flow and handles both browser verification and provider webhooks.

## Decision

For paid-slot booking, create a Razorpay order and durable booking intent first. Create the confirmed booking/payment only after a valid Razorpay signature, inside a database transaction that locks/rechecks the slot. Deduplicate webhooks by provider event ID and make repeated finalization return existing records.

## Rationale

Code comments and transaction structure explicitly target server-derived pricing, payment authenticity, idempotency, and concurrent slot consistency. No broader provider-selection history is recorded.

## Alternatives

The legacy route creates a booking before payment and updates it after verification. Keeping a temporary slot reservation or payment authorization/hold is not implemented.

## Consequences

- A slot is not reserved during checkout and can be lost after payment, creating a conflict/refund support case.
- Verification and webhook paths must share idempotent finalization logic.
- Provider calls and PostgreSQL cannot be one atomic transaction; reconciliation is required.
- Money units and price derivation must remain server-controlled.

## Status

Accepted (inferred from the preferred route and implementation comments). The rationale for Razorpay itself is unknown.
