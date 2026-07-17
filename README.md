# Shura

Shura is a full-stack, faith-centered mental health platform with therapist discovery, onboarding, intake workflows, bookings, payments, chat, and call support.

This repository is a monorepo with:

- `shura-frontend`: React + Vite + TypeScript web app
- `shura-backend`: Node.js + Express + PostgreSQL API and realtime services

## Tech Stack

- **Frontend:** React 19, React Router, TypeScript, Vite, Socket.IO client
- **Backend:** Node.js, Express 5, PostgreSQL (`pg`), Socket.IO, JWT auth
- **Integrations:** Razorpay, Cloudinary, Nodemailer, Azure Application Insights (optional)
- **Deployment:** Docker, Azure Container Apps (CI/CD workflow included)

## Project Structure

```text
.
├─ shura-frontend/
│  ├─ pages/                 # Site pages and therapist portal pages
│  ├─ components/            # Shared UI components
│  ├─ config/api.ts          # API + WebSocket URL and fetch helpers
│  └─ .env.example
├─ shura-backend/
│  ├─ routes/                # API route modules
│  ├─ migrations/            # Ordered SQL migrations
│  ├─ db/                    # DB connection and pooling
│  ├─ scripts/migrate.js     # Migration runner
│  └─ .env.example
├─ docs/                     # Deployment and infra docs
├─ Dockerfile                # Builds frontend and serves from backend
└─ .github/workflows/        # Azure Container Apps deployment workflow
```

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 15+ (or compatible hosted PostgreSQL)

## Local Development

1. Install dependencies:

```bash
cd shura-backend && npm install
cd ../shura-frontend && npm install
```

2. Configure environment files:

```bash
cp shura-backend/.env.example shura-backend/.env
cp shura-frontend/.env.example shura-frontend/.env.local
```

3. Update key values:

- Backend (`shura-backend/.env`): `DB_*`, `JWT_SECRET`, optional Cloudinary/email variables
- Frontend (`shura-frontend/.env.local`): `VITE_API_URL`, `VITE_WS_URL`

4. Run database migrations:

```bash
cd shura-backend
npm run migrate
```

5. Start both apps in separate terminals:

```bash
# Terminal 1
cd shura-backend
npm run dev
```

```bash
# Terminal 2
cd shura-frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3006`
- Backend API: `http://localhost:5001`
- Health check: `http://localhost:5001/api/health`

## Available Scripts

### Frontend (`shura-frontend`)

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview built app
- `npm run typecheck` — TypeScript checks

### Backend (`shura-backend`)

- `npm run dev` — start backend with nodemon
- `npm start` — start backend in node
- `npm run migrate` — apply SQL migrations in `migrations/`

## Deployment

### Docker (single container)

From repo root:

```bash
docker build -t shura-app .
docker run -p 5001:5001 --env-file shura-backend/.env shura-app
```

The image builds the frontend and serves it from backend `public/`.

### Azure Container Apps

- Workflow: `.github/workflows/deploy-aca.yml`
- End-to-end guide: `docs/DEPLOYMENT_GUIDE.md`
- Consolidation notes: `docs/AZURE_CONTAINER_APPS_CONSOLIDATION.md`

## Key Features

- Client, therapist, and admin authentication flows
- Therapist onboarding and therapist portal
- Client intake and therapist intake form handling
- Booking and payment flow (Razorpay integration)
- Real-time chat and call signaling with Socket.IO
- Newsletter subscription and contact workflows

## Additional Documentation

- `shura-backend/DEPLOYMENT.md`
- `shura-backend/SETUP.md`
- `QUICK_DEPLOY.md`
- `PRODUCTION_CHECKLIST.md`
- `PRODUCTION_READY.md`

## Security Notes

- Do not commit `.env` files or secrets.
- Use a strong `JWT_SECRET` in production.
- Restrict backend origins with `FRONTEND_URL`, `FRONTEND_URLS`, and `ALLOWED_ORIGINS`.
