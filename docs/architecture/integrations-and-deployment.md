# Integrations and deployment

## External integrations

### Auth0

Auth0 provides Universal Login, RS256 API tokens, role/status metadata, admin MFA, user blocking/deletion, password-change tickets, and therapist role assignment. Required frontend/backend variables and tenant Actions are described in [authentication and security](authentication-and-security.md) and the local E2E runbook.

### Azure Blob Storage

All new backend image uploads use `services/azureBlobStorage.js` and a private container (default `shura-images`). Production prefers Managed Identity; local/legacy deployments may use a connection string. The runtime needs blob data write/delete permission and user-delegation SAS permission. Database rows store stable blob names/provider labels; responses produce short-lived read-only URLs. Existing external/Cloudinary URLs remain readable but are not used for new uploads.

### Razorpay

Razorpay order/payment/refund and signed webhook flows are server-side. Required secrets are `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a distinct `RAZORPAY_WEBHOOK_SECRET`. Webhook configuration must preserve the raw request body for verification. Use test-mode credentials and synthetic data outside production.

### Email

Application helpers enqueue typed email intent in PostgreSQL and never call the provider synchronously. `utils/emailWorker.js` claims ready rows with `SKIP LOCKED`; `utils/resendAdapter.js` sends through the Resend HTTPS API with stable idempotency keys. `POST /api/webhooks/resend` verifies signed raw payloads and advances accepted messages to delivered, bounced, or complained without allowing stale events to downgrade later state.

Production requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `ADMIN_EMAIL`, and an explicit `EMAIL_OUTBOX_WORKER_ENABLED` value. Setting the worker switch to `false` pauses claims while preserving new pending messages. Terminal message payloads and old webhook dedupe rows are purged after 30 days; minimal delivery metadata remains. See [email delivery](email-delivery.md) and [ADR-0006](../decisions/0006-resend-durable-email-delivery.md).

### Google and Outlook calendars

Therapists connect calendars through OAuth callbacks under `/api/calendar/<provider>/callback`. Google credentials use `GOOGLE_CALENDAR_*`; Microsoft credentials use `OUTLOOK_CALENDAR_*`. `BACKEND_URL` or explicit redirect variables must match registered callbacks. Tokens are AES-256-GCM encrypted before database storage using `CALENDAR_TOKEN_SECRET`; production requires it. Scopes permit profile lookup and calendar event read/write/free-busy behavior.

### Monitoring

When `APPLICATIONINSIGHTS_CONNECTION_STRING` is set, startup enables Azure Monitor OpenTelemetry. The email outbox has its own durable worker; the repository has no general-purpose job runner, structured logging framework, or documented alert definitions.

### Video

No external video provider is selected or configured. The adapter in `services/video/videoProvider.js` intentionally fails room/access operations. Legacy WebRTC/Socket.IO code is not a substitute for a production provider.

## Environment boundaries

- `shura-frontend/.env.local`: only the five allowlisted browser-safe `VITE_*` URL/Auth0 identifiers.
- `shura-backend/.env`: database and every provider secret/credential.
- Never commit either file, log values, include them in screenshots, or pass production values to local E2E tooling.

`shura-backend/.env.example` and `.env.production.example` list current variable names. Optional provider groups can be absent, but the corresponding feature must fail explicitly and safely.

## Container image

The root multi-stage `Dockerfile` uses Node 20 Alpine:

1. Install frontend dependencies with `npm ci` and build the Vite bundle using `VITE_*` build arguments.
2. Install production backend dependencies with `npm ci --omit=dev`.
3. Copy backend source and the frontend `dist` output into `/app/public`.
4. Run `node server.js` on port 5001 and health-check `/api/health`.

Express serves static assets and an SPA fallback only when `NODE_ENV=production`.

## Azure Container Apps delivery

`.github/workflows/deploy-aca.yml` runs on pushes to `main`, builds and pushes SHA/latest tags to Azure Container Registry, deploys staging, then deploys production using GitHub environments. Both apps share one Container Apps environment and external ingress on port 5001.

The workflow currently does not run backend tests, frontend typecheck/build as separate quality gates, database migrations, smoke tests, or automatic rollback. It also contains stale Cloudinary secret mappings and omits several current Azure Blob, Razorpay, calendar, and DB TLS variables. Resend variables and the enabled outbox worker are configured, but required Container App secret values must exist before deployment. Actual environment secrets might also be configured outside the YAML, which cannot be established from the repository.

Before relying on the pipeline for production, reconcile the workflow with `.env.production.example`, add safe migration orchestration, and define verification/rollback behavior. Do not place secrets directly in workflow text.

## Scaling constraints

The HTTP API is mostly stateless apart from in-memory Socket.IO connection state. The current Socket.IO setup has no Redis or other cross-replica adapter, so rooms and broadcasts do not span multiple replicas. Scaling the Container App above one active replica can break realtime delivery unless a shared adapter/sticky-session strategy is added and documented.

PostgreSQL and external providers remain shared services. Concurrency-sensitive database operations use locks/constraints. Email uses its PostgreSQL outbox across replicas; calendar side effects have no shared queue.
