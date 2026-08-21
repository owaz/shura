# Email delivery

## Boundary

Shura sends application-generated transactional email through the Resend HTTPS API. Auth0 remains responsible for identity emails such as verification and password reset.

Application code calls typed helpers in `shura-backend/utils/emailService.js`. Every message selected for delivery inserts an `email_outbox` row; preference-based skips do not. No request handler sends synchronously or bypasses durability. Where an email corresponds to a database state change, the intent is inserted with that change in the same transaction.

The implemented application-email flows are:

| Flow | Recipient | Event-key basis |
| --- | --- | --- |
| Therapist application | configured administrator mailbox | therapist/application ID |
| Short questionnaire submission | configured administrator mailbox | client ID |
| Intake link | client | SHA-256 digest of the single-use token |
| Intake submission alert | configured administrator mailbox | intake-form ID |
| Booking confirmation | client, subject to booking-confirmation preference | booking ID |
| Booking notification | therapist | booking ID |
| Therapist release | therapist | assignment ID |
| Session reschedule | client and therapist | session-event ID |
| Session cancellation | client and therapist | booking ID |

Administrative questionnaire and intake alerts do not contain answers, free-text notes, client identity, or a link to an unimplemented admin client-review page. Staff must use an authorized application surface to retrieve sensitive data.

## Delivery lifecycle

`utils/emailWorker.js` runs one cycle immediately at startup and then polls for work. PostgreSQL row locks with `SKIP LOCKED` make claims safe across replicas. The worker can be paused with `EMAIL_OUTBOX_WORKER_ENABLED=false`; queueing and retention cleanup continue while provider claims are paused.

Resend API acceptance records `accepted`, the provider message ID, and `accepted_at`. Signed webhook events advance the row to `delivered`, `bounced`, `complained`, or terminal `dead` for `email.failed`. Retryable network, timeout, rate-limit, and provider-server failures use bounded backoff. Permanent API errors or five exhausted attempts also become `dead`. The legacy `sent` status remains readable for rolling-migration compatibility but is not written by the Resend-only runtime.

Webhook deduplication and delivery-state updates share one database transaction. Events that arrive before provider acceptance are retained and reconciled when the message ID is stored. Provider occurrence time and state precedence prevent stale or out-of-order events from downgrading a later bounce or complaint.

State meanings:

- `pending`: durable intent is ready but unclaimed.
- `processing`: a worker owns the current attempt.
- `failed`: the last provider attempt was retryable and `next_attempt_at` controls retry.
- `accepted`: Resend accepted the API request; this is not delivery confirmation.
- `delivered`: a signed Resend webhook confirmed delivery.
- `bounced` / `complained`: signed terminal recipient/provider outcomes.
- `dead`: permanent API rejection, signed `email.failed`, or retry exhaustion.
- `sent`: legacy compatibility only.

## Privacy and retention

Event keys use opaque durable IDs or a one-way token digest. They must not contain recipient addresses, names, bearer tokens, or URLs. Administrative questionnaire and intake emails contain only a minimal alert, not health responses, free-text notes, client identity, or a direct client-review link.

After 30 days, accepted and terminal outbox rows retain minimal type/status/provider/timestamp metadata while recipient, subject, body, and last-error fields are nulled. Including accepted rows prevents a missing delivery webhook from extending payload retention indefinitely. Migration 018 adds the matching partial retention index. Old webhook deduplication rows are deleted on the same retention schedule.

## Configuration

Production startup requires:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_WEBHOOK_SECRET`
- `ADMIN_EMAIL`
- `EMAIL_OUTBOX_WORKER_ENABLED` set to `true` or `false`

`RESEND_FROM_EMAIL` is the verified sender. `ADMIN_EMAIL` is a monitored, authorized mailbox that receives internal application alerts; it is not a sender credential or API secret. Production startup validates both as email addresses and fails closed when required configuration is absent.

Configure the Resend webhook to call `POST /api/webhooks/resend` on the environment host and subscribe to:

- `email.delivered`
- `email.bounced`
- `email.complained`
- `email.failed`

The endpoint requires the raw request body and validates Svix-compatible signature headers with `RESEND_WEBHOOK_SECRET`. Unsupported signed events are acknowledged without changing delivery state.

## Deployment and rollback

1. Apply migrations through 018 before deploying the Resend-only runtime; run the migrator twice and verify the second pass skips every file.
2. Create the Container App secrets for API key, verified sender, webhook signing secret, and administrative mailbox before the deployment workflow references them.
3. Set `EMAIL_OUTBOX_WORKER_ENABLED=false` when a controlled provider pause is required. This keeps new intent durable and retention active without synchronous fallback.
4. Deploy and verify startup, health, webhook signature handling, and one controlled `pending → processing → accepted → delivered` message.
5. Re-enable claims only after provider configuration and webhook delivery are verified.

Application rollback does not remove queued rows or reverse migrations. Preserve event keys across retries/revisions. Do not add a second provider fallback or dual-send queued events, because either can duplicate delivery.

## Monitoring and troubleshooting

Monitor:

- age and count of ready `pending`/`failed` rows
- stale `processing` rows and attempt counts
- `dead`, `bounced`, and `complained` counts by `email_type`
- accepted-to-delivered latency and accepted rows without later webhooks
- webhook endpoint failures and dedupe volume
- rows older than 30 days whose `payload_purged_at` remains null

Interpret a domain API success as durable email intent, not proof of delivery. Use outbox state plus Resend provider IDs for delivery investigation. Logs should identify event type or opaque row/event IDs, never recipient addresses, intake tokens, message bodies, or raw webhook payloads.

Reminder scheduling, SMS reminders, newsletters/campaigns, and platform-update email delivery are not part of this subsystem today.
