# ADR-0001: Keep a two-package monorepo and ship one production container

## Context

The repository contains separately installable frontend and backend packages. The React output is static, while Express serves API and Socket.IO traffic. `docs/AZURE_CONTAINER_APPS_CONSOLIDATION.md`, the root `Dockerfile`, server static-file handling, and the Azure workflow establish the current delivery design.

## Decision

Keep frontend and backend as separate packages in one repository. Build the frontend in a Docker stage, copy its output into the backend image, and serve SPA, REST, and Socket.IO traffic from one Express process in one Azure Container App per environment.

## Rationale

The consolidation assessment records simpler deployment, same-origin browser/API operation, coordinated releases, and fit for the current scale. No separate server-rendering or frontend runtime is required.

## Alternatives

The repository retains legacy guides for split Vercel/Netlify frontend and Railway/Render backend deployments. Those are not the configured main-branch pipeline.

## Consequences

- Frontend and backend deploy together and frontend `VITE_*` values are fixed at image build time.
- Express must preserve SPA fallback without swallowing `/api` routes.
- Socket.IO scaling needs a cross-replica adapter or a single-replica constraint.
- A backend failure affects static frontend delivery.

## Status

Accepted. The historical rationale is documented in the consolidation assessment and implemented by current deployment files.
