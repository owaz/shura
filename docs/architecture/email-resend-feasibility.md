# Resend email replacement feasibility

## Executive summary

**Verdict: conditionally feasible and recommended, but not as a transport-only lift-and-shift.**

Resend can replace Gmail SMTP for Shura's application-generated email without changing the frontend or authentication architecture. The backend is Node.js 20, email is already centralized in `utils/emailService.js`, and Resend supports both an HTTP API/Node SDK and a Nodemailer-compatible SMTP relay. No accepted ADR requires Gmail or Nodemailer.

The recommended target is the **Resend HTTP API behind an application-owned email boundary, backed by a durable PostgreSQL outbox and signed webhook processing**. This provides better provider error handling, idempotency, delivery visibility, and retry control than changing the SMTP host while preserving the current best-effort design.

Implementation should not begin until these gates are resolved:

1. **Do not send full intake responses through Resend.** The current administrative intake email includes mental-health concerns, trauma history, medications, relationship information, spiritual information, and suicidality answers. Replace it with a minimal notification that directs an authorized admin to Shura.
2. **Complete privacy/legal review.** Resend documents that account data, email metadata, logs, and API records are stored in the United States even when another sending region is selected. Its public material documents a DPA, SCCs, GDPR support, and SOC 2 Type II, but does not establish HIPAA support or availability of a BAA. Shura must decide its applicable legal and contractual requirements rather than infer suitability from SOC 2.
3. **Define durable delivery semantics.** Current sends are not queued, retried durably, or recorded. Several helpers turn provider failures into successful promise resolutions, so callers can silently lose mail. A provider migration should correct that contract rather than reproduce it.
4. **Classify consent and preferences.** Booking, assignment, and session emails do not consistently consult stored client preferences. Reminder preferences exist, but no reminder scheduler was found. Required transactional notices and optional reminders need separate rules.
5. **Verify live operational facts.** The repository cannot establish the active Azure secrets, DNS ownership, sending domain, real send volume, current Gmail use, or contractual Resend plan.

Auth0-managed verification, password-reset, and identity emails are explicitly outside this assessment.

## Scope and sources

This assessment covers:

- application-generated transactional email
- the adjacent PostgreSQL-backed in-app notification system
- stored email/reminder preferences
- newsletter storage and current outbound maturity
- backend dependencies, configuration, tests, and Azure Container Apps delivery
- provider security, privacy, deliverability, reliability, observability, and cost constraints

It does not cover:

- Auth0-managed email
- changing authentication or account-recovery behavior
- marketing campaign design
- selecting a legal jurisdiction or determining whether Shura is subject to a particular health/privacy regime
- implementing Resend, DNS records, schemas, secrets, or provider accounts

Repository source, ordered migrations, and current canonical documentation were treated as authoritative. Explicitly legacy guides were reviewed for stale provider/configuration references but were not used to infer current behavior.

Resend claims below were checked against official Resend documentation on **2026-08-19**. Pricing, quotas, certifications, subprocessors, and product behavior are time-sensitive and must be rechecked before implementation.

## Current architecture

### Transport and templates

`shura-backend/utils/emailService.js`:

- imports Nodemailer and creates a new Gmail transporter for each helper call
- reads `EMAIL_USER`, `EMAIL_PASSWORD`, and `ADMIN_EMAIL`
- uses `EMAIL_USER` as the sender
- chooses Gmail's named transport only when the password is exactly 16 characters without spaces
- otherwise connects to `smtp.gmail.com:587` with `tls.rejectUnauthorized: false`
- embeds all templates as inline HTML
- escapes interpolated values before placing them in HTML
- returns `{ success: false, error }` for most provider failures instead of rejecting
- logs recipient addresses and raw provider errors

There is no startup validation that email configuration is present, no provider health check, no plain-text template source, no persistent send record, and no delivery-event consumer.

Nodemailer is a production dependency. Gmail settings appear in both backend environment examples and several legacy setup/deployment scripts. The current Azure Container Apps workflow does not inject the Gmail variables, so repository state alone cannot prove that production email is configured.

### Application email matrix

| Flow | Trigger and recipients | Content | Current semantics | Maturity / issue |
| --- | --- | --- | --- | --- |
| Therapist application | Therapist application route → `ADMIN_EMAIL` | Name, email, phone, licence, experience, specialties, session types, rate, availability; template includes direct SQL instructions | Detached after database write; helper catches provider errors | Active route. Administrative SQL instructions are stale and should not be carried into a new template. |
| Therapist approval | Intended admin approval → therapist | Approval and portal link | Helper exists | No active caller was found. This is template inventory, not an implemented notification flow. |
| Client signup | Disabled direct signup → `ADMIN_EMAIL` | Client identity | Awaited, but helper converts failure to `{ success: false }` and result is ignored | Caller is unreachable after the route returns HTTP 410. Do not migrate it as if it were active. |
| Questionnaire submission | Authenticated questionnaire → `ADMIN_EMAIL` | Client identity, primary concerns, gender preference, free-text notes | Awaited, but failure result is ignored | Active. Contains sensitive free text and mental-health concern labels. |
| Intake link | Authorized therapist/admin → client | Client name and seven-day bearer-token URL | Token is stored first; send is awaited, but failure result is ignored; API still says the link was sent and returns the raw link | Active and security-sensitive. No durable resend state; response semantics can falsely claim delivery. |
| Intake submission | Public token submission → `ADMIN_EMAIL` | Full intake answers including mental health, trauma, medical, relationship, spiritual, medication, and suicidality data | Intake and token are persisted first; send is awaited, but failure result is ignored | Active. **Do not reproduce this content in Resend.** Send only a minimal portal notification after privacy review. |
| Booking confirmation | Booking finalization → client | Therapist, type, date, time | Usually detached after commit; helper catches provider errors | Active in portal and legacy payment/booking paths. Stored booking-confirmation preference is not consulted. |
| New booking | Booking finalization → therapist | Client name/email, type, date, time | Usually detached after commit; helper catches provider errors | Active. Payment finalization is idempotent, but email itself has no provider idempotency key or durable send record. |
| Therapist release | Client release → therapist | Client name and assignment-release status | Domain commit occurs first; route then awaits helper and returns `notificationSent` | Active. If a future adapter rejects instead of returning a result, the route can return HTTP 500 after the release has committed. |
| Session reschedule | Client reschedule → client and therapist | Previous/new time and participant names | Detached after commit; nested `Promise.allSettled`; helper returns one aggregate boolean | Active. Partial recipient failures are not durably visible and are normally not logged by the caller. |
| Session cancellation | Client cancellation → client and therapist | Original time; client receives refund wording | Detached after commit; nested `Promise.allSettled`; helper returns one aggregate boolean | Active portal flow. Refund wording is computed from asynchronous provider state and must remain factually precise. |
| Legacy booking cancellation | Legacy cancel route → client and therapist | Intended cancellation messages | Database update happens before function calls | Broken: the route imports two helper names that `emailService.js` does not export, causing a post-update `TypeError` and HTTP 500. This is existing debt, not a Resend incompatibility. |

The disabled signup caller and active questionnaire caller both use `sendClientSignupNotification`. Cleanup of the unreachable signup code must preserve or deliberately split the helper used by the active questionnaire flow.

### In-app notifications, preferences, and newsletter

Application email is not the same subsystem as client in-app notifications:

- In-app notifications are PostgreSQL rows owned by a client, exposed through authenticated client APIs, and can carry deduplication keys.
- Booking, reschedule, cancellation, payment/refund, assignment, and release workflows already create several in-app events independently of email.
- Replacing Gmail must not remove, duplicate, or redefine those events.

Preference state is fragmented:

- Legacy `users.email_notifications` exists but current email helpers do not consult it.
- Client preferences include 24-hour email reminders, one-hour email reminders, SMS reminders, and booking confirmation.
- No email reminder scheduler or worker was found.
- Booking confirmation sends do not consult the stored booking-confirmation preference.
- The product needs to distinguish non-optional service/security messages from optional reminders before wiring preferences to delivery.

Newsletter routes currently store subscribe/unsubscribe state. No outbound newsletter sender was found, so Resend Broadcasts/Audiences are not required to replace current behavior. Marketing mail should remain a separate future assessment with consent and unsubscribe requirements.

## Resend capability assessment

### Application compatibility

Resend provides an official [Node.js quickstart](https://resend.com/docs/send-with-nodejs), an [Express quickstart](https://resend.com/docs/send-with-express), and a [send-email API](https://resend.com/docs/api-reference/emails/send-email). The API supports the features Shura currently uses:

- verified-domain sender addresses
- one or multiple recipients
- HTML and plain text
- reply-to, CC/BCC, custom headers, tags, and attachments
- provider templates or application-supplied HTML
- a returned provider email ID

The SDK examples use ESM syntax. Before choosing the SDK in this CommonJS backend, implementation should verify the then-current package export map with Node.js 20. A direct `fetch` adapter remains straightforward if CommonJS compatibility changes.

Resend also documents a [Nodemailer SMTP relay](https://resend.com/docs/send-with-nodemailer-smtp), which makes a low-code transport swap possible. It is viable as an emergency compatibility bridge, but it does not address Shura's delivery-state and error-contract problems.

### Domain and deliverability

Production delivery requires a verified sending domain. Resend recommends a dedicated subdomain, which would isolate transactional-mail reputation and avoid modifying an existing root-domain SPF policy.

Required operational work includes:

- choose an environment-specific sending subdomain and sender address
- add the Resend-generated SPF/DKIM records
- add and progressively enforce DMARC
- decide whether to enable enforced TLS
- preserve any existing Google Workspace/root-domain records
- separate staging and production identities where practical

See Resend's [domain setup](https://resend.com/docs/add-a-domain), [domain overview](https://resend.com/docs/dashboard/domains/introduction), and [DMARC guide](https://resend.com/docs/dashboard/domains/dmarc).

Resend automatically suppresses addresses after permanent bounces and complaints. Suppression applies across a team, so environment/team separation matters. The application should consume bounce, complaint, failure, delay, and suppression events rather than rely only on the provider dashboard. See [email suppressions](https://resend.com/docs/dashboard/emails/email-suppressions).

### Idempotency and delivery events

The send and batch APIs accept an [idempotency key](https://resend.com/docs/dashboard/emails/idempotency-keys). Keys are retained for 24 hours. This is useful but insufficient as Shura's only duplicate-send control:

- booking/session operations can be replayed after more than 24 hours
- retries need a stable application event identity
- the application must remember whether a message was accepted
- a changed payload under the same key is rejected

Resend [webhooks](https://resend.com/docs/dashboard/webhooks/introduction) are at-least-once and can arrive out of order. A future endpoint must:

- preserve the raw body required by the chosen signature verifier
- verify Svix headers with the endpoint signing secret before parsing/processing
- deduplicate each webhook delivery ID
- process state transitions idempotently and tolerate reordering
- return promptly and move domain work out of the request where appropriate
- never log full message content or sensitive provider payloads

Relevant events include sent, delivered, delayed, bounced, failed, complained, opened, clicked, and suppression changes. Open/click tracking is not necessary for Shura's service email and should default off unless privacy review approves a specific need. See [webhook event types](https://resend.com/docs/webhooks/event-types) and [retry/replay behavior](https://resend.com/docs/webhooks/retries-and-replays).

### Limits and cost

As checked on 2026-08-19:

- Resend documents a default API limit of 10 requests per second per team in its [API introduction](https://resend.com/docs/api-reference/introduction).
- The [pricing page](https://resend.com/pricing) lists a free tier with 3,000 messages per month and a 100-per-day limit, with paid tiers increasing monthly allowance and retention/SLA options.
- Non-enterprise plans list 30-day data retention; Enterprise advertises flexible retention.
- Dedicated IP availability and suitability depend on plan and sustained volume.

Shura's actual event volume is not present in the repository. Before plan selection, measure:

- daily and peak bookings/session mutations
- reminder volume if reminders are implemented
- admin/application/intake events
- expected staging/test use
- bounce and retry overhead

Low current volume is likely compatible with the API rate limit, but this is not a substitute for measurement. The free tier should not be treated as a production reliability plan solely because expected volume fits.

### Privacy, security, and data location

Resend documents:

- [SOC 2 Type II](https://resend.com/security/soc-2)
- a [Data Processing Addendum](https://resend.com/legal/dpa) with EU/UK transfer terms
- selectable [sending regions](https://resend.com/docs/dashboard/domains/regions)
- US storage of account data, including email metadata, logs, and API records, regardless of sending region

Public documentation does not establish:

- HIPAA compliance or a Business Associate Agreement
- the exact retention and dashboard visibility of full email bodies
- whether Shura's required retention/deletion terms are available on the intended plan
- whether Resend's subprocessor set is acceptable to Shura

Required controls regardless of provider:

- sending-only API keys for the runtime where feasible
- separate keys per environment and rotation/revocation procedures
- Azure secret references rather than plaintext workflow values
- no provider secret in `VITE_*` variables or browser code
- redacted structured logs containing internal event ID, template type, provider ID, and status—not message body, token, or clinical content
- data-minimized subjects, tags, and webhook persistence
- no intake token in logs, tags, or provider metadata

## Option comparison

| Option | Advantages | Disadvantages and risk | Assessment |
| --- | --- | --- | --- |
| A. Resend SMTP relay with Nodemailer | Smallest code/configuration change; preserves current templates and call sites | Retains Nodemailer and current ambiguous helper contract; easiest path to reproducing silent failures and sensitive content; less natural access to structured provider IDs; still needs domain, privacy, webhook, and suppression work | Feasible only as a short-lived emergency bridge. Not recommended as the target. |
| B. Resend HTTP API behind `emailService` | Removes Gmail password/SMTP/TLS logic; exposes provider IDs and structured errors; supports idempotency, tags, and webhooks; clean fit for Azure outbound HTTPS | Sends remain vulnerable to process exit/outage after commit; no durable retry or status unless additional storage is added; callers must be adapted carefully because the SDK returns `{ data, error }` | Good adapter boundary, but incomplete as a production reliability design. |
| C. Resend HTTP API plus PostgreSQL outbox and webhook state | Durable intent before send; controlled retries; stable event idempotency; auditable acceptance/delivery/failure; supports replay and operational recovery; works across replicas | Requires additive migrations, a worker/claiming strategy, webhook endpoint, retention policy, operational UI/querying, and more tests | **Recommended target.** Best fit for Shura's post-commit side effects and sensitive workflows. |

## Recommended target design

### Provider-neutral message boundary

Retain an application-owned service boundary, but split responsibilities:

1. Domain workflows enqueue a typed message after or within the same transaction as the durable domain change.
2. Templates accept minimal, validated data and produce HTML plus explicit plain text.
3. A Resend adapter maps the provider-neutral message to the HTTP API.
4. The adapter converts every `{ error }` result or non-success response into a typed failure; it must not return a success-shaped result.
5. Provider-specific IDs and error categories are stored without raw sensitive payloads.

Template names should describe business events, not providers. Do not move templates into the Resend dashboard initially unless ownership, review, versioning, environment promotion, and rollback are defined. Keeping templates in source provides reviewable changes and a single release artifact.

### Durable outbox

An additive migration should eventually create a minimal email-delivery model containing:

- application event/message ID and stable deduplication key
- message type and recipient role/reference
- recipient address or an encrypted/minimized reference based on the privacy design
- template version and non-sensitive payload
- status, attempt count, next attempt time, and last categorized error
- Resend email ID and accepted/delivered/failed timestamps
- creation/update timestamps

Do not store full rendered intake content. Claim work with PostgreSQL locking so multiple Container App replicas cannot send the same row concurrently. Define terminal and retryable provider errors and cap retries with visible dead-letter state.

The exact worker mechanism is a future architecture decision. A polling worker in the existing process is the smallest deployment change, but scale-to-zero, shutdown behavior, replica concurrency, and health visibility must be designed. A separate job/worker may be justified later; this assessment does not select it.

### Webhook endpoint

Add a public backend endpoint with:

- raw-body signature verification before event handling
- narrow body-size and rate limits
- durable event-ID deduplication
- idempotent, order-tolerant delivery updates
- stable responses that do not expose verification detail
- no authentication dependency on browser/Auth0 tokens
- secret rotation and replay procedures

Webhook receipt should not mark the originating booking or session mutation failed. It updates email delivery state and triggers operational follow-up where appropriate.

### Content policy

Classify messages before migration:

- **Required service messages:** security/account actions owned by Shura, material booking/session changes, and other notices required to operate the requested service.
- **Preference-controlled messages:** reminders and optional updates.
- **Administrative alerts:** should contain the minimum information needed to direct an authorized admin to Shura.
- **Marketing/newsletter:** separate consent, unsubscribe, audience, and content lifecycle.

For intake submission, use wording such as “A client completed an intake form; sign in to review it” with an authenticated portal link. Do not include answers, clinical flags, client email, or a reusable intake token in the message.

## Future implementation phases

### Phase 0: decision gates

- confirm applicable privacy/legal requirements and vendor terms
- review Resend DPA, subprocessors, retention, deletion, incident, and support/SLA terms
- decide whether any clinical or intake-derived content may be processed by an email provider
- select sending domain/subdomain and establish DNS ownership
- measure volume and select environment/team/plan separation
- define required versus preference-controlled messages

### Phase 1: correctness and privacy baseline

- replace the full intake-submission email with a minimal authenticated-portal alert before or with provider migration
- remove stale SQL instructions from therapist-application mail
- remove or deliberately wire unused approval mail
- repair or retire the broken legacy cancellation path
- define one provider-neutral result/error contract
- add focused template escaping, recipient, preference, and failure tests

### Phase 2: Resend adapter and configuration

- add the Resend dependency only after verifying Node 20/CommonJS compatibility
- configure `RESEND_API_KEY`, a validated sender, and administrative recipient through backend-only secrets
- remove Gmail password heuristics and insecure TLS fallback
- add plain-text bodies
- assign stable application event/idempotency keys
- use Resend safe test addresses in automated provider-contract checks; never send tests to real clients

### Phase 3: outbox and delivery tracking

- add ordered migrations for outbox and webhook-event state
- enqueue messages transactionally with domain changes where practical
- implement locked retry processing and graceful shutdown
- add signed webhook handling, deduplication, and delivery transitions
- add redacted logs, metrics, alerts, and operational recovery procedures

### Phase 4: staged rollout

- verify staging DNS, sender, webhook, bounce, complaint, suppression, retry, and quota behavior
- canary one low-sensitivity event type
- progress through booking/session events before intake-link delivery
- monitor acceptance, delivery, bounce, complaint, delay, duplicate, and retry metrics
- retire Gmail credentials and Nodemailer only after all active paths use the new boundary

Do not dual-send the same production event through Gmail and Resend; that creates duplicate user messages. Rollback should stop new Resend claims, preserve queued events, and deliberately resume through a tested fallback or corrected adapter without changing idempotency keys.

## Verification and acceptance criteria

A future implementation is ready only when:

- every active email flow is represented in an owned matrix and test
- no full intake answers or clinical free text are sent to Resend
- required and preference-controlled sends follow documented rules
- domain changes and booking/payment/session transactions remain correct when email is unavailable
- a send is never reported as delivered merely because the API accepted it
- every message has a stable application ID and no duplicate is produced by request, worker, or webhook replay
- provider errors are categorized and visible; retry exhaustion is actionable
- webhook signatures and event deduplication are tested
- logs and database rows exclude bodies, intake tokens, secrets, and raw provider payloads
- staging tests cover accepted, delivered, delayed, bounced, complained, suppressed, rate-limited, invalid-recipient, and provider-unavailable cases
- Azure deployment injects only backend secret references and supports key rotation
- Gmail credentials and Nodemailer references are removed from active configuration and canonical documentation after cutover
- backend tests, frontend typecheck/build when preferences or UI change, migration upgrade/fresh-bootstrap checks, and public-repository secret scanning pass

## Risks and unresolved decisions

| Item | Impact | Required owner/action |
| --- | --- | --- |
| Full intake data currently emailed | Critical privacy exposure independent of provider | Product, privacy/legal, security, and clinical operations must approve a minimal replacement. |
| US storage of Resend account data | Cross-border/privacy implications | Legal/privacy review against user locations and applicable law. |
| No public HIPAA/BAA statement | Cannot infer healthcare-data suitability | Obtain written vendor answer if a BAA or equivalent requirement applies. |
| Unknown live Azure/email state | Cutover and rollback cannot be planned reliably | Operations must inventory deployed secrets, current sender, failures, and volume. |
| No durable queue today | Lost mail during process/provider failure | Implement outbox or explicitly accept and document lower reliability. |
| Preferences not consistently enforced | Consent/UX regression risk | Product must classify each message and define precedence. |
| Team-wide suppression | One environment/event can suppress future mail | Define Resend team/environment separation and suppression recovery. |
| Pricing and SLA are plan-dependent | Cost and incident-response risk | Recheck current plan terms using measured volume. |
| Provider dashboard template ownership | Drift and rollback risk | Keep templates in source initially or define controlled promotion/versioning. |
| In-app notification overlap | Duplicate/conflicting messages | Preserve the in-app subsystem and define channel responsibilities. |

## Final recommendation

Proceed to implementation planning **only after Phase 0 gates are accepted**. Choose the Resend HTTP API and design toward a PostgreSQL outbox plus signed webhook state. Do not adopt the SMTP relay as the final architecture, and do not migrate the current full-intake email content.

This recommendation does not require superseding an accepted ADR. It follows ADR-0001's single-container deployment, ADR-0003's ordered additive migration policy, and ADR-0005's principle that external-provider side effects require explicit idempotency and reconciliation. A new ADR is appropriate when the team accepts the provider, message-state model, worker topology, and privacy boundaries—not merely for documenting this feasibility study.
