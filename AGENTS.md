# Shura agent guide

Shura is a faith-centered mental-health platform for clients, therapists, and administrators. It supports therapist discovery and approval, client onboarding and intake, therapist assignment, booking and payment, messaging, session management, and calendar integration. Some user-facing areas remain placeholders; do not describe an unfinished flow as production-ready.

## Start here

- Read [the documentation index](docs/README.md), then the relevant architecture and product pages before changing code.
- Architectural decisions live in [docs/decisions](docs/decisions/README.md). Do not contradict an accepted ADR without calling it out and updating or superseding the ADR.
- Treat source and ordered migrations as authoritative when older guides disagree. The documentation index identifies known legacy material.

## Repository map

- `shura-frontend/`: React 19 + TypeScript + Vite 6 SPA. Routes are composed in `App.tsx`; shared API/Auth0 state is in `config/api.ts` and `contexts/AuthContext.tsx`.
- `shura-backend/`: CommonJS Node.js, Express 5, PostgreSQL, Socket.IO, routes, services, migrations, and Node test files.
- `auth0-actions/`: required Auth0 registration/login policy and custom-claim actions.
- `docs/`: canonical architecture, product, decisions, deployment, and local E2E guidance.
- `.github/workflows/deploy-aca.yml`, `Dockerfile`: single-image Azure Container Apps deployment.
- `WORD/` and design-image folders: product/reference source material, not executable or automatically authoritative.

## Architectural constraints

- Auth0 RS256 access tokens are the active API identity boundary. Enforce authorization again in backend routes; frontend guards are UX only.
- Auth0 `sub` maps to local `users`, `therapists`, or `admins` records. Keep Auth0 metadata/status and local status transitions consistent.
- PostgreSQL is the durable source of truth. Use parameterized queries and transactions for multi-row state changes.
- Preserve the one-active-therapist-per-client invariant and the no-overlapping-active-booking invariant. Scheduling and payment finalization require concurrency control.
- Store new images in a private Azure Blob container and return short-lived read URLs. Keep browser bundles free of secrets.
- The production container serves the built SPA and API/Socket.IO from one Express process. Video provider support is intentionally unconfigured.

See [system overview](docs/architecture/system-overview.md), [authentication and security](docs/architecture/authentication-and-security.md), and [data model](docs/architecture/data-model.md).

## Durable business rules

- Roles are `client`, `therapist`, and `admin`. Admins cannot self-register; therapist self-registration starts pending; restricted Auth0 flows enforce verification, status, login method, and admin MFA.
- Only approved therapists are publicly discoverable. Therapist status transitions are constrained and synchronized to Auth0 when a linked identity exists.
- A client may have at most one active therapist assignment. Assignment history is retained through statuses such as `released` or `inactive`.
- Intake links are random, single-use, and expire after seven days. Intake data is sensitive and visible only through authorized assignment/admin paths.
- Supported session modes are `video`, `audio`, and `text`; supported portal durations are 30, 50, and 80 minutes.
- Default session policy: join opens 10 minutes before start; rescheduling and refundable cancellation use 24-hour cutoffs. Values are configurable in `platform_settings`.
- Paid-slot booking is finalized only after Razorpay signature verification; webhook event IDs provide idempotency and database locks/indexes protect slot consistency.

See [domain model and rules](docs/product/domain-model-and-rules.md) and [user workflows](docs/product/workflows.md).

## Development commands

Use Node.js 20 and npm. Run commands from the indicated package directory.

```powershell
# install
Set-Location shura-backend; npm install
Set-Location ../shura-frontend; npm install

# backend
Set-Location ../shura-backend
npm run dev
npm test

# frontend
Set-Location ../shura-frontend
npm run dev
npm run typecheck
npm run build
```

There is no configured lint command and no frontend automated test command. Do not claim otherwise. The frontend default is `http://localhost:3006`; the documented backend default is `http://localhost:5001` when `PORT=5001` is set.

For a fresh disposable development database, follow [docs/LOCAL_E2E_SETUP.md](docs/LOCAL_E2E_SETUP.md): explicitly confirm the database is safe to mutate, run `npm run e2e:bootstrap`, then `npm run migrate`. `npm run migrate` alone does not create every legacy base table on an empty database.

Before publishing, run `scripts/check-public-repo.ps1`; it requires Gitleaks and fails closed when Gitleaks is unavailable.

## Change rules

- Database/schema: add a new numbered, additive SQL file under `shura-backend/migrations/`; never edit an already-applied migration. Test fresh bootstrap plus migrations and upgrade from the previous state. Do not add more runtime DDL to `server.js`.
- Auth/security: update backend enforcement, Auth0 Actions/configuration, tests, and docs together. Never trust role, owner, price, or status values supplied only by the browser.
- External integrations: keep credentials server-side, verify provider signatures/state, make retries idempotent, preserve failure state, and document required environment variables and least-privilege permissions.
- API changes: preserve intentional compatibility or version/break the consumer deliberately; update frontend callers, error shapes, and relevant docs.
- Tests: add focused Node tests for backend policy/validation code. For frontend changes, at minimum run typecheck and build plus targeted manual verification.
- Existing work: the working tree may contain user changes. Do not reset, overwrite, or reformat unrelated files.

## Security and privacy

This system handles mental-health intake, messages, identity, scheduling, and payment metadata. Minimize returned fields and logs; never expose intake answers, access/refresh tokens, calendar tokens, SAS URLs, Auth0 secrets, payment secrets, raw webhooks, or local `.env` contents. Use ownership/role checks on every protected lookup and mutation. Treat CORS, Socket.IO rooms, uploads, account deletion, refunds, and provider callbacks as security-sensitive.

## Documentation maintenance

At the completion of every task, determine whether the change introduced or discovered durable project knowledge. If so, update the appropriate documentation or ADR. Do not update documentation merely to record that the task occurred.

Update permanent documentation when a change materially affects architecture, business rules, public APIs, database schemas, authentication/authorization, security assumptions, infrastructure, external integrations, or a significant architectural decision.

**Document durable knowledge, not task history.** Information belongs here when a future developer or agent needs it to understand or safely modify the system. Routine implementation history belongs in commits, pull requests, and issues.
