# Node.js 24 Migration Notes

## Scope

This migration moves the repository baseline from Node.js 20 to Node.js 24.19.0
with npm 11. The backend remains CommonJS and the frontend remains an ESM
Vite application.

## Runtime and deployment changes

- Added `.nvmrc` and `.node-version`, both pinned to `24.19.0`.
- Added Node/npm engine constraints to both package manifests:
  - Node.js `>=24.0.0 <25`
  - npm `>=11`
- Updated Docker build and production stages to `node:24.19.0-alpine`.
- Updated all repository GitHub Actions Node setup steps to `24.19.0`.
- Updated canonical and legacy deployment documentation to identify the
  Node.js 24.19.0/npm 11 baseline.

## Dependency and compatibility work

- Regenerated both package lockfiles with Node.js 24.19.0 and npm 11.17.0.
- Confirmed clean `npm ci` installs for the backend and frontend.
- Rebuilt and loaded the backend `argon2` native module under Node.js 24.
- Confirmed `argon2` and `bcryptjs` hashing behavior.
- Replaced stale development-only `require('bcrypt')` calls with the installed
  `bcryptjs` package.
- Audited the requested Node.js 24 codemod targets; no applicable legacy API
  usage was found.
- Backend and frontend dependency audits reported zero vulnerabilities.

## Verification completed

- Backend tests: 113 passed, 3 skipped, 0 failed.
- Frontend typecheck and production build passed.
- Backend startup passed with `npm start`, `npm run dev`, and
  `node --throw-deprecation server.js`.
- PostgreSQL migrations completed successfully; migrations 001 through 018
  were already applied in the disposable verification database.
- Docker image build succeeded using the pinned Node.js 24.19.0 Alpine image.
- Container health verification succeeded.
- Container shutdown logged the expected email-worker drain message.
- Auth0 client login verification succeeded with the configured frontend
  environment: Universal Login completed, the callback returned to the local
  app, the local session endpoint resolved the client, and the portal home
  rendered an authenticated session.

The local verification used an ignored `shura-backend/.env` and a disposable
database. No environment file or credential was added to the repository.

## Deferred verification

The following require intentionally provisioned provider credentials or a
deployed environment and were not validated by this migration:

- Auth0 registration, status, and MFA flows
- Razorpay payment, signature, webhook, refund, and idempotency flows
- Socket.IO client reconnect and signalling behavior
- Azure Blob upload and private read URL behavior
- Resend delivery and failure handling
- Deployed CORS and Azure Container Apps behavior
- Concurrent PostgreSQL booking/load scenarios
- Application Insights telemetry

## Deployment follow-up

Before production rollout, verify that the deployment environment uses
Node.js 24.19.0-compatible tooling and the pinned `node:24.19.0-alpine` image.
Run the provider-backed checks above with non-production credentials where
possible, then perform the documented migration and rollback checks in
`docs/DEPLOYMENT_GUIDE.md` and `docs/PRODUCTION_READINESS.md`.
