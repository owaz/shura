# System overview

## Purpose and boundaries

Shura combines a public faith-centered mental-health site with authenticated client, therapist, and administrator workflows. The implemented server owns local profile and domain state; Auth0 owns interactive authentication. PostgreSQL stores durable application data. Razorpay, Azure Blob Storage, email, and Google/Outlook calendars are optional server-side integrations.

```text
Browser (React SPA)
  ├─ Auth0 Universal Login (identity and access token)
  └─ HTTPS / Socket.IO
       ↓
Express 5 + Socket.IO (one Node.js process)
  ├─ route modules and domain services
  ├─ PostgreSQL
  ├─ Azure Blob Storage
  ├─ Razorpay
  ├─ Resend HTTPS API through a PostgreSQL outbox
  ├─ Google Calendar / Microsoft Graph
  └─ Azure Monitor OpenTelemetry (optional)
```

In local development, Vite runs on port 3006 and the backend is configured on port 5001. In the current production image, the frontend is built into `shura-backend/public`; Express serves the SPA, REST API, and Socket.IO from one Azure Container App.

## Repository structure

- `shura-frontend/App.tsx` is the SPA route composition root. `pages/`, `components/`, `contexts/`, and `config/` hold UI and client infrastructure.
- `shura-backend/server.js` is the runtime composition root. `routes/` owns HTTP interfaces; `utils/` contains policy/mapping/email logic; `services/` owns provider boundaries; `middleware/` owns auth and request guards.
- `shura-backend/production_schema.sql` supplies legacy-compatible base tables for a fresh database. `shura-backend/migrations/` contains ordered changes and `scripts/migrate.js` records them in `schema_migrations`.
- `auth0-actions/` contains tenant-side registration, login-policy, claim, and MFA code required by the application.
- `Dockerfile` and `.github/workflows/deploy-aca.yml` define the selected production delivery path.

## Principal request flow

1. The SPA redirects to Auth0 Universal Login and obtains an audience-bound RS256 access token.
2. `config/api.ts` attaches the bearer token to API requests. Socket clients pass a token during the handshake.
3. Backend authentication verifies issuer, audience, signature, and custom claims against Auth0 JWKS.
4. The middleware maps the Auth0 subject/email to one local role table and attaches the local numeric ID to `req.user`.
5. Route-specific role and ownership checks authorize the action; database transactions protect cross-row state changes.
6. Provider calls happen after or around durable state transitions depending on the workflow. Failures are commonly recorded or logged rather than made atomic with external providers.

## Major subsystems

- Public site and therapist discovery
- Auth0-backed client, therapist, and admin identity
- Therapist application, approval, and profile management
- Client onboarding, preferences, assigned therapist, and account lifecycle
- Tokenized intake forms and intake-based therapist matching
- Availability, booking, client session management, payment, refund, and calendar synchronization
- Client home dashboard, notification inbox, and review-gated daily faith content
- Client billing history and private, authenticated PDF receipts
- Persistent chat plus Socket.IO delivery
- Experimental/placeholder call signaling and an intentionally unconfigured secure video-provider interface
- Private image upload and short-lived read access

See the subsystem-specific architecture documents for invariants and current gaps.

## Implementation maturity

Do not infer completion from the presence of a route or page:

- Client home/dashboard, notifications, onboarding, profile, preferences, assigned therapist, booking, session management, billing history, and receipt downloads have backend-backed portal surfaces.
- Client billing supports one-time Razorpay checkout at booking, covered/free classifications, refund-state visibility, and receipts. Saved cards, subscriptions, deferred automatic charges, and automated conflict-refund reconciliation are not implemented.
- Several therapist portal pages still use mock data or partial API integration, including payments/chat/calls.
- Public therapist pages fall back to checked-in mock data if API loading fails.
- `services/video/videoProvider.js` deliberately rejects room creation/access until a provider is selected.
- `routes/calls.js` and some Socket.IO call events are legacy placeholders and are not a production-secure session system.

## Sources of truth and uncertainty

- Current behavior: source, tests, route registration, and current migrations.
- Deployment: `Dockerfile` and `.github/workflows/deploy-aca.yml`; actual Azure resource state is not visible in the repository.
- Product aspirations: documents under `WORD/` and design assets; these are research/reference material unless implemented or explicitly adopted.
- Operational configuration: `.env.example` files document names, but the repository cannot establish which optional providers are deployed or enabled.
