# Email delivery

## Boundary

Shura sends application-generated transactional email through the Resend HTTPS API. Auth0 remains responsible for identity emails such as verification and password reset.

Application code calls typed helpers in `shura-backend/utils/emailService.js`. Every helper inserts an `email_outbox` row; no request handler sends synchronously or bypasses durability. Where an email corresponds to a database state change, the intent is inserted with that change in the same transaction.

## Delivery lifecycle

`utils/emailWorker.js` runs one batch immediately at startup and then polls for work. PostgreSQL row locks with `SKIP LOCKED` make claims safe across replicas. The worker can be paused with `EMAIL_OUTBOX_WORKER_ENABLED=false`; queueing continues while paused.

Resend API acceptance records `accepted`, the provider message ID, and `accepted_at`. Signed webhook events advance the row to `delivered`, `bounced`, or `complained`. Retryable network, timeout, rate-limit, and provider-server failures use bounded backoff. Permanent provider errors or five exhausted attempts become `dead`. The legacy `sent` status remains readable for rolling-migration compatibility but is not written by the Resend-only runtime.

Webhook deduplication and delivery-state updates share one database transaction. Events that arrive before provider acceptance are retained and reconciled when the message ID is stored. Provider occurrence time and state precedence prevent stale or out-of-order events from downgrading a later bounce or complaint.

## Privacy and retention

Event keys use opaque durable IDs or a one-way token digest. They must not contain recipient addresses, names, bearer tokens, or URLs. Administrative questionnaire and intake emails contain only a minimal portal-directed alert, not health responses or free-text notes.

After 30 days, accepted and terminal outbox rows retain minimal type/status/provider/timestamp metadata while recipient, subject, body, and last-error fields are nulled. Including accepted rows prevents a missing delivery webhook from extending payload retention indefinitely. Old webhook deduplication rows are deleted on the same retention schedule.

## Configuration and operations

Production startup requires:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_WEBHOOK_SECRET`
- `ADMIN_EMAIL`
- `EMAIL_OUTBOX_WORKER_ENABLED` set to `true` or `false`

Configure the Resend webhook to call `POST /api/webhooks/resend`. Operational monitoring should track pending age, failed/dead rows, attempts, accepted-to-delivered latency, bounces, complaints, webhook failures, and payload-purge backlog.

Reminder scheduling, SMS reminders, newsletters/campaigns, and platform-update email delivery are not part of this subsystem today.
