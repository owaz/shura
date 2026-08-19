# Shura documentation index

This directory is the canonical entry point for durable project knowledge. Source code, migrations, and deployment configuration remain the final authority.

## Fast handoff for agents

Before continuing work:

1. Read root `AGENTS.md`, this index, and the architecture/product page for the area being changed.
2. Run `git status --short --branch` and inspect recent commits. Preserve unrelated working-tree changes.
3. Confirm behavior in the current composition roots: `shura-frontend/App.tsx`, `shura-backend/server.js`, registered route modules, consuming services, tests, and ordered migrations.
4. Treat the current client portal as backend-backed through home/dashboard, notifications, onboarding, profile, preferences, assigned therapist, booking, sessions, billing, and PDF receipts. Do not infer that therapist payments/chat/calls or secure video/audio are complete.
5. For a schema change, verify the highest numbered migration before choosing the next filename. This checkout contains migrations `001` through `015`; do not edit an applied file.
6. Use the verification commands in root `AGENTS.md`. Database bootstrap/seed commands require the explicit disposable-database safety flag from `LOCAL_E2E_SETUP.md`.

The implementation-maturity section in [System overview](architecture/system-overview.md) is the concise capability baseline. The architecture and product pages record durable behavior; pull requests and issues should carry task history and proposed future milestones.

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
- [Azure Container Apps deployment](DEPLOYMENT_GUIDE.md) is the current repository-backed deployment runbook.
- Root [`DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md) is the Auth0 tenant companion; [`shura-backend/AZURE_BLOB_STORAGE.md`](../shura-backend/AZURE_BLOB_STORAGE.md) records current private-image storage setup.
- [Client portal milestone 1](CLIENT_PORTAL_MILESTONE_1.md) is a historical milestone note; current portal behavior is documented in the architecture and product pages.

## Known legacy or partially stale documentation

These files remain useful as historical/reference material but must not be treated as canonical without checking current code. Direct legacy guides carry a warning at the top so an agent opening one out of context does not mistake it for the active runbook.

- `docs/AZURE_CONTAINER_APPS_CONSOLIDATION.md` is the historical pre-consolidation assessment. Its “current state” and proposed snippets describe the repository before Docker/CI, Auth0, and Azure Blob implementation.
- `QUICK_DEPLOY.md`, `PRODUCTION_READY.md`, `PRODUCTION_CHECKLIST.md`, `shura-backend/BACKEND_README.md`, `shura-backend/SETUP.md`, `shura-backend/CLIENT_ASSIGNMENT_GUIDE.md`, `shura-backend/INTAKE_FORM_GUIDE.md`, `shura-backend/DEPLOYMENT.md`, and `shura-backend/RAILWAY_DEPLOYMENT.md` describe older ports, custom-password/JWT flows, routes, schema bootstrapping, storage, or split Railway/Vercel deployment.
- `shura-backend/THERAPIST_CLIENT_QUESTIONNAIRE.md` is product/reference material, not an approved clinical protocol or the authoritative implemented intake schema.
- `setup.sql`, `production_schema.sql`, `intake_schema.sql`, and `local_compat_schema.sql` are bootstrap/compatibility assets. Ordered changes belong in `shura-backend/migrations/`.

When a touched area depends on a legacy guide, either bring the relevant claim into the canonical architecture/product documentation or update the guide. Do not duplicate large source-obvious details.
