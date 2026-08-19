# Legacy: Shura backend Railway deployment instructions

> **Legacy alternative deployment guide.** Railway/Vercel is not the configured main-branch delivery path, and the admin/password/schema instructions below do not match current Auth0 and migration rules. Use [`../docs/DEPLOYMENT_GUIDE.md`](../docs/DEPLOYMENT_GUIDE.md).

## Railway Deployment (Backend)

### Prerequisites
- Railway account: https://railway.app
- PostgreSQL database (Railway provides this)

### Step 1: Create Railway Project
```bash
# Install Railway CLI (optional)
npm install -g @railway/cli

# Or use the web dashboard at https://railway.app
```

### Step 2: Add PostgreSQL Database
1. Go to your Railway project
2. Click "New" → "Database" → "Add PostgreSQL"
3. Railway will auto-generate `DATABASE_URL` environment variable

### Step 3: Set Environment Variables
In Railway dashboard, add these variables:

**Required:**
- `NODE_ENV=production`
- `PORT=5001` (or let Railway auto-assign)
- `JWT_SECRET=<generate-strong-random-string>`
- `FRONTEND_URL=https://your-vercel-app.vercel.app`

**Azure Blob Storage (Image uploads):**
- `AZURE_STORAGE_ACCOUNT_NAME=yourstorageaccount`
- `AZURE_STORAGE_IMAGE_CONTAINER=shura-images`
- `AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>`

Azure-hosted production deployments should use Managed Identity instead of a
connection string. The connection string is retained here only for non-Azure
legacy deployments.

**Email (Gmail):**
- `EMAIL_USER=shuraa.life@gmail.com`
- `EMAIL_PASSWORD=<your-gmail-app-password>`
- `ADMIN_EMAIL=shuraa.life@gmail.com`

**Razorpay (Payment - Add AFTER getting production keys):**
- `RAZORPAY_KEY_ID=rzp_live_xxxxx`
- `RAZORPAY_KEY_SECRET=xxxxxxx`
- `RAZORPAY_WEBHOOK_SECRET=<same webhook secret set in Razorpay Dashboard>`

### Step 4: Deploy
```bash
# Connect your GitHub repo to Railway
# Or push via Railway CLI
railway login
railway link
railway up
```

### Step 5: Run Database Migrations
```bash
# Via Railway CLI from shura-backend
railway run npm run migrate
```

The migration runner applies every SQL file in `migrations/` once and stores applied file names in `schema_migrations`.

### Your Backend URL
Railway will provide: `https://shura-backend.up.railway.app`

---

## Database Setup

### Create Tables
Run the checked-in migrations instead of manually copying table definitions:

```bash
npm run migrate
```

### Seed Data (Optional)
```sql
-- Add admin user
INSERT INTO admins (email, password_hash, full_name) 
VALUES ('admin@shura.com', '<bcrypt-hashed-password>', 'Admin User');
```

---

## Health Check
After deployment, test:
```bash
curl https://your-railway-url.up.railway.app/api/health
```

Should return: `{"status":"OK","message":"Shura API is running"}`

---

## Troubleshooting

**Port Issues:**
Railway auto-assigns PORT. Your server.js should use:
```javascript
const PORT = process.env.PORT || 5001;
```

**Database Connection:**
Railway provides `DATABASE_URL`. Update db.js if needed:
```javascript
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
```

**CORS Errors:**
Update server.js CORS to allow your Vercel frontend:
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-app.vercel.app'];
```
