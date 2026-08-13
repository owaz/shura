# Backend and API architecture

## Runtime composition

`shura-backend/server.js` creates one Express 5 application and HTTP server, attaches Socket.IO, configures CORS, JSON parsing, security headers, rate limiters, route modules, health endpoints, production static serving, and a final error handler. The backend uses CommonJS modules and direct `pg` queries; there is no ORM or dependency-injection framework.

`db/index.js` creates a shared PostgreSQL pool from `DATABASE_URL` or individual `DB_*` values. Production and explicit `DB_SSL=true` connections use TLS with certificate verification disabled; see security risks in the repository assessment before changing this behavior.

## Route families

| Mount | Primary responsibility |
| --- | --- |
| `/api/auth` | Auth0 session projection, public approved therapists, client/therapist profiles, questionnaire, legacy-disabled auth endpoints, reflections |
| `/api/admin`, `/api/admin/auth` | admin assignment, therapist/client lifecycle, statistics/profile; password login is disabled |
| `/api/client` | client bootstrap, onboarding, profile/preferences, assigned therapist, account lifecycle; mounts `/sessions` |
| `/api/bookings` | therapist availability/blocked times, public slots, legacy booking management |
| `/api/payments` | Razorpay orders, verified finalization, webhook, payment lists |
| `/api/intake`, `/api/therapist/intake` | issue/consume intake links and assigned-client intake access |
| `/api/chats` | assignment-scoped conversations and messages |
| `/api/calendar` | therapist Google/Outlook OAuth and integration state |
| `/api/upload` | authenticated image validation, sanitization, and Azure Blob upload |
| `/api/calls` | legacy/placeholder call endpoints, not the secure video-provider contract |
| `/api/newsletter`, `/api/platform` | newsletter mutation and client-facing platform configuration |
| `/api/dev` | development-only login helpers; routes self-reject in production |

`/api/health`, `/ping`, and `/db-time` are server-level health/diagnostic endpoints. `/db-time` reveals database error text on failure and should not be considered a minimal public health endpoint.

## Middleware and response conventions

- `middleware/auth.js`: Auth0 access-token verification and local identity mapping.
- `middleware/requireClient.js`: client role enforcement and `req.clientId` projection.
- `middleware/csrf.js`: permits bearer-token mutations and rejects future unauthenticated cookie mutations.
- Server-level and route-level `express-rate-limit` instances limit broad classes of requests.

Newer client portal routes use `{ data, pagination }` and structured `{ error: { code, message, details } }` responses from `utils/apiResponse.js`. Older routes return several incompatible shapes. Preserve compatibility intentionally; prefer the structured format for new APIs and update callers together.

## Service and policy boundaries

- Auth0 Management API: `services/auth0Management.js`
- Azure Blob: `services/azureBlobStorage.js`
- Razorpay refunds: `services/razorpayRefunds.js`
- Video provider contract: `services/video/videoProvider.js`
- Calendar OAuth/event sync: `utils/calendarIntegrations.js`
- Email templates/delivery: `utils/emailService.js`
- Assignment scoring: `utils/matchingService.js`
- Client portal validation/mapping and session policy: `utils/clientPortalValidation.js`, `utils/clientTherapist.js`, `utils/clientSessionPolicy.js`

Keep provider-specific code behind these boundaries. Route handlers may orchestrate transactions and provider calls but must not expose provider credentials or raw sensitive provider errors.

## Realtime architecture

Socket.IO verifies an Auth0 access token during handshake and joins `user:<role>:<local-id>`. Chat mutations persist messages first, then emit to the client and therapist rooms.

Call signaling has both room-based legacy events and older global `io.emit` events. The global offer/answer/candidate/end events ignore their `to` target and broadcast to every authenticated socket. Do not build new calling features on these events; replace them with ownership-validated session rooms and the video-provider abstraction.

## Error and side-effect model

Database transactions protect many booking, payment, onboarding, cancellation, and reschedule changes. Email and calendar synchronization are often dispatched after commit and failures are logged or stored, so they are eventually consistent rather than atomic. Any retry or job mechanism added later must be idempotent.

Several older route catch blocks send `err.message`; avoid extending that pattern because database/provider details can leak. Use stable public error codes and log redacted internal context.
