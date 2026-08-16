# Frontend architecture

## Stack and entry points

`shura-frontend` is a React 19 TypeScript SPA built by Vite 6 with Tailwind CSS 4's Vite plugin. `index.tsx` mounts `App.tsx`; `App.tsx` composes React Router routes, global authentication, layout, lazy-loaded pages, and an error boundary. The alias `@/*` resolves from the frontend package root.

The project has no separate application-state library, form framework, frontend test runner, or lint command. State is held in React contexts/hooks and page components.

## Route areas

- Public: home, about, services, therapist discovery/profile, Shura Hub, contact, and network pages.
- Authentication/application: client/admin/therapist login entry points, signup, email verification, therapist application/status/onboarding, and questionnaire.
- Client: legacy payment plus `/portal/*` onboarding, booking, sessions, therapist, profile, preferences, and placeholder home/billing pages.
- Therapist: `/therapist-portal/*` dashboard, calendar, profile, payments, chat, calls, and intake forms.
- Admin: therapist approval UI.
- Tokenized/public workflows: intake form and success page.

`ProtectedRoute` and `ClientPortalGuard` provide browser navigation behavior, including role redirects and client-onboarding enforcement. They are not authorization boundaries; every sensitive API must independently check the token, role, resource ownership, and relationship.

## Authentication state

`contexts/AuthContext.tsx` wraps the app in `@auth0/auth0-react`. It requires `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE`, uses refresh-token support, and persists Auth0 SDK cache plus Shura's access token in browser storage. After login it calls `/api/auth/session` to resolve the local application user and role.

Shura also stores a small current-user projection and questionnaire-completion flag in local storage. These values are UI state only and must never be trusted by the API.

Client signup temporarily keeps the submitted email and full name in local storage for up to seven days so the name survives Auth0's email-verification redirect. After the same verified email authenticates, the frontend sends the pending name to an authenticated backend endpoint. The backend applies it only when the local identity still has an Auth0 fallback name, then the frontend removes the pending signup record. The name is not added to Auth0 authorization URLs and an unverified signup does not create a local user row.

Only browser-safe values belong in frontend environment files. `VITE_*` values are embedded into the bundle at build time; no client secret, database credential, provider secret, storage key, or webhook secret may be placed there.

## API and realtime access

`config/api.ts` is the shared URL/token layer:

- `VITE_API_URL` defaults to the current browser origin.
- `VITE_WS_URL` defaults to the API origin.
- `apiFetch` prefixes `/api`, attaches the bearer token, and omits cookies by default.

New pages should use `apiFetch` or the client-portal wrapper rather than construct hostnames. Preserve server error details where the page can render them safely.

Socket.IO clients must provide the access token in the handshake `auth` object. `CallWidget.tsx` currently opens a socket without doing so and should not be treated as a working authenticated production flow.

## UI/data maturity constraints

- `pages/client-portal/clientPortalApi.ts` and associated types define the most consistent API-backed client portal surface.
- `/portal/book` is the portal-native four-step booking flow. It preserves the selected type, duration, and slot across recoverable failures, loads live availability in the client timezone, invokes Razorpay only when the server says payment is required, and downloads authenticated `.ics` calendar files after confirmation.
- Therapist discovery fetches the backend but has local fallback therapist data.
- `ClientChatPage` begins with mock content; therapist chat, therapist payments, and call pages contain substantial mock/placeholder behavior.
- Content in `HealingHubPage.tsx` is checked-in editorial content, not provider-fetched or clinically reviewed by code.

When replacing mock behavior, verify the backend contract and authorization first; do not merely wire UI controls to legacy/placeholder endpoints.

## Verification

From `shura-frontend`:

```powershell
npm run typecheck
npm run build
```

There is no frontend automated test or lint script. Manually verify affected roles, loading/error states, accessibility, mobile/desktop layouts, browser console, and failed/unauthorized network requests.
