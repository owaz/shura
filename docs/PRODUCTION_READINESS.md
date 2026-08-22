# Production readiness and incident operations

This runbook defines the evidence required to promote Shura and the first response to shared-service failures. It does not claim that secure video/audio or legacy therapist call/payment surfaces are production-supported.

## Release evidence

A releaser must retain links or logs showing:

1. Backend tests, frontend typecheck/build, PostgreSQL fresh-bootstrap/upgrade/idempotency tests, and the full-history Gitleaks scan passed on the exact commit.
2. Authenticated Playwright and axe suites ran with a synthetic client at desktop, tablet, and mobile widths, and separate manual smoke evidence covers synthetic therapist/admin Auth0 login plus role/status routing. Skipped Auth0 tests do not count.
3. The manually approved migration workflow completed in staging, including its second-run `Skipping` evidence. Production migration is a separate protected approval.
4. Staging health, protected-route rejection, Auth0 login/role/status routing, database connectivity, client portal navigation, Razorpay test webhook/signature behavior, private Blob upload/read/delete, Resend outbox/webhook delivery, and configured calendar callbacks were verified.
5. The previous healthy Container App revision and latest restorable PostgreSQL backup were identified before production approval.

Destructive scenarios such as refund, cancellation, account deletion, and provider replay use synthetic records and require the operator to confirm the target immediately before execution. No workflow selects or configures a video provider.

## Promotion and rollback

Production is a GitHub protected environment with required human approval after staging smoke checks. Deploy immutable SHA image tags. To roll back application code, reactivate the last healthy Container App revision and repeat health, authentication, protected-route, database, and touched-provider smoke checks. Do not reverse an additive migration automatically; first establish that the old revision is schema-compatible. Restore PostgreSQL only for confirmed data loss or corruption, under the database recovery procedure, because a restore can discard valid concurrent work and provider reconciliation state.

## Monitoring and alert ownership

Route alerts to an explicitly staffed operations channel and include environment, revision, opaque correlation/event ID, and failure class—never tokens, email bodies, intake answers, messages, SAS URLs, calendar credentials, or raw provider payloads.

| Signal | Alert condition | First response |
| --- | --- | --- |
| `/api/health`, 5xx rate, latency | consecutive health failures or sustained error/latency threshold | inspect active revision and dependency health; roll back code if revision-correlated |
| PostgreSQL connectivity/TLS/pool | connection failures, pool exhaustion, rejected certificates | keep TLS verification enabled; check firewall, CA chain, capacity, and failover state |
| `email_outbox` | growing pending/retry queue, terminal `dead`, worker stopped | pause claims if provider is unstable; inspect opaque event IDs and retry class |
| Resend webhooks | signature failures or accepted rows without terminal delivery beyond SLA | verify endpoint secret/configuration and provider event state; never replay unverified payloads |
| Razorpay webhooks/refunds | signature failure, replay spike, captured-but-unfinalized payment, refund failure/pending beyond SLA | correlate provider IDs to locked booking/payment rows and reconcile |
| Calendar sync | OAuth refresh failures, repeated create/update/delete failures | preserve booking authority in PostgreSQL; reconnect provider or retry the idempotent side effect |
| Account deletion | blocked rows with `account_deletion_requested_at` | verify Auth0 deletion, retry provider deletion, then complete local deletion only after identity removal |

Thresholds and paging destinations are environment operations configuration, not source-code defaults. Verify Application Insights alert rules and notification delivery during each release rehearsal.

## Reconciliation procedures

- **Email:** set `EMAIL_OUTBOX_WORKER_ENABLED=false` to pause claims while queue insertion and retention continue. Repair configuration, send one controlled synthetic event, confirm signed webhook delivery, then re-enable. Stable event keys must not be changed or dual-sent.
- **Payment/refund:** compare Razorpay order/payment/refund IDs with local payment, booking, refund, and webhook-event rows. Verify signatures and idempotency keys before replay. Never mark a booking paid or a refund complete from browser input or an operator guess.
- **Account deletion:** the local client is first marked requested/blocked. If Auth0 deletion fails, retain that row for retry. After Auth0 confirms the identity is absent, complete the local transaction and best-effort private-image cleanup.
- **Azure Blob:** keep the container private, validate MIME/size and decoded image content, store stable blob names, issue short-lived read-only SAS URLs, and delete replaced/account-owned blobs. Failed cleanup becomes an operational retry.
- **Calendar:** PostgreSQL remains booking authority. Retry provider writes with the persisted integration/event identity; never infer slot freedom solely from a failed provider call.

## Deliberate limitations

- Calling routes return `VIDEO_PROVIDER_UNCONFIGURED`; legacy Socket.IO call signaling is disabled.
- Socket.IO has no cross-replica adapter, so keep a single active realtime replica until shared routing is implemented.
- Authenticated staging smoke tests and provider/backup/rollback rehearsals need live credentials and human approval; repository CI cannot prove them.
