# Shura documentation index

This directory is the canonical entry point for durable project knowledge. Source code, migrations, and deployment configuration remain the final authority.

## Architecture

- [System overview](architecture/system-overview.md): boundaries, request flow, repository layout, and implementation maturity.
- [Frontend](architecture/frontend.md): SPA composition, routes, authentication state, and API access.
- [Backend and API](architecture/backend-and-api.md): Express/Socket.IO composition, route families, and service boundaries.
- [Authentication and security](architecture/authentication-and-security.md): Auth0, roles, local identity mapping, and sensitive boundaries.
- [Data model](architecture/data-model.md): schema ownership, migration lifecycle, and principal relationships.
- [Scheduling and payments](architecture/scheduling-and-payments.md): availability, concurrency, Razorpay, refunds, and session policies.
- [Integrations and deployment](architecture/integrations-and-deployment.md): email, calendars, storage, monitoring, Docker, and Azure Container Apps.

## Product and domain

- [Domain model and rules](product/domain-model-and-rules.md): durable terminology and implementation-backed rules.
- [User workflows](product/workflows.md): client, therapist, admin, intake, assignment, and session lifecycles.
- [Source material](product/source-material.md): status of the Word research documents and non-code design references.

## Decisions

- [ADR index](decisions/README.md)

## Operational guides

- [Local end-to-end setup](LOCAL_E2E_SETUP.md) is the current development/E2E runbook.
- [Azure Container Apps deployment](DEPLOYMENT_GUIDE.md) and [consolidation assessment](AZURE_CONTAINER_APPS_CONSOLIDATION.md) describe the selected hosting direction, but contain stale details called out below.
- [Client portal milestone 1](CLIENT_PORTAL_MILESTONE_1.md) records an implemented milestone and the intentionally unconfigured video-provider contract.

## Known legacy or partially stale documentation

These files remain useful as historical/reference material but must not be treated as canonical without checking current code:

- Root `DEPLOYMENT_GUIDE.md` correctly describes Auth0 setup, but deployment environment details must also be checked against `.github/workflows/deploy-aca.yml` and current `.env.example` files.
- `docs/AZURE_CONTAINER_APPS_CONSOLIDATION.md` includes a pre-implementation “current state” that says Docker/CI do not exist; they now do.
- `docs/DEPLOYMENT_GUIDE.md` and `.github/workflows/deploy-aca.yml` still mention Cloudinary in places even though new uploads use Azure Blob Storage.
- `QUICK_DEPLOY.md`, `PRODUCTION_READY.md`, `PRODUCTION_CHECKLIST.md`, `shura-backend/BACKEND_README.md`, `shura-backend/SETUP.md`, `shura-backend/CLIENT_ASSIGNMENT_GUIDE.md`, `shura-backend/INTAKE_FORM_GUIDE.md`, and parts of backend deployment guides describe older ports, custom-password/JWT flows, routes, schema bootstrapping, or split Railway/Vercel deployment.
- `setup.sql`, `production_schema.sql`, `intake_schema.sql`, and `local_compat_schema.sql` are bootstrap/compatibility assets. Ordered changes belong in `shura-backend/migrations/`.

When a touched area depends on a legacy guide, either bring the relevant claim into the canonical architecture/product documentation or update the guide. Do not duplicate large source-obvious details.
