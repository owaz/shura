# Shura Copilot instructions

Before recommending architectural or cross-cutting changes, consult:

- `/AGENTS.md`
- `/docs/architecture`
- `/docs/product`
- `/docs/decisions`

Treat implementation and ordered migrations as authoritative when legacy guides disagree. Do not recommend a change that contradicts an accepted ADR without naming the ADR, explaining the conflict, and proposing whether it should be superseded.

For code review, prioritize in this order:

1. correctness
2. security and privacy
3. regressions
4. business-rule violations
5. architecture violations
6. concurrency and data consistency
7. error handling
8. test coverage
9. maintainability

Check backend authorization and ownership independently of frontend route guards. Pay special attention to sensitive intake/chat data, Auth0/local identity synchronization, booking and payment idempotency, database transactions, webhook verification, private blob access, calendar token handling, and accidental browser-side secrets.

Document durable knowledge, not task history. Update the relevant canonical document or ADR when a change materially alters the system.
