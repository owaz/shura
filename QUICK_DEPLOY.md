# Legacy: Quick deployment reference

> **Legacy deployment reference — do not use for current releases.** This guide predates the selected single-container Azure Container Apps deployment, Auth0-only interactive login, ordered migrations, and private Azure Blob uploads. Start with [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) and [`docs/README.md`](docs/README.md).

## Local Development (Current State)
```bash
# Backend
cd shura-backend
node server.js

# Frontend  
cd shura-frontend
npm run dev
```
**Access:** http://localhost:3006

---

## Production Deployment (Quick Steps)

### 1️⃣ Backend - Railway (Easiest)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
cd shura-backend
railway init
railway add postgresql
railway up
```

**Set these environment variables in Railway dashboard:**
- `NODE_ENV=production`
- `JWT_SECRET=[generate 64+ char random string]`
- `FRONTEND_URL=[your frontend URL]`
- All other variables from `.env.example`

**Your backend URL:** `https://your-app.railway.app`

---

### 2️⃣ Frontend - Vercel (Easiest)

```bash
# Install Vercel CLI
npm install -g vercel

# Update .env.production
cd shura-frontend
nano .env.production
# Set: VITE_API_URL=https://your-app.railway.app
#      VITE_WS_URL=https://your-app.railway.app

# Deploy
vercel --prod
```

**Your frontend URL:** `https://your-app.vercel.app`

---

## ⚡ Alternative: One-Click Deploys

### Backend: Render
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/)
1. Connect GitHub repo
2. Add environment variables
3. Click Deploy

### Frontend: Netlify
1. Connect GitHub repo  
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variables
5. Deploy

---

## 🔐 Required Environment Variables

### Backend (Railway/Render/Heroku)
```
NODE_ENV=production
PORT=5001
DB_USER=postgres
DB_HOST=[provided by platform]
DB_NAME=shura_production  
DB_PASSWORD=[provided by platform]
JWT_SECRET=[generate strong secret]
AZURE_STORAGE_ACCOUNT_NAME=[your storage account]
RESEND_API_KEY=[your Resend API key]
RESEND_FROM_EMAIL=[sender on a verified domain]
RESEND_WEBHOOK_SECRET=[environment webhook signing secret]
ADMIN_EMAIL=[authorized internal-alert mailbox]
EMAIL_OUTBOX_WORKER_ENABLED=true
FRONTEND_URL=[your frontend domain]
```

This legacy platform example is not the selected deployment path. Any deployment must also apply migrations through 018 and configure `/api/webhooks/resend`; use the canonical deployment guide.

### Frontend (Vercel/Netlify)
```
VITE_API_URL=[your backend URL]
VITE_WS_URL=[your backend URL]
```

---

## ✅ Verification Checklist

After deployment:

- [ ] Backend health check: `curl https://your-backend.com/api/health`
- [ ] Frontend loads without errors
- [ ] User login works
- [ ] Therapist login works  
- [ ] Admin login works
- [ ] Forms submit successfully
- [ ] Audio/video calls connect
- [ ] Check browser console for errors

---

## 🆘 Common Issues

**Backend won't connect:**
- Check CORS settings include frontend URL
- Verify all environment variables are set
- Check database connection

**Frontend API errors:**
- Verify `VITE_API_URL` is correct
- Check browser console for CORS errors
- Ensure backend is running

**Build failures:**
- Clear cache: `rm -rf node_modules dist && npm install`
- Check for TypeScript errors
- Verify all imports are correct

---

## 📚 Full Documentation

- Frontend: `shura-frontend/DEPLOYMENT.md`
- Backend: `shura-backend/DEPLOYMENT.md`
- Summary: `PRODUCTION_READY.md`

---

**Estimated Time:** 30 minutes for both frontend and backend deployment
