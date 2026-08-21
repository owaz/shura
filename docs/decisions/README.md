# Architecture decision records

ADRs record durable decisions visible in the repository. Status “Accepted (inferred)” means current source/configuration consistently implements the decision; it does not claim knowledge of unrecorded historical discussions.

- [ADR-0001: Keep a two-package monorepo and ship one production container](0001-monorepo-single-production-container.md)
- [ADR-0002: Use Auth0 for authentication with local role-specific profiles](0002-auth0-with-local-profiles.md)
- [ADR-0003: Evolve the legacy PostgreSQL schema with ordered additive migrations](0003-ordered-additive-postgresql-migrations.md)
- [ADR-0004: Store new images in private Azure Blob Storage](0004-private-azure-blob-images.md)
- [ADR-0005: Finalize paid bookings only after payment verification](0005-payment-verified-booking-finalization.md)
- [ADR-0006: Use Resend with a durable PostgreSQL email outbox](0006-resend-durable-email-delivery.md)

New ADR filenames use the next four-digit number and a short slug. Include Context, Decision, Rationale, Alternatives (when known), Consequences, and Status. If historical rationale is unavailable, say so rather than reconstructing it.
