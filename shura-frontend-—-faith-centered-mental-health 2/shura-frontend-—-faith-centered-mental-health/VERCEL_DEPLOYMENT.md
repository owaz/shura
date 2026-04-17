# Shura Frontend - Vercel Deployment

## Prerequisites
- Vercel account: https://vercel.com
- Backend deployed on Railway
- Backend URL ready (e.g., https://shura-backend.up.railway.app)

---

## Deployment Steps

### Step 1: Prepare Frontend
```bash
cd shura-frontend

# Test build locally
npm run build

# Should create 'dist' folder
```

### Step 2: Configure Environment Variables
Create `.env.production` file:

```bash
VITE_API_URL=https://your-backend.up.railway.app
VITE_WS_URL=https://your-backend.up.railway.app
```

### Step 3: Deploy to Vercel

**Option A: Vercel CLI**
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Option B: Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/new
2. Import your Git repository
3. Configure project:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. Add Environment Variables:
   - `VITE_API_URL` = `https://your-backend.up.railway.app`
   - `VITE_WS_URL` = `https://your-backend.up.railway.app`

5. Click "Deploy"

### Step 4: Configure Custom Domain (Optional)
1. In Vercel dashboard → Settings → Domains
2. Add your custom domain (e.g., `shura.com`)
3. Update DNS records as instructed by Vercel
4. Vercel auto-provisions SSL certificate

---

## Post-Deployment Configuration

### Update Backend CORS
After getting your Vercel URL, update backend `.env`:
```bash
FRONTEND_URL=https://your-app.vercel.app
ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.your-domain.com
```

### Update Vercel Environment Variables
If backend URL changes:
1. Go to Vercel dashboard → Settings → Environment Variables
2. Update `VITE_API_URL` and `VITE_WS_URL`
3. Redeploy: Click "Deployments" → "..." → "Redeploy"

---

## Razorpay Setup (After Deployment)

Once both frontend and backend are live:

1. **Get Production URLs:**
   - Frontend: `https://your-app.vercel.app`
   - Backend: `https://your-backend.up.railway.app`

2. **Apply for Razorpay Live Keys:**
   - Go to https://dashboard.razorpay.com
   - Fill "Website/App URL Details" with your production frontend URL
   - Submit for approval
   - Once approved, copy live keys (`rzp_live_...`)

3. **Update Backend Environment:**
   - In Railway dashboard, update:
     - `RAZORPAY_KEY_ID=rzp_live_xxxxx`
     - `RAZORPAY_KEY_SECRET=xxxxxxx`
   - Redeploy backend

---

## Health Checks

### Frontend
```bash
# Should load your React app
curl https://your-app.vercel.app
```

### API Connection
```bash
# Should return therapists list
curl https://your-app.vercel.app/api/health
```

---

## Troubleshooting

**Build Errors:**
- Check Vercel build logs
- Ensure all dependencies in `package.json`
- Verify TypeScript types compile: `npm run build` locally

**API Connection Failed:**
- Verify `VITE_API_URL` in Vercel environment variables
- Check backend CORS allows Vercel URL
- Test backend health: `curl https://backend-url/api/health`

**Environment Variables Not Working:**
- Vite requires `VITE_` prefix for client-side vars
- Redeploy after changing environment variables
- Check browser console for actual API URLs being called

---

## Continuous Deployment

Vercel auto-deploys on git push:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment
- Each pull request gets its own preview URL
