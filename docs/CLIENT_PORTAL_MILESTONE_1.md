# Historical: Client portal milestone 1

> Historical milestone note. The portal has since added backend-backed session management, booking, dashboard/notifications, billing history, and PDF receipts through migrations `012`–`015`. Use [the documentation index](README.md), [frontend architecture](architecture/frontend.md), [backend/API architecture](architecture/backend-and-api.md), and [product workflows](product/workflows.md) for current behavior. The video-provider limitation below remains current.

## Deployment order

1. Apply the backend migrations with `npm run migrate` from `shura-backend`.
2. Deploy the backend.
3. Deploy the frontend.

The portal code depends on the `onboarding_completed_at` column and the portal
settings tables added in `007_client_portal_foundation.sql`.

## Auth0 requirements

Continue using the existing Auth0 Actions. The post-login action must add the
`https://shura.com/role` custom claim to the access token. Client users are
routed into `/portal/*`; therapist and admin users are routed to their existing
portals.

## Video provider contract

`services/video/videoProvider.js` is intentionally unconfigured. A future
Daily.co (or other provider) adapter must implement room creation, participant
access, room termination, and room status through that interface. No provider
credentials are required for this milestone.
