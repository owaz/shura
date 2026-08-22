# Azure Container Apps deployment runbook

This is the current repository-backed production delivery guide. The root `Dockerfile`, `.github/workflows/deploy-aca.yml`, current environment examples, ordered migrations, and deployed Azure resource state outrank this page if they differ. The repository cannot prove which secrets, identities, database migrations, or revisions are configured in Azure, so verify them before every release.

## Deployed shape

- One multi-stage Node 24 Alpine image builds the React/Vite SPA, installs production backend dependencies, copies the SPA into `shura-backend/public`, and starts `node server.js` on port 5001.
- Express serves the SPA, REST API, and Socket.IO from one process. The container health check calls `/api/health`.
- `.github/workflows/deploy-aca.yml` gates the image on backend tests, frontend typecheck/build, isolated PostgreSQL migration tests, and Gitleaks; it then deploys staging, runs health/authorization smoke checks, and promotes through protected GitHub environments.
- Database changes remain separately human-approved through `.github/workflows/migrate-database.yml`; deployment does not apply them and rollback is never automatic.
- Socket.IO has no cross-replica adapter. Keep one active replica unless a shared adapter and routing strategy have been implemented and verified.

See [ADR-0001](decisions/0001-monorepo-single-production-container.md) and [Integrations and deployment](architecture/integrations-and-deployment.md) for the durable architecture and current limitations.

## Pre-deployment verification

Use Node.js 24.19.0 and npm 11; install from lockfiles:

```powershell
Set-Location shura-backend
npm ci
npm test

Set-Location ../shura-frontend
npm ci
npm run typecheck
npm run build
npm run test:e2e
npm run test:a11y

Set-Location ..
.\scripts\check-public-repo.ps1
```

The public-repository check requires Gitleaks and fails closed if it is unavailable. Also build the production image before a release that changes dependencies, Docker configuration, build-time variables, or static routing:

```bash
docker build -t shura-app:verify .
```

Do not treat a successful image build as provider, database, or Auth0 end-to-end verification.

## Configuration inventory

Frontend values are Docker build arguments and become public bundle data:

- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_API_URL`
- `VITE_WS_URL`

For the single-container same-origin deployment, API and WebSocket URLs should use the deployed app origin. Never put a client secret or provider credential in a `VITE_*` value.

Backend runtime configuration belongs in Container App secrets/environment variables. Reconcile the app with `shura-backend/.env.production.example` and the variables read by current source. Provider groups include:

- PostgreSQL: `DATABASE_URL` or the complete `DB_*` set; production defaults to TLS with certificate verification, rejects `DB_SSL_REJECT_UNAUTHORIZED=false`, and optionally accepts `DB_SSL_CA_CERT`.
- Auth0: domain, audience, claim namespace, Management API client credentials, and therapist role ID.
- Azure Blob Storage: account/container/SAS TTL and optional user-assigned identity client ID. Production uses Managed Identity; do not store an account key when identity access is available.
- Razorpay: key ID, key secret, and a distinct webhook secret.
- Email: Resend API key, verified sender, webhook signing secret, administrative recipient, and explicit outbox worker switch.
- Calendars: token-encryption secret, backend URL, and optional Google/Outlook OAuth credentials and exact callback URLs.
- Observability and web boundaries: Application Insights connection string, frontend/origin allowlists, and cookie same-site mode.

The checked-in workflow maps current Azure Blob, Razorpay, Resend, Auth0, monitoring, and strict database-TLS variables. Calendar credentials remain environment-managed because they are optional. Confirm every referenced Container App secret and provider permission exists before promotion; workflow text never contains secret values.

### Resend email configuration

Create these Container App secrets before deploying a revision that references them:

- `resend-api-key`: environment-specific Resend API credential
- `resend-from-email`: sender on a verified Resend domain
- `resend-webhook-secret`: signing secret for that environment's webhook
- `admin-email`: monitored mailbox authorized to receive internal application alerts

The workflow maps them to `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, and `ADMIN_EMAIL`, and sets `EMAIL_OUTBOX_WORKER_ENABLED=true`. The administrative mailbox may differ from the verified sender. Never place any of these values in frontend build variables.

Configure each environment in Resend with `https://<environment-host>/api/webhooks/resend` and the delivered, bounced, complained, and failed email events. Staging and production must not share webhook signing secrets. Apply migrations 017 and 018 before deploying the runtime.

For a provider incident, setting `EMAIL_OUTBOX_WORKER_ENABLED=false` pauses claims but continues queue insertion and 30-day privacy cleanup. It does not switch to another provider. Re-enable only after testing a controlled message and signed webhook round trip.

## Identity and least privilege

- GitHub deployment credentials should be scoped to the required resource group/resources.
- The Container App Managed Identity needs `Storage Blob Data Contributor` and `Storage Blob Delegator` at the narrowest practical storage scope.
- Auth0 tenant Actions in `auth0-actions/` are required deployment artifacts. The API audience, action claim namespace, callback/logout/origin URLs, and Management API scopes must match the environment.
- PostgreSQL, Razorpay, Auth0, calendar, email, and storage credentials must be environment-specific. Never copy production credentials into local E2E files.

Use root `DEPLOYMENT_GUIDE.md` for the Auth0-specific checklist and `shura-backend/AZURE_BLOB_STORAGE.md` for storage permissions.

## Database release order

Database changes are not applied by the deployment workflow. Dispatch `migrate-database.yml` only from `main`; the job rejects other refs, checks out the selected immutable `main` SHA, and still requires the protected environment plus its exact confirmation string.

1. Resolve the exact target database and confirm whether it is a truly empty database or an existing installation.
2. For a new empty database only, deliberately apply `shura-backend/production_schema.sql` once to create the legacy-compatible base.
3. From `shura-backend`, run `npm run migrate`. Current migrations are `001` through `018`; the migrator records filenames in `schema_migrations` and skips applied files.
4. Run the migrator a second time and confirm every migration is skipped.
5. Never run the disposable E2E bootstrap/seed against staging or production, and never edit an already-applied migration.

For a release containing a new migration, verify both a base-schema-plus-all-migrations install and an upgrade from the preceding state before applying it to staging. Plan backward compatibility between the old and new app revisions and the migrated schema.

Migrations 017 and 018 are backward-compatible prerequisites for the Resend-only email runtime. Apply and verify both in staging and production before deployment. Migration 017 adds the delivery states while retaining legacy `sent` compatibility; migration 018 adds the complete accepted/terminal retention index.

The `Email migration tests` GitHub workflow performs PostgreSQL 16 verification only; it never migrates an environment. Its fresh-bootstrap case creates and drops an isolated database using a CI role with `CREATEDB`, while upgrade cases use temporary schemas. This separation prevents applied legacy migrations with unqualified metadata checks from seeing similarly named tables in another schema. Do not grant `CREATEDB` to the production application role and do not treat a passing workflow as evidence that staging or production migrations were applied.

## Staging and production rollout

1. Verify the image tag is immutable and matches the intended commit.
2. Apply required database migrations to staging using an explicitly controlled job or operator session.
3. Deploy staging and smoke-test `/api/health`, SPA routing, Auth0 login/role routing, protected API rejection, database access, and every provider touched by the release. For Resend, verify one controlled message reaches `accepted` and then webhook-confirmed `delivered`.
4. Inspect logs without exposing tokens, webhooks, intake data, messages, calendar tokens, or signed blob URLs.
5. Apply production migrations in the planned compatibility window.
6. Deploy the same verified image to production through the protected GitHub environment.
7. Repeat health, authentication, core client-flow, and touched-provider smoke tests. Verify the active Container App revision, migrations 017/018, outbox worker setting, and webhook state transition.

Provider delivery is eventually consistent in several flows. A successful booking or cancellation does not prove email, calendar sync, or refund completion; inspect the durable state designed for each integration.

## Rollback

The workflow has no automatic rollback. Before production deployment, identify the previously healthy immutable image/revision and define who can reactivate it. Application rollback does not reverse database migrations or external provider side effects. Prefer additive, backward-compatible migrations; if a new revision must be rolled back, confirm the old revision can operate safely against the migrated schema. Follow [Production readiness and incident operations](PRODUCTION_READINESS.md) for alert and reconciliation steps.

## Production readiness boundaries

Do not call the whole platform production-ready solely because the container deploys:

- Secure video/audio is intentionally unconfigured.
- Therapist payments/chat/calls and some legacy/public surfaces remain partial or mock-backed.
- Paid slot conflicts can require a visible refund workflow; no general reconciliation worker exists.
- Email/calendar/provider work has no durable shared job queue.
- Actual Azure alerting, secret completeness, migration state, backup/restore, scaling, and rollback readiness require live-environment verification.
