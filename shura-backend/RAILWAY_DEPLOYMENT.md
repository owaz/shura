# Shura Backend - Deployment Instructions

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

**Cloudinary (Image uploads):**
- `CLOUD_NAME=your_cloudinary_name`
- `CLOUD_API_KEY=your_cloudinary_key`
- `CLOUD_API_SECRET=your_cloudinary_secret`

**Email (Gmail):**
- `EMAIL_USER=shuraa.life@gmail.com`
- `EMAIL_PASSWORD=<your-gmail-app-password>`
- `ADMIN_EMAIL=shuraa.life@gmail.com`

**Razorpay (Payment - Add AFTER getting production keys):**
- `RAZORPAY_KEY_ID=rzp_live_xxxxx`
- `RAZORPAY_KEY_SECRET=xxxxxxx`

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
# Via Railway CLI
railway run npm run migrate

# Or connect to Railway's PostgreSQL and run SQL files manually
```

### Your Backend URL
Railway will provide: `https://shura-backend.up.railway.app`

---

## Database Setup

### Create Tables
Run these SQL commands in your production PostgreSQL:

```sql
-- See ../database/schema.sql for full schema
-- Run each table creation in order:
-- 1. users
-- 2. therapists  
-- 3. admins
-- 4. intake_forms
-- 5. bookings
-- 6. payments
-- etc.
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
