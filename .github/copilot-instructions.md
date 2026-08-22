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

## Video calling workstream ground rules

These rules govern the phased Daily.co video-calling design and implementation effort and remain in force until that workstream is complete:

1. Do not write implementation code until the design phases are complete and explicitly approved. Design phases are read-and-think only.
2. Stop at the end of every phase, summarize findings, and wait for explicit approval before continuing.
3. One atomic commit per phase, using a conventional-commit message.
4. Never invent an API, database column, environment variable, status enum, or file path. Verify claims against the real code and the official Daily.co documentation at docs.daily.co. If something cannot be verified, say so and ask rather than guessing.
5. When something is ambiguous, present options with a recommendation and trade-offs; do not silently pick one.
6. Do not add a dependency without justifying it. Minimize new dependencies.
7. Never log, store, or transmit counselling content. This is sensitive mental health data.
