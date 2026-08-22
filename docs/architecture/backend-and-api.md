# Backend and API architecture

## Runtime composition

`shura-backend/server.js` creates one Express 5 application and HTTP server, attaches Socket.IO, configures CORS, JSON parsing, security headers, rate limiters, route modules, health endpoints, production static serving, and a final error handler. The backend uses CommonJS modules and direct `pg` queries; there is no ORM or dependency-injection framework.

`db/index.js` creates a shared PostgreSQL pool from `DATABASE_URL` or individual `DB_*` values. Production enables TLS by default and requires certificate verification. `DB_SSL_CA_CERT` may provide an explicit CA. Disabling certificate verification is a local-development-only exception and production startup rejects it.

## Route families

| Mount | Primary responsibility |
| --- | --- |
| `/api/auth` | Auth0 session projection, public approved therapists, client/therapist profiles, questionnaire, legacy-disabled auth endpoints, reflections |
| `/api/admin`, `/api/admin/auth` | admin assignment, therapist/client lifecycle, statistics/profile; password login is disabled |
| `/api/client` | client bootstrap, home dashboard, notifications, onboarding, profile/preferences, assigned therapist, booking/availability/recovery/calendar download, billing/receipts, account lifecycle; mounts `/sessions` |
| `/api/bookings` | therapist availability/blocked times, public slots, legacy booking management |
| `/api/payments` | Razorpay orders, verified finalization, webhook, payment lists |
| `/api/intake`, `/api/therapist/intake` | issue/consume intake links and assigned-client intake access |
| `/api/chats` | assignment-scoped conversations and messages |
| `/api/calendar` | therapist Google/Outlook OAuth and integration state |
| `/api/upload` | authenticated image validation, sanitization, and Azure Blob upload |
| `/api/video` | authenticated secure video-session API (`POST /sessions/:bookingId/join`) for assigned client/therapist access tokens |
| `/api/calls` | legacy/placeholder call endpoints, not the secure video-provider contract |
| `/api/newsletter`, `/api/platform` | newsletter mutation and client-facing platform configuration |
| `/api/webhooks/resend` | signed Resend lifecycle events correlated to durable email outbox rows |
| `/api/dev` | development-only login helpers; routes self-reject in production |

`/api/health`, `/ping`, and `/db-time` are server-level health/diagnostic endpoints. `/db-time` reveals database error text on failure and should not be considered a minimal public health endpoint.

## Middleware and response conventions

- `middleware/auth.js`: Auth0 access-token verification and local identity mapping.
- `middleware/requireClient.js`: client role enforcement and `req.clientId` projection.
- `middleware/csrf.js`: permits bearer-token mutations and rejects future unauthenticated cookie mutations.
- Server-level and route-level `express-rate-limit` instances limit broad classes of requests.

Newer client portal routes use `{ data, pagination }` and structured `{ error: { code, message, details } }` responses from `utils/apiResponse.js`. Older routes return several incompatible shapes. Preserve compatibility intentionally; prefer the structured format for new APIs and update callers together.

Current client booking contracts are:

- `GET /api/client/booking-options/:therapistId`
- `GET /api/client/availability/:therapistId?from=YYYY-MM-DD&to=YYYY-MM-DD&sessionType=video&durationMinutes=50`
- `POST /api/client/bookings`
- `POST /api/client/bookings/verify-payment`
- `GET /api/client/bookings/intents/:orderId`
- `GET /api/client/bookings/:bookingId/calendar.ics`

All are client-authenticated. Therapist eligibility is selected through the authenticated client's active assignment rather than a browser owner ID, and calendar/intent recovery queries include client ownership.

Current client-home and notification contracts are:

- `GET /api/client/dashboard` returns the client greeting/timezone/member date, aggregate session counts, the next active session with server-computed actions, the active approved therapist summary, and feature flags in one request.
- `GET /api/client/notifications/count` and `GET /api/client/notifications?page=&limit=` are client-owned reads. `PATCH /api/client/notifications/:id/read` and `PATCH /api/client/notifications/read-all` are ownership-scoped mutations. The API derives navigation actions from known event types and does not expose or trust arbitrary metadata URLs.
- `GET /api/platform/quote-of-the-day` selects deterministically for the server's current UTC date from rows that are both active and human-approved. It returns an explicit null quote when none qualify.

Dashboard summary queries run in parallel to avoid a browser waterfall. Notification writes use `services/clientNotifications.js` with optional per-client deduplication keys; booking/session, payment/refund, assignment, and release events may be eventually consistent with their originating provider side effect.

Current client-billing contracts are:

- `GET /api/client/billing/summary` returns the server-owned billing mode, one-time-at-booking payment capability, upcoming-session payment/coverage state, and the configured refund policy.
- `GET /api/client/billing/transactions?page=&limit=` returns a client-owned, deduplicated projection over payment rows and unmatched booking intents. This preserves pending/failed checkouts and captured slot-conflict refund states that may have no payment row.
- `GET /api/client/billing/receipt/:id` accepts only typed IDs returned by the history API, rechecks ownership in SQL, and generates a private, non-cacheable PDF from payment and appointment metadata.

The billing API never returns Razorpay signatures, webhook payloads, card data, provider secrets, failure details, therapy notes, intake responses, or messages. Current Razorpay checkout does not implement saved payment methods or scheduled future charges.

Current secure-video contract implemented in this phase:

- `POST /api/video/sessions/:bookingId/join` is bearer-authenticated and derives caller role/identity server-side from Auth0 claims.
- Authorization checks run on every token request: assigned client/therapist ownership, joinable booking status, non-text mode, payment/refund eligibility, non-terminal video status, and UTC join-window boundaries from `scheduled_at` plus `duration_minutes`.
- Missing booking, cross-account booking, and non-client/therapist role all return `403 SESSION_ACCESS_DENIED` to avoid ownership/existence leakage.
- Room and token provisioning remains server-only; browser callers never submit room names, participant IDs, or role assertions.
- Legacy `POST /api/client/sessions/:id/join` remains intentionally gated for provider-backed non-text joins until the dedicated session-page consumer migration is complete.

## Service and policy boundaries

- Auth0 Management API: `services/auth0Management.js`
- Azure Blob: `services/azureBlobStorage.js`
- Razorpay refunds: `services/razorpayRefunds.js`
- Client PDF receipts: `services/clientReceiptPdf.js`
- Client booking orchestration: `services/clientBookingService.js`
- Client notification insertion: `services/clientNotifications.js`
- Video provider contract: `services/video/videoProvider.js`
- Video session orchestration and join authorization: `services/video/videoSessionService.js`, `utils/videoJoinPolicy.js`
- Calendar OAuth/event sync: `utils/calendarIntegrations.js`
- Email templates/enqueueing: `utils/emailService.js`, `utils/emailOutbox.js`
- Resend provider/worker/configuration: `utils/resendAdapter.js`, `utils/emailWorker.js`, `utils/emailConfig.js`
- Assignment scoring: `utils/matchingService.js`
- Client portal validation/mapping and session policy: `utils/clientPortalValidation.js`, `utils/clientTherapist.js`, `utils/clientSessionPolicy.js`

Keep provider-specific code behind these boundaries. Route handlers may orchestrate transactions and provider calls but must not expose provider credentials or raw sensitive provider errors.

## Realtime architecture

Socket.IO verifies an Auth0 access token during handshake and joins `user:<role>:<local-id>`. Chat mutations persist messages first, then emit to the client and therapist rooms.

Legacy call signaling events are not registered. Socket.IO is limited to server-derived user rooms used by persisted chat notifications. A future calling implementation must use ownership-validated session rooms and the video-provider abstraction.

## Error and side-effect model

Database transactions protect many booking, payment, onboarding, cancellation, and reschedule changes. Active email intent is inserted in those domain transactions where practical, then delivered asynchronously and idempotently through the outbox. Calendar synchronization and refunds remain external post-commit work and must preserve explicit failure state.

Several older route catch blocks send `err.message`; avoid extending that pattern because database/provider details can leak. Use stable public error codes and log redacted internal context.
