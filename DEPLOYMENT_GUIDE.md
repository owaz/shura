# Shura Auth0 Deployment Guide

This guide migrates Shura from custom JWT auth to Auth0 using the code in this repository.

## 1. Configure Auth0 tenant basics

1. Create or select your Auth0 tenant.
2. Set a custom domain (recommended for production).
3. Configure branding (logo, colors) for Universal Login.
4. Set Allowed Callback URLs:
   - Local: `http://localhost:3006`
   - Production: your frontend domain(s)
5. Set Allowed Logout URLs and Allowed Web Origins to the same environments.

## 2. Create Auth0 applications and API

1. **Single Page Application** (for `shura-frontend`)
   - Enable Refresh Token Rotation.
   - Add local/prod callback + logout + web origin URLs.
2. **Machine to Machine Application** (for backend Management API calls)
   - Authorize it against Auth0 Management API with scopes:
     - `read:users`
     - `update:users`
     - `read:roles`
     - `create:role_members`
3. **API**
   - Identifier (audience): e.g. `https://api.shura.com`
   - Signing Algorithm: RS256

## 3. Create Auth0 roles

Create roles:
- `Client`
- `Therapist`
- `Admin`

Role assignment for therapists during approval uses `AUTH0_ROLE_THERAPIST_ID`.

## 4. Configure social connections

1. Configure Google social connection and enable for SPA app.
2. Configure Apple social connection and enable for SPA app.
3. Keep therapist/admin policy enforced by actions (email/password only for therapist/admin).

## 5. Deploy Auth0 Actions

Create and deploy actions from `/auth0-actions`:

1. `01-pre-user-registration-set-role.js`
   - Trigger: **Pre User Registration**
2. `02-post-login-enforce-status-and-claims.js`
   - Trigger: **Post Login**
   - Order: **first**
3. `03-post-login-enforce-admin-mfa.js`
   - Trigger: **Post Login**
   - Order: **second**

## 6. Configure environment variables

### Backend (`shura-backend`)

Set:
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_CLAIM_NAMESPACE` (default used by code: `https://shura.com`)
- `AUTH0_M2M_CLIENT_ID`
- `AUTH0_M2M_CLIENT_SECRET`
- `AUTH0_ROLE_THERAPIST_ID`

Also keep existing DB/email/payment variables.

### Frontend (`shura-frontend`)

Set:
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_API_URL`
- `VITE_WS_URL`

## 7. Apply database migration

Run backend migrations so local records support Auth0 identity mapping:

```bash
cd shura-backend
npm run migrate
```

This applies `006_add_auth0_identity_columns.sql` to add `auth0_sub` mapping fields and status support.

## 8. Admin bootstrap

Admins cannot self-register by policy. Create admin users via Management API or Auth0 Dashboard and set:

```json
{
  "app_metadata": {
    "role": "admin",
    "status": "active"
  }
}
```

On first login, backend links or creates a corresponding local `admins` record using `auth0_sub`.

## 9. Manual verification checklist

1. Client signup (email/password).
2. Client signup with Google.
3. Client signup with Apple.
4. Client login and API access with bearer token.
5. Therapist signup -> complete profile -> status pending.
6. Therapist login while pending is denied with friendly message.
7. Admin login requires MFA.
8. Admin approves therapist from `/admin/therapists/pending`.
9. Therapist login succeeds after approval.
10. Admin reject/suspend/reactivate endpoints update status and block/unblock behavior.
11. Protected API routes reject invalid audience/issuer tokens.
