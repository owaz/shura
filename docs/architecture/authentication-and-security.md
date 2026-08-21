# Authentication and security

## Active identity model

Auth0 Universal Login is the active interactive authentication mechanism. The frontend obtains RS256 access tokens for `VITE_AUTH0_AUDIENCE`; the backend verifies signature through tenant JWKS plus exact issuer and audience from `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`.

The required tenant-side code is checked into `auth0-actions/`:

- Pre-registration assigns `client/active` by default, assigns `therapist/pending` when requested, and denies admin self-registration.
- First post-login action enforces email verification for database users; forbids social login for therapist/admin; blocks pending/rejected/suspended therapists; and writes namespaced role, status, and email claims.
- Second post-login action requires MFA for every admin login and does not remember the browser.

The action namespace is fixed in action code as `https://shura.com`; backend configuration must match it. The API fails closed when role or status claims are missing or unsupported. Deploying and testing the Actions remains required because a valid identity token without application claims cannot enter an application role.

## Local identity mapping

On authenticated requests, `middleware/auth.js` finds or creates a record by Auth0 `sub` or normalized email:

- `client` → `users`
- `therapist` → `therapists`
- `admin` → `admins`

The local numeric ID becomes `req.user.id`. Auth0 remains responsible for login; PostgreSQL stores application profiles, relationships, statuses, and domain records. Admin status changes call the Auth0 Management API to update metadata/block state and, for approved therapists, assign configured Auth0 roles.

Direct `/api/auth/login`, `/api/auth/therapist/login`, `/api/admin/auth/login`, signup, refresh, and related legacy password flows return HTTP 410 where disabled, though unreachable legacy code remains in some handlers. Do not re-enable it accidentally. `JWT_SECRET` is still used for calendar OAuth state/token encryption fallback and old session/dev utilities.

## Authorization rules

- Frontend route guards are navigation controls only.
- `authenticateToken` proves identity but does not enforce a particular role.
- Route code must enforce role plus resource ownership/relationship. Admin routes use `requireAdmin`; client portal routes use `requireClient`; therapist routes must verify therapist role and use the authenticated therapist ID rather than an arbitrary body/path ID.
- Sensitive therapist/client sharing depends on an active `therapist_clients` relationship.
- Public therapist APIs return approved therapists only.

For new queries, select the resource through the authenticated owner/relationship in the same SQL statement where practical. A prior existence check is insufficient if the later mutation omits ownership conditions.

## Browser/session boundary

The frontend stores Auth0 SDK cache and a copied access token in browser storage. This makes XSS prevention critical. The API uses explicit bearer headers and generally omits cookies; the CSRF middleware therefore bypasses requests with authorization headers. If cookie authentication is introduced, implement a complete CSRF/origin/session design rather than relying on the current placeholder guard.

CORS accepts only explicitly configured `FRONTEND_URL`, `FRONTEND_URLS`, or `ALLOWED_ORIGINS` values in production; production startup fails when none are valid. Development additionally permits the documented localhost ports. Bearer access tokens are sent in authorization headers and CORS credentials are disabled, so cookie-CSRF defenses are not the API boundary; strict origin policy, token validation, and XSS prevention remain required.

## Sensitive data

The repository processes mental-health intake responses, messages, profile/emergency-contact data, appointment metadata, and payment identifiers. Apply least privilege and field minimization:

- Intake content: assigned therapist/admin only.
- Chat: active assignment participants only; use user-specific Socket.IO rooms.
- Calendar tokens: AES-256-GCM encrypted in PostgreSQL using `CALENDAR_TOKEN_SECRET` (or development fallback). Rotation requires a designed re-encryption/reconnect path.
- Images: private Azure container; short-lived read-only SAS URLs; validated signature/size/type and JPEG/PNG metadata removal before upload.
- Payment: server derives price, verifies Razorpay signatures, deduplicates webhook IDs, and never exposes secrets.
- Logs/errors: exclude tokens, `.env` values, intake bodies, messages, raw webhooks, calendar credentials, and signed blob URLs.

## Account and lifecycle security

Client account deletion first marks the local user suspended with `account_deletion_requested_at`, then blocks and deletes the Auth0 identity. Only after Auth0 deletion succeeds does it delete the local user (cascading related records), followed by best-effort Azure profile-image cleanup. Cross-provider deletion is not atomic; a provider failure retains the marked local row for operational reconciliation, while an earlier database failure returns neutral incomplete-deletion guidance without claiming the account was secured.

Therapist/client suspension synchronizes local state to Auth0 when `auth0_sub` exists. Unlinked legacy records cannot be centrally blocked until linked.

## Known security-sensitive gaps

- Legacy Socket.IO call signaling is disabled. Authenticated sockets may join only their server-derived user room.
- `/api/calls/join` and `/api/calls/create` require authentication and return `VIDEO_PROVIDER_UNCONFIGURED`; they are not calling endpoints.
- Production CORS origins, strict database TLS verification, current Azure Blob/Razorpay/Resend mappings, quality gates, and protected environment promotion are declared in the deployment workflow. Live secret values and environment protections still require operator verification.
- Many legacy endpoints use inconsistent errors and some return raw `err.message`.
- Auth0/local updates and account deletion span separate systems without a durable reconciliation queue.

These are findings, not authorization to change application behavior as part of documentation-only work.
