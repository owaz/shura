# Local end-to-end environment

This runbook configures Shura against the existing development-only Auth0 tenant and an isolated PostgreSQL development database. No production users, credentials, or customer data should be used.

## Secret boundary

Maintain these two local files:

- `shura-backend/.env` contains database credentials and all backend/provider secrets.
- `shura-frontend/.env.local` contains only the five browser-safe `VITE_*` values from `.env.example`.

Both files are ignored by Git. Do not paste their contents into chat, issue descriptions, pull requests, screenshots, or terminal output. The Auth0 tenant domain, SPA client ID, API audience, and Auth0 user subject identifiers are identifiers rather than client secrets, but keeping the user mapping local prevents development account details from entering the repository.

For a new checkout, create the local files in PowerShell:

```powershell
Copy-Item shura-backend\.env.example shura-backend\.env
Copy-Item shura-frontend\.env.example shura-frontend\.env.local
```

Run the copy step whenever either file is missing; both are ignored by Git and never arrive with a checkout.

## 1. Configure the existing Auth0 tenant

Use the existing tenant only while it remains development-only.

### Single Page Application

In the Auth0 Dashboard, create or verify the SPA used by `shura-frontend`:

- Application type: **Single Page Application**.
- Allowed Callback URLs: `http://localhost:3006`.
- Allowed Logout URLs: `http://localhost:3006`.
- Allowed Web Origins: `http://localhost:3006`.
- Allowed Origins (CORS): `http://localhost:3006`.
- Grant types: Authorization Code and Refresh Token.
- Refresh Token Rotation: enabled.

Copy the tenant domain and SPA client ID into `shura-frontend/.env.local`. Do not copy a client secret into the frontend.

### API

Create or verify the Auth0 API used by the backend:

- Signing algorithm: RS256.
- Identifier/audience: use the same exact value for `VITE_AUTH0_AUDIENCE` and `AUTH0_AUDIENCE`.
- Tenant domain: use the same tenant for `VITE_AUTH0_DOMAIN` and `AUTH0_DOMAIN`.
- Claim namespace: keep `AUTH0_CLAIM_NAMESPACE=https://shura.com`.

Deploy the repository Actions to the existing tenant:

1. Add `auth0-actions/01-pre-user-registration-set-role.js` to the Pre User Registration flow.
2. Add `auth0-actions/02-post-login-enforce-status-and-claims.js` first in the Post Login flow.
3. Add `auth0-actions/03-post-login-enforce-admin-mfa.js` after the claims Action.

### Synthetic users

Create three clearly named development users and set their Auth0 `app_metadata`:

| User | `role` | `status` |
| --- | --- | --- |
| E2E client | `client` | `active` |
| E2E therapist | `therapist` | `approved` |
| E2E administrator | `admin` | `active` |

Copy each user's Auth0 `user_id` and email to the corresponding `E2E_*_AUTH0_SUB` and `E2E_*_EMAIL` variables in `shura-backend/.env`. Passwords are entered only through Auth0 Universal Login and must not be stored in either environment file.

### Management API application

For Phase 2 account-management testing, authorize a Machine to Machine application for the Auth0 Management API with only the scopes used by Shura:

- `read:users`
- `update:users`
- `update:users_app_metadata`
- `delete:users`
- `create:user_tickets`

Store its client ID and secret only as `AUTH0_M2M_CLIENT_ID` and `AUTH0_M2M_CLIENT_SECRET` in `shura-backend/.env`. Configure `AUTH0_ROLE_THERAPIST_ID` with the development tenant's therapist role ID if role assignment is being tested.

## 2. Populate local application configuration

In `shura-frontend/.env.local`, populate only:

```dotenv
VITE_API_URL=http://localhost:5001
VITE_WS_URL=http://localhost:5001
VITE_AUTH0_DOMAIN=<existing-development-tenant-domain>
VITE_AUTH0_CLIENT_ID=<spa-client-id>
VITE_AUTH0_AUDIENCE=<api-identifier>
```

In `shura-backend/.env`:

1. Keep `NODE_ENV=development`, `PORT=5001`, and local frontend/backend URLs unchanged.
2. Populate either `DATABASE_URL` or every `DB_*` value, but not a mixture of both approaches.
3. Point only to a development database that is safe to initialize, migrate, and fill with synthetic records.
4. Generate a unique random `JWT_SECRET` of at least 32 characters.
5. Populate the Auth0 tenant, audience, and synthetic identity mapping.
6. Set `E2E_DATABASE_SAFE_TO_MUTATE=true` only after confirming the database target.

Provider variables may remain empty for Phase 1. The preflight command reports those integrations as warnings rather than exposing or requiring their values.

## 3. Prepare the database

Install backend dependencies and run preflight from the backend directory:

```powershell
Set-Location shura-backend
npm install
npm run e2e:preflight
```

Preflight verifies Git ignore rules, frontend/backend configuration parity, the explicit database safety flag, database reachability, migration state, and Auth0 OpenID discovery. It reports variable names and status only, never their values.

For a fresh empty database, initialize the legacy-compatible base tables:

```powershell
npm run e2e:bootstrap
```

Apply migrations twice. The second run must skip every migration:

```powershell
npm run migrate
npm run migrate
npm run e2e:preflight
```

### Migration integration tests

The focused migration suite is separate from ordinary E2E bootstrap. It verifies:

1. migration 016 to 017 upgrade compatibility in a temporary schema
2. `production_schema.sql` plus every numbered migration in a newly created disposable database
3. migration 018 retention-index behavior in a temporary schema

Set `MIGRATION_TEST_DATABASE_URL` to a development-only PostgreSQL database and retain `E2E_DATABASE_SAFE_TO_MUTATE=true`. The configured database role must have `CREATEDB`, because the fresh-bootstrap test creates and force-drops a uniquely named database. Do not use staging or production credentials.

```powershell
$env:MIGRATION_TEST_DATABASE_URL = "<development-only-postgresql-url>"
$env:E2E_DATABASE_SAFE_TO_MUTATE = "true"
npm run test:email-migrations
```

Expected result is three executed tests with zero failures and zero skips. A skipped result means the URL or safety flag is absent and is not migration verification.

Fresh bootstrap deliberately uses a separate database rather than another schema in a populated database. Applied legacy migration 001 contains metadata checks that are not schema-qualified; a schema-only test can therefore observe similarly named columns elsewhere and produce a false migration result. Do not edit migration 001 to accommodate the test because already-applied migrations are immutable.

Seed the synthetic identities and stable portal fixtures:

```powershell
npm run e2e:seed
```

Re-running the seed updates the same synthetic identities and session fixtures instead of creating duplicates. It resets the fixture timestamps relative to the current day, removes reviews left on fixture bookings other than the reviewed fixture, and may release another active therapist assignment belonging to the configured synthetic client. It never creates Auth0 passwords or calls Razorpay.

The seed creates:

- One client, therapist, and administrator linked to the configured Auth0 subjects.
- One active therapist assignment and client preferences.
- Daily 08:00–20:00 UTC availability rules for the synthetic therapist so rescheduling offers slots.
- Upcoming, rescheduled, reviewable, reviewed, and cancelled sessions.
- Synthetic successful payment rows without provider payment IDs.
- Session audit events and client notifications.

## 4. Start and check Phase 1

Run automated checks:

```powershell
Set-Location shura-backend
npm test
```

```powershell
Set-Location shura-frontend
npm install
npm run typecheck
npm run build
```

Start the backend and frontend in separate terminals:

```powershell
Set-Location shura-backend
npm run dev
```

```powershell
Set-Location shura-frontend
npm run dev
```

Verify `http://localhost:5001/api/health`, then open `http://localhost:3006`. Sign in interactively through Auth0 Universal Login so no password is disclosed to Codex or stored in the repository.

Check each role and the following client flows:

- Authentication, logout, refresh, route protection, and role redirects.
- Onboarding, profile, preferences, dashboard, notifications, assigned therapist, and settings.
- Portal booking for paid and covered/free paths, slot-conflict handling, payment-intent recovery, and owned `.ics` downloads.
- Upcoming/past/cancelled session lists and session details.
- Rescheduling, cancellation, review submission, billing modes/history, owned PDF receipts, refund-state visibility, and database persistence.
- Daily quote preparation state unless a qualified human reviewer has approved and activated content; do not activate seeded faith content merely for a smoke test.
- Responsive desktop/mobile layouts, browser console errors, failed network requests, and unauthorized API responses.
- Video join returns the intentional provider-not-configured response until a replacement video provider is selected.

## 5. Add Phase 2 providers

Keep every provider secret in `shura-backend/.env`:

- Auth0 Management API: `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`, and the therapist role ID.
- Razorpay: test-mode key ID, key secret, and a separate test webhook secret. Use a temporary HTTPS tunnel for local webhook delivery.
- Azure Storage: a development account/container and local development connection string.
- Email: a development Resend API key, verified development sender, webhook signing secret, administrative recipient, and `EMAIL_OUTBOX_WORKER_ENABLED=true`. Use a temporary HTTPS tunnel for local webhook delivery and never reuse production credentials.
- Google/Outlook calendars: development OAuth applications. Their local callbacks are `/api/calendar/google/callback` and `/api/calendar/outlook/callback` on port `5001`; use HTTPS tunnel callback URLs when the provider requires public HTTPS.

Test successful provider round trips and failure behavior independently. Video integration remains excluded until its provider is chosen.

## 6. Public repository safety checks

Before every commit or pull request, run from the repository root:

```powershell
.\scripts\check-public-repo.ps1
```

The script confirms the two local files remain ignored, rejects sensitive-looking staged paths, and requires a successful full-history Gitleaks scan. Confirm separately that screenshots, logs, and provider payloads contain no credentials before staging them. Never force-add ignored files. If Gitleaks is not installed, the check fails closed; install it before publishing rather than replacing the scan with manual inspection alone.

If any real secret was ever committed, assume it is compromised even after the file is ignored. Rotate it first, then remove it from Git history before pushing again.
