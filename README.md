# Shura

Shura is a full-stack, faith-centered mental-health platform for clients, therapists, and administrators. The monorepo contains a React/Vite SPA and a Node.js/Express/PostgreSQL API with Socket.IO realtime support.

The canonical project map, architecture, domain rules, decision records, known documentation gaps, and safe development instructions begin at:

- [AGENTS.md](AGENTS.md) for coding-agent and contributor guardrails
- [docs/README.md](docs/README.md) for the full documentation index
- [docs/LOCAL_E2E_SETUP.md](docs/LOCAL_E2E_SETUP.md) for current local setup and end-to-end verification

## Quick verification

Use Node.js 20 and install each package independently:

```powershell
Set-Location shura-backend
npm install
npm test

Set-Location ../shura-frontend
npm install
npm run typecheck
npm run build
```

For local runtime configuration, copy `shura-backend/.env.example` to `.env` and `shura-frontend/.env.example` to `.env.local`. Keep only browser-safe `VITE_*` identifiers in the frontend file. A fresh disposable database needs the documented base-schema bootstrap before `npm run migrate`; follow the E2E runbook rather than older setup guides.

The production `Dockerfile` builds the SPA and serves it from the Express process. Pushes to `main` are configured to build and deploy the image to staging and production Azure Container Apps through `.github/workflows/deploy-aca.yml`.

Current client-portal code is API-backed through dashboard/notifications, onboarding, profile/preferences, assigned therapist, booking, sessions, billing history, and PDF receipts. Secure video/audio remains unconfigured, and several therapist-facing or legacy surfaces remain partial or mock-backed. Use the implementation-maturity section in `docs/architecture/system-overview.md` before describing a flow as complete.
