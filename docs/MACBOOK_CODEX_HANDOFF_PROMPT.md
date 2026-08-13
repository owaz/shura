# Shura MacBook Codex handoff prompt

Copy everything below the divider into a new Codex task after cloning the repository on the MacBook.

---

You are continuing implementation of **Shura**, a faith-centered Muslim mental-health platform with the tagline **“Where Faith Meets Healing.”** Work in the cloned Shura repository and treat this prompt as project handoff context, not as a substitute for inspecting the current checkout.

## Immediate objective

Continue the authenticated **client portal** from **Milestone 5 onward**. Milestones 1–4 have been implemented and merged. Do not reimplement them. Begin by auditing the checkout, then implement only the milestone I explicitly request (for example, “Implement Milestone 5”). Complete, test, and report that milestone before beginning a later one.

## Repository and continuation point

- GitHub repository: `https://github.com/owaz/shura.git`
- Windows repository path before migration: `C:\Projects\Shura\shura-repo`
- `main` contains Milestones 1–4, including the Milestone 4 performance follow-up.
- Known `main` commit at handoff: `7acc8d9` (`Merge pull request #50 from owaz/agent/milestone-5`).
- PR #50 merged commit `92a4310` (`Establish repository context and local E2E tooling`). It adds canonical architecture/product docs, `AGENTS.md`, local E2E setup/seed tooling, and public-repository safety checks. Despite the historical branch name, it does **not** implement Milestone 5 business functionality.
- Start new work from the latest `origin/main`; do not resume the historical `agent/milestone-5` branch merely because of its name.
- The working tree was clean before this handoff document was created.

On the Mac, begin with read-only checks similar to:

```bash
git status --short --branch
git remote -v
git fetch --all --prune
git log --oneline --decorate -20
git branch -a
```

Do not reset, discard, or overwrite user changes. If the checked-out repository has moved beyond the commits named above, treat the newer source, tests, migrations, and accepted ADRs as authoritative.

## Required repository orientation

Before changing code:

1. Read `AGENTS.md` completely if present.
2. Read `docs/README.md` and the relevant canonical documents under:
   - `docs/architecture/`
   - `docs/product/`
   - `docs/decisions/`
3. Inspect the current route composition, migrations, APIs, tests, and git status.
4. Treat current source code and ordered migrations as the final authority when old guides disagree.
5. Do not claim an unfinished or placeholder flow is production-ready.

Important canonical documents introduced by the local tooling/context commit include:

- `docs/architecture/system-overview.md`
- `docs/architecture/frontend.md`
- `docs/architecture/backend-and-api.md`
- `docs/architecture/authentication-and-security.md`
- `docs/architecture/data-model.md`
- `docs/architecture/scheduling-and-payments.md`
- `docs/architecture/integrations-and-deployment.md`
- `docs/product/domain-model-and-rules.md`
- `docs/product/workflows.md`
- `docs/LOCAL_E2E_SETUP.md`
- `docs/decisions/README.md`

## Fixed architectural decisions

These decisions were explicitly made and must remain in force unless I later change them:

- **Authentication remains Auth0.** Do not migrate to Microsoft Entra External ID.
- Auth0 Universal Login and audience-bound RS256 access tokens are the identity boundary.
- The backend must validate issuer, audience, signature, expiry, role/status claims, and enforce resource ownership. Frontend guards are UX only.
- Auth0 `sub` maps to local role-specific PostgreSQL records (`users`, `therapists`, or `admins`).
- **Payments remain Razorpay.** Do not replace it with Stripe.
- **Video provider is intentionally undecided.** A future migration may use Daily.co or another provider. Keep video integration behind the provider-neutral interface and do not build new features on the legacy Socket.IO/WebRTC call signaling.
- Frontend remains React 19 + TypeScript + Vite 6 + Tailwind CSS 4.
- Backend remains CommonJS Node.js + Express 5 + direct `pg` PostgreSQL queries.
- Use ordered, additive SQL migrations. Do not introduce Prisma or another ORM.
- Production remains a two-package monorepo built into one container: Express serves the SPA, API, and Socket.IO.
- New profile images use a private Azure Blob container with short-lived read URLs. Retain compatibility for legacy image URLs.
- Therapist assignment continues to use `therapist_clients` and must enforce one active therapist per client.
- Existing integer database keys remain. Add public UUIDs only where justified; do not destructively replace live keys.

Accepted ADRs, if present, cover:

1. Two-package monorepo and one production container
2. Auth0 with local role-specific profiles
3. Ordered additive PostgreSQL migrations
4. Private Azure Blob profile images
5. Payment-verified booking finalization

Do not contradict an accepted ADR silently. Update or supersede it if an architectural decision genuinely changes.

## Product and design context

The client portal is the logged-in client experience only—not the therapist or admin interface. Its visual language should feel like a sanctuary rather than a clinical dashboard:

- Warm off-white/sand background
- Deep teal or warm terracotta primary accents
- Dark charcoal text
- Muted sage success, warm amber warning, muted coral error
- White cards with subtle warm shadows and roughly 12px radius
- Calm, spacious layouts and gentle CTAs
- Minimum 15px body text
- Readable Arabic font such as Amiri or Noto Naskh Arabic with correct RTL rendering

Accessibility target is WCAG 2.1 AA:

- Full keyboard navigation
- Visible focus indicators
- Text contrast of at least 4.5:1
- Semantic HTML and correct labels
- Accessible dialogs with focus trapping/restoration
- Meaningful image alt text
- Screen-reader-compatible status/error feedback
- Reduced-motion support where appropriate

All fetched experiences need skeleton loading, meaningful error/retry states, and contextual empty states. Preference mutations use optimistic UI with rollback. Never leave a blank page or blank table.

## Current implementation state: Milestones 1–4 completed

Do not rebuild these areas. Inspect and extend their existing contracts.

### Milestone 1 — Portal foundation (completed)

Delivered:

- Additive migration `007_client_portal_foundation.sql`
- Client portal route group and responsive `ClientPortalLayout`
- Client onboarding guard and Auth0 role/onboarding routing
- Client-only backend middleware
- Structured API response helpers
- CSRF handling appropriate to bearer-token requests
- Portal bootstrap/settings data
- Placeholder portal home and billing routes
- Provider-neutral video contract at `shura-backend/services/video/videoProvider.js`, intentionally unconfigured

Key behavior:

- Unauthenticated `/portal/*` access goes to `/login`.
- Clients with incomplete onboarding go to `/portal/onboarding`.
- Completed clients go to `/portal/home`.
- Therapist/admin users route to their own interfaces.
- Auth0 claims and local database state, not browser local storage, are authoritative.

### Milestone 2 — Onboarding, profile, and preferences (completed)

Delivered:

- Migrations `009_client_profile_onboarding.sql` and `010_azure_blob_image_storage.sql`
- Five-step resumable onboarding flow
- Database-backed onboarding completion
- Client profile view/edit flows
- Optimistic preference auto-save
- Auth0 password-reset ticket flow
- Account-deletion flow
- Secure profile image upload with signature/type/size validation, image sanitization, and private Azure Blob storage
- Platform option endpoints and validation utilities
- Focused backend tests for validation, storage, and image sanitization

Important rule: onboarding requires first/last name, a valid past birth date, gender, IANA timezone, therapist gender preference, at least one language, and Islamic approach preference. Only the goals step is optional.

### Milestone 3 — Assigned therapist experience (completed)

Delivered:

- Migration `011_client_assigned_therapist.sql`
- Full assigned-therapist portal page and unassigned state
- Approved therapist projection, credentials, specialties, languages, session types/durations, availability preview, rating/review count
- Assignment release confirmation and release endpoint
- Relationship history, therapist notification/email attempt, and redirect to discovery
- Database constraint/helper enforcing at most one active therapist per client
- Focused assignment tests

Assignment release marks history as `released`; it does not delete previous session or relationship records.

### Milestone 4 — Sessions management (completed)

Delivered:

- Migration `012_client_session_management.sql`
- Upcoming, past, and cancelled paginated session tabs
- Session details and client-timezone display
- Live availability for rescheduling
- Transactional rescheduling with row/advisory locking and overlap checks
- Cancellation policy and optional reason
- Razorpay refund initiation/reconciliation state
- Session event audit records, notifications, email, and calendar updates
- Completed-session reviews, one per booking
- Join-window enforcement and provider-neutral video/audio response
- Text-session navigation to assignment-scoped chat
- Focused session-policy tests
- Lazy-loaded frontend route chunks as the Milestone 4 performance follow-up

Current default session policies, configurable through `platform_settings`, are:

- Join opens 10 minutes before start and closes at session end.
- Reschedule cutoff is 24 hours before start.
- Cancellation is allowed until session end.
- Refund eligibility requires a captured/paid payment and cancellation at least 24 hours before start.
- Reviews require a completed session, rating 1–5, optional comment up to 1,000 characters, and only one review per booking.

Relevant existing files include:

- `shura-frontend/pages/client-portal/ClientPortalLayout.tsx`
- `shura-frontend/pages/client-portal/ClientPortalGuard.tsx`
- `shura-frontend/pages/client-portal/ClientOnboardingPage.tsx`
- `shura-frontend/pages/client-portal/ClientProfilePage.tsx`
- `shura-frontend/pages/client-portal/ClientPreferencesPage.tsx`
- `shura-frontend/pages/client-portal/ClientTherapistPage.tsx`
- `shura-frontend/pages/client-portal/ClientSessionsPage.tsx`
- `shura-frontend/pages/client-portal/clientPortalApi.ts`
- `shura-frontend/pages/client-portal/clientPortalTypes.ts`
- `shura-frontend/pages/client-portal/PortalUi.tsx`
- `shura-backend/routes/client.js`
- `shura-backend/routes/clientSessions.js`
- `shura-backend/utils/clientPortalValidation.js`
- `shura-backend/utils/clientTherapist.js`
- `shura-backend/utils/clientSessionPolicy.js`
- `shura-backend/services/razorpayRefunds.js`

## Remaining milestone plan

Implement these milestones in order. Milestone 9 stays deferred until I select a video provider.

# Milestone 5 — Booking flow and Razorpay checkout

## Goal

Allow authenticated clients to book sessions safely using live therapist availability and Razorpay, while preserving free/covered-session behavior.

## Frontend scope

Build a portal-native four-step booking flow, as a modal or portal-contained dedicated route that does not send users out of the portal:

1. **Select session type**
   - Video, audio, or text
   - Brief accessible description for each
   - Default to the client’s saved preference when supported by the therapist
2. **Select duration**
   - 30, 50, or 80 minutes
   - Show server-derived prices when payment is enabled
   - Default to the client’s saved preference when supported
3. **Select date and time**
   - Calendar/slot picker
   - Fetch slots live from the availability API; do not rely on stale cached slots
   - Show the client’s timezone clearly
   - Explain when the therapist’s timezone differs
   - Highlight selected slots and disable unavailable ones
4. **Confirm booking**
   - Therapist, localized date/time, timezone, session type, duration, price/coverage, and payment summary
   - Razorpay checkout when payment is required
   - Free/covered booking path when appropriate
   - Clear success confirmation
   - “Add to Calendar” `.ics` download

Entry points must work from:

- Home empty/upcoming-state CTA when Milestone 6 is implemented
- Sessions empty state or rebook action
- My Therapist “Book a Session” action
- Cancelled-session “Rebook” with therapist/session preferences prefilled where safe

Preserve the user’s selected therapist/type/duration/slot after recoverable failures. Return actionable errors without losing state.

## Backend/API scope

Implement or adapt the client-facing contracts:

- `GET /api/client/availability/:therapistId?from=...&to=...`
- `POST /api/client/bookings`
- Supporting Razorpay order and verified-finalization endpoints
- Booking intent/status recovery endpoint
- `.ics` calendar-download endpoint

Reuse the existing preferred Razorpay payment-intent architecture rather than creating a second payment design:

1. Validate therapist approval, assignment/product rules, type, duration, timezone, and requested slot.
2. Derive price entirely on the server. Never trust browser-supplied price or currency.
3. Create a Razorpay order and durable booking intent; do not reserve the slot just by showing it or opening checkout.
4. Verify Razorpay signatures or signed webhooks.
5. Inside a transaction, lock the intent and therapist/date, recheck availability/blocked time/overlap, and then create confirmed booking/payment records.
6. Make repeated verification/webhook delivery idempotent.
7. If a race takes the slot after payment, preserve explicit conflict/refund/recovery state instead of silently failing.

Support free/covered booking without invoking Razorpay, but use the same transactional availability and overlap protection.

After successful database finalization, trigger confirmation email, client/therapist notification, and calendar synchronization in an idempotent/tolerant way. Provider failures must not create duplicate bookings.

## Milestone 5 verification

- Availability is fetched live and rendered in the client timezone.
- Only approved/eligible therapist offerings can be selected.
- Preference defaults fall back safely when unsupported.
- Database-level and transaction-level checks prevent double booking.
- Paid and free/covered bookings both work.
- The server controls amount and rejects tampered inputs.
- Invalid Razorpay signatures are rejected.
- Replayed verification/webhooks do not duplicate bookings or payments.
- Paid slot conflicts result in durable, visible recovery/refund state.
- Failure does not erase the selected booking state.
- Generated `.ics` works in Google, Apple, and Outlook calendars.
- Existing public booking/payment consumers remain compatible unless intentionally migrated and documented.

# Milestone 6 — Home dashboard, Islamic quote, and notifications

## Goal

Replace the `/portal/home` placeholder with the client’s calm, focused landing experience answering: “What do I need right now?”

## Home dashboard scope

### Upcoming session card

When an upcoming session exists, show a prominent card containing:

- Therapist avatar, full name, and credentials
- Full localized date
- Client-local time and explicit timezone label
- Video/audio/text badge
- Duration
- Join, Reschedule, and Cancel actions using the existing Milestone 4 contracts/dialogs
- Join disabled until the server-backed ten-minute window
- Disabled tooltip explaining availability
- Subtle live-window accent/pulse and countdown such as “Starts in 7 minutes”

When no session exists:

- Warm illustrated empty state
- “You have no upcoming sessions.”
- “Book a Session with [Therapist]” for assigned clients
- “Find a Therapist” for unassigned clients

### Therapist quick card

- Photo, name, specialisation chips
- View Full Profile
- Conditional Message button based on feature flag
- Request Different Therapist link

### Session statistics

- Sessions completed
- Upcoming sessions
- Member since month/year
- No charts

## Islamic quote of the day

- Seed approximately 20 Quran or authentic Hadith quotes relevant to hope, patience, healing, and mental wellbeing.
- Store Arabic text, English translation, source, activation state, and any necessary editorial metadata.
- Use deterministic date-based selection so every client gets the same quote on a given day.
- Decide and document whether the seed date is UTC; keep behavior stable across server regions.
- Render Arabic RTL in a readable Arabic font, translation below, and source reference.
- Use a subtle Islamic geometric texture without reducing legibility.
- Religious text, translation, source, and authenticity require human scholarly/editorial review before production. Do not invent or silently “correct” sacred text.

## Notifications

Implement:

- Unread count in the portal header bell
- Notification list/dropdown or panel
- Pagination if needed
- Mark one notification read
- Mark all read if included in the final UI
- Empty, loading, and retry states
- Updates after booking, reschedule, cancellation, payment/refund, and therapist assignment/release

APIs:

- Dashboard summary endpoint or efficient composition of existing endpoints
- `GET /api/client/notifications/count`
- `GET /api/client/notifications`
- `PATCH /api/client/notifications/:id/read`
- Optional `PATCH /api/client/notifications/read-all`
- `GET /api/platform/quote-of-the-day`

Avoid a dashboard waterfall where a single summary endpoint is safer and faster. Never expose therapy notes, intake answers, or session content—metadata only.

## Milestone 6 verification

- The correct next active session is selected.
- Countdown and join state match server policy without excessive polling.
- Reschedule/cancel reuse existing behavior rather than fork policy logic.
- Empty states route correctly for assigned and unassigned clients.
- Stats are client-scoped and correct.
- All users receive the same quote for the defined date boundary.
- Arabic is valid RTL and accessible.
- Notification ownership/read state is enforced server-side.
- Unread count updates after read actions and relevant new events.

# Milestone 7 — Billing and receipts

## Goal

Replace `/portal/billing` with complete client billing visibility built around Razorpay.

## Feature states

Support:

- Payment-enabled portal
- Free/covered sessions with a simple “Your sessions are covered” experience
- Billing-disabled navigation/page behavior controlled by platform settings

Do not copy Stripe-specific saved-card behavior. Implement only saved payment-method functionality actually supported and approved for the chosen Razorpay integration. If no secure saved-method capability is configured, explain that clearly in the UI and omit misleading controls.

## Billing page scope

### Payment method

- Show a safely masked saved method only if supported by the backend/provider contract
- Update/remove actions only if supported securely
- No raw card data stored or returned by Shura

### Upcoming charges

- Session date
- Therapist
- Amount and currency
- Charge date
- Plain-language explanation

### Payment history

- Paginated rows/table
- Date, description, amount/currency, status, receipt
- Paid, refunded, failed, and pending badges
- Responsive mobile presentation

### Receipts

- Server-generated branded PDF
- Transaction reference, amount/currency, payment status/date, and appointment metadata only
- No therapy notes, intake data, message content, or unnecessary PII
- Ownership check before generation/download
- Stable filename and correct content headers

### Refund policy

- Collapsible, plain-language policy loaded from platform settings
- Align with the actual server-enforced policy rather than hard-coded UI text

APIs:

- `GET /api/client/billing/summary`
- `GET /api/client/billing/transactions?page=1&limit=20`
- `GET /api/client/billing/receipt/:id`
- Provider payment-method routes only if supported and explicitly selected

## Milestone 7 verification

- Clients can see only their own transactions and receipts.
- Pagination and mobile layouts work.
- Amount/currency match durable Razorpay/payment records.
- Refund pending/completed/failed states render accurately.
- Covered/disabled modes expose no misleading controls.
- PDF receipt content and headers are correct.
- Cross-client receipt access is rejected.
- No card data or provider secrets enter logs, URLs, browser storage, or Shura tables.

# Milestone 8 — Security, accessibility, testing, and production readiness

## Goal

Complete cross-cutting hardening and verify the entire client portal for release.

## Security work

- Audit every client query/mutation for role and ownership enforcement in the database statement or transaction.
- Reverify Auth0 issuer/audience/signature/expiry/custom role behavior.
- Confirm tenant Actions are required and documented; missing role claims currently defaulting to client is security-sensitive and should be deliberately reviewed.
- Audit CORS and remove overly broad production allowances where safe.
- Audit CSRF behavior and bearer-token assumptions.
- Audit rate limits on booking, cancellation, profile upload, password reset, account deletion, and receipts.
- Audit PII/sensitive-data logging and public error messages.
- Audit Azure upload validation, metadata removal, private access, and SAS lifetime.
- Audit account-deletion partial-failure behavior and document operational reconciliation.
- Audit Razorpay signature/webhook/idempotency/refund behavior.
- Stress-test booking/reschedule concurrency and overlap constraints.
- Confirm video join remains safely unavailable while unconfigured.
- Confirm APIs never expose therapy notes, intake responses, session content, calendar tokens, provider secrets, raw webhooks, or signed URLs beyond their intended short-lived use.
- Review Socket.IO authorization and ensure no new work relies on globally broadcast legacy call signaling.

## Accessibility work

- WCAG 2.1 AA review
- Keyboard-only navigation across all portal pages and dialogs
- Visible focus states
- Correct focus trap and focus return
- Semantic landmarks/headings
- Labels, descriptions, and error associations
- Screen-reader announcements for toasts, optimistic save, loading, and errors
- Text contrast of at least 4.5:1
- Accessible tabs, pagination, menus, calendars, and slot pickers
- Reduced-motion handling for pulse/countdown effects
- Arabic RTL verification
- Mobile/tablet/desktop responsive review

## Automated and manual testing

Add infrastructure appropriate to the repo; currently backend tests use Node’s built-in test runner and there is no established frontend test/lint command. Do not claim tests that do not exist.

Cover:

- Backend policy/validation unit tests
- API integration tests for role, ownership, pagination, conflicts, idempotency, cancellation/refund, notifications, billing, and receipts
- Frontend component tests if a runner is deliberately introduced
- End-to-end flows
- Accessibility automation
- Responsive viewport checks

Critical E2E scenarios:

- First Auth0 login → onboarding → matching/assignment route
- Returning client → portal home
- Therapist/admin role → correct redirect
- Profile and preference changes
- Assigned therapist and release
- Paid Razorpay booking
- Free/covered booking
- Reschedule
- Cancel and refund lifecycle
- Review
- Join-window behavior
- Notifications
- Receipt download
- Account deletion and partial-provider-failure handling

## Operations and release

- Rehearse fresh base-schema bootstrap plus all migrations.
- Rehearse upgrade from the preceding migration state.
- Run migrations twice and confirm the second run skips applied migrations.
- Document backup and rollback steps.
- Update environment-variable documentation without exposing values.
- Update Auth0, Razorpay webhook, Azure Blob, calendar, and feature-flag docs.
- Verify health checks and monitoring.
- Create deployment and post-deployment smoke-test checklists.
- Run the repository’s public/secret safety check before publishing.

## Milestone 8 acceptance

- Backend tests pass.
- Frontend typecheck and production build pass.
- Production-like migrations succeed.
- No unresolved high-severity security findings.
- No critical accessibility findings.
- Rollback and operational follow-up paths are documented.
- Existing public, therapist, and admin flows have regression coverage proportional to touched risk.

# Milestone 9 — Video provider integration (deferred)

## Goal

Integrate the final video platform only after I explicitly choose Daily.co or another provider.

Do not implement this milestone until the provider decision is supplied.

## Future scope

- Implement the existing provider adapter contract rather than embedding provider logic in pages/routes.
- Secure room creation and termination.
- Short-lived, participant-scoped client/therapist join tokens or URLs.
- Booking ownership, participant role, and join-window enforcement.
- Pre-join camera/microphone tests.
- Video/audio controls and audio-only mode.
- Connection recovery and clear provider-outage UX.
- Room expiration and webhook verification.
- Privacy-safe join/leave audit events and telemetry.
- Replace/retire legacy call endpoints and global Socket.IO signaling.
- Decide separately whether text sessions stay in Shura’s assignment-scoped chat or use provider functionality.

## Milestone 9 verification

- A client cannot join another client’s booking.
- A therapist cannot join an unrelated session.
- Tokens are short-lived and role-scoped.
- Join windows are enforced server-side.
- Rooms expire/close appropriately.
- Client and therapist can complete a test session and reconnect.
- Provider failure has a usable recovery/support path.
- No provider secret is present in the frontend bundle.

## Durable business and security rules

Preserve these throughout remaining work:

- Roles are `client`, `therapist`, and `admin`.
- Admins cannot self-register; admin login requires MFA.
- Therapist self-registration begins pending; only approved therapists are discoverable/assignable.
- One active therapist assignment per client; retain assignment history.
- Session types are video, audio, and text; portal durations are 30, 50, and 80 minutes.
- Store scheduling timestamps as UTC/TIMESTAMPTZ and render in the client’s IANA timezone. Legacy date/time backfill assumes `Asia/Kolkata`; do not use server-local timezone conversion.
- Recheck slots transactionally; never trust a slot list already shown in the browser.
- Paid booking is finalized only after verified Razorpay payment.
- Razorpay monetary columns have legacy names such as `amount_cents` even though values may mean provider smallest INR units/paise. Trace usage before changing money semantics.
- Therapy notes and session content are never exposed in the client portal; only appointment/payment metadata.
- Intake data is highly sensitive and limited to authorized assignment/admin paths.
- Parameterize SQL and minimize returned fields.
- Never trust client-supplied owner IDs, roles, prices, statuses, or policy decisions.
- External provider calls must be signature/state verified, idempotent, failure-aware, and server-side.
- No secrets, tokens, `.env` contents, raw webhooks, signed blob URLs, intake bodies, or messages in logs, commits, screenshots, or chat.
- Religious and clinical claims require appropriate human review; code does not establish theological authenticity, clinical efficacy, crisis coverage, licensing, or regulatory compliance.

## Database and API conventions

- PostgreSQL through `pg`; no ORM.
- Add the next immutable, zero-padded migration under `shura-backend/migrations/`.
- Never edit an already-applied migration.
- Do not add more runtime DDL to `server.js`.
- For multi-row state changes, use transactions and locks appropriate to concurrency risk.
- New client APIs use structured errors:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message",
    "details": null
  }
}
```

- Paginated responses use:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

- Scope client data from the authenticated local client ID, not a browser-supplied ID.
- Preserve intentional compatibility with legacy routes or migrate consumers deliberately and document the break.
- Email/calendar/provider side effects commonly occur after database commit and must tolerate/reconcile failure without duplicating domain records.

## MacBook setup notes

Use Node.js 20 and npm. A typical setup is:

```bash
git clone https://github.com/owaz/shura.git
cd shura
git fetch --all --prune
git switch main
git pull --ff-only

# When implementation is authorized, create a fresh milestone branch from main.
# git switch -c agent/milestone-5-implementation

cd shura-backend
npm install
cd ../shura-frontend
npm install
```

Local secrets belong only in ignored files:

- `shura-backend/.env`: database and backend/provider secrets
- `shura-frontend/.env.local`: browser-safe `VITE_*` identifiers only

Never paste secret values into Codex. Copy from the example files locally:

```bash
cp shura-backend/.env.example shura-backend/.env
cp shura-frontend/.env.example shura-frontend/.env.local
```

Expected local defaults in the canonical runbook are frontend `http://localhost:3006` and backend `http://localhost:5001` when `PORT=5001` is configured.

Auth0 local requirements include:

- SPA callback/logout/web origins for `http://localhost:3006`
- Exact audience parity between frontend and backend
- RS256 API
- Claim namespace `https://shura.com`
- Repository Auth0 Actions deployed in their documented order
- Development-only synthetic client, therapist, and admin users
- Auth0 Management API credentials only in backend `.env` when account-management flows are tested

For an isolated disposable E2E database only, follow `docs/LOCAL_E2E_SETUP.md`. Never bootstrap/seed a database unless its target is explicitly confirmed safe and `E2E_DATABASE_SAFE_TO_MUTATE=true` is intentionally set.

If the E2E tooling is present, the flow is:

```bash
cd shura-backend
npm run e2e:preflight
npm run e2e:bootstrap
npm run migrate
npm run migrate
npm run e2e:seed
npm test

cd ../shura-frontend
npm run typecheck
npm run build
```

Run backend/frontend dev servers in separate terminals. Authentication must be completed interactively through Auth0 Universal Login; do not store passwords in the repository.

The existing public-repository safety script is PowerShell (`scripts/check-public-repo.ps1`). On macOS, install PowerShell 7 and Gitleaks or perform an equivalent full-history and staged secret scan while preserving the script’s fail-closed intent. Do not weaken the secret scan merely for platform convenience.

## Implementation contract for every requested milestone

When I say **“Implement Milestone N”**:

1. Inspect git status, current branch, relevant source, migrations, tests, and canonical docs.
2. State concise assumptions and the milestone boundary.
3. Implement all in-scope frontend, backend, migrations, validation, authorization, and documentation.
4. Preserve unrelated user work and existing public/therapist/admin behavior.
5. Add focused backend tests for policy/validation/security logic.
6. Run at minimum:
   - Backend: `npm test`
   - Frontend: `npm run typecheck`
   - Frontend: `npm run build`
7. Verify migrations proportionally to the change; do not mutate a non-disposable database.
8. Perform targeted manual/responsive/accessibility checks when browser tooling is available.
9. Update durable architecture/product/API docs when the change alters lasting behavior.
10. Report:
    - Outcome
    - Key changed files
    - Tests/checks run and results
    - Migration/deployment order
    - Required local/provider configuration, without values
    - Remaining risks or manual verification
11. Do not start the next milestone automatically.
12. Do not commit, push, deploy, alter live Auth0/Razorpay/Azure resources, or send external messages unless I explicitly ask.

## Initial instruction to Codex on the Mac

First, inspect the checkout and tell me:

- Current branch, tracking branch, and working-tree status
- Whether commit `92a4310` or equivalent canonical documentation/E2E tooling is present on current `main`
- Whether Milestones 1–4 implementations and migrations 007–012 are present
- Whether `/portal/home` and `/portal/billing` are still placeholders
- Whether any Milestone 5 implementation already exists
- Any divergence between this handoff and current source

Do this read-only and do not change files until I give the first implementation instruction. After that, wait for me to say **“Implement Milestone 5.”**
