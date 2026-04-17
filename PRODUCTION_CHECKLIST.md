# Shura - Pre-Production Deployment Checklist

## ✅ Completed Items

### 1. Code Security
- [x] **SQL Injection Protection**: All database queries use parameterized statements ($1, $2, etc.)
- [x] **Environment Variables**: All sensitive data in `.env` files
- [x] **Git Protection**: `.gitignore` configured to exclude `.env`, `node_modules`, uploads

### 2. Database
- [x] **Schema Created**: `production_schema.sql` ready for deployment
- [x] **Indexes Added**: All foreign keys and frequently queried columns indexed
- [x] **Connection Config**: `db/index.js` supports both `DATABASE_URL` and individual params

### 3. Deployment Configuration
- [x] **Railway Config**: `railway.json` created
- [x] **Vercel Config**: `vercel.json` created  
- [x] **Production Environment**: `.env.production.example` documented
- [x] **Deployment Guides**: RAILWAY_DEPLOYMENT.md and VERCEL_DEPLOYMENT.md created

### 4. Features Implemented
- [x] **Authentication**: JWT-based auth for users, therapists, admins
- [x] **Booking System**: Complete booking flow with time slot management
- [x] **Payment Integration**: Razorpay routes created (requires production keys)
- [x] **Video Calls**: WebRTC with Socket.io signaling for both clients and therapists
- [x] **Intake Forms**: Client onboarding questionnaires
- [x] **Admin Portal**: Client management, therapist approval, assignments
- [x] **Email Notifications**: Nodemailer configured for Gmail

---

## ⚠️ Pending Before Deployment

### 1. Security Review
- [ ] **Error Handling Audit**: Ensure errors don't expose sensitive info
  - Check all `catch` blocks in routes
  - Remove stack traces in production responses
  - Verify no database structure leaks

- [ ] **Authentication Verification**: 
  - Verify all protected routes use `authenticateToken` middleware
  - Check admin routes use `requireAdmin`
  - Test unauthorized access attempts

### 2. Environment Configuration
- [ ] **Generate Production JWT Secret**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
  Use this for production `JWT_SECRET`

- [ ] **Cloudinary Setup**: Verify image upload credentials work

- [ ] **Email Testing**: Test Nodemailer with production Gmail app password

### 3. Testing
- [ ] **Test Complete User Journey**:
  1. Client signup → Intake form → Therapist assignment
  2. Book session → Payment (test mode) → Confirmation
  3. Video call functionality

- [ ] **Test Therapist Journey**:
  1. Therapist signup → Admin approval
  2. View assigned clients → Accept bookings
  3. Video call with client

- [ ] **Test Admin Functions**:
  1. Admin login → View clients/therapists
  2. Approve therapist → Assign client to therapist
  3. View intake forms and bookings

### 4. Database Preparation
- [ ] **Export Current Data** (if needed):
  ```bash
  pg_dump -U postgres -d shura --data-only > backup_data.sql
  ```

- [ ] **Create Admin Account** for production:
  ```javascript
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('YourSecurePassword', 10);
  console.log(hash); // Use this in production database
  ```

### 5. Performance Optimization
- [ ] **Review Query Performance**: Check slow queries
- [ ] **Add Caching** (optional): Redis for session management
- [ ] **CDN Configuration** (optional): Cloudinary auto-handles images

---

## 🚀 Deployment Steps

### Phase 1: Backend (Railway)
1. Create Railway project + PostgreSQL database
2. Set all environment variables (see `.env.production.example`)
3. Connect GitHub repository
4. Deploy automatically or via CLI: `railway up`
5. Run database schema: Copy `production_schema.sql` content → Railway PostgreSQL console
6. Note backend URL: `https://shura-backend.up.railway.app`

### Phase 2: Frontend (Vercel)
1. Update frontend `.env.production`:
   ```
   VITE_API_URL=https://shura-backend.up.railway.app
   VITE_WS_URL=https://shura-backend.up.railway.app
   ```
2. Connect GitHub repository to Vercel
3. Configure build settings (Vite framework, `npm run build`, `dist` output)
4. Add environment variables
5. Deploy
6. Note frontend URL: `https://shura.vercel.app`

### Phase 3: Update Configurations
1. **Update Backend CORS**: Add Vercel URL to `FRONTEND_URL` and `ALLOWED_ORIGINS`
2. **Redeploy Backend**: Railway auto-redeploys on env variable changes

### Phase 4: Razorpay Production Setup
1. Go to https://dashboard.razorpay.com
2. Navigate to "Website/App URL Details"
3. Enter production frontend URL: `https://shura.vercel.app`
4. Submit for approval
5. Once approved, get live keys: `rzp_live_...`
6. Update Railway environment variables:
   - `RAZORPAY_KEY_ID=rzp_live_xxxxx`
   - `RAZORPAY_KEY_SECRET=xxxxxxx`
7. Test payment flow on production

---

## 🔍 Post-Deployment Verification

### Health Checks
```bash
# Backend health
curl https://your-railway-url.up.railway.app/api/health

# Frontend loads
curl https://your-vercel-app.vercel.app

# Database connection (check Railway logs)
```

### Feature Testing
- [ ] User signup and login
- [ ] Therapist signup (admin approves via database or admin panel)
- [ ] Booking creation
- [ ] Payment processing (test mode first)
- [ ] Video call initialization
- [ ] Email notifications sent

### Monitoring
- [ ] Check Railway logs for errors
- [ ] Check Vercel deployment logs
- [ ] Monitor database connections (Railway PostgreSQL metrics)
- [ ] Set up error tracking (optional: Sentry)

---

## 📋 Production URLs Checklist

After deployment, update these locations:

1. **Backend `.env`**:
   - `FRONTEND_URL=https://your-vercel-app.vercel.app`
   - `ALLOWED_ORIGINS=https://your-vercel-app.vercel.app`

2. **Frontend `.env`**:
   - `VITE_API_URL=https://your-railway-url.up.railway.app`
   - `VITE_WS_URL=https://your-railway-url.up.railway.app`

3. **Razorpay Dashboard**:
   - Website URL: `https://your-vercel-app.vercel.app`

4. **Gmail OAuth** (if using OAuth instead of app password):
   - Authorized redirect URIs: Add production URL

---

## 🎯 Current Status

**Ready for Deployment:** 85%

**Remaining Tasks:**
1. Security audit (error handling, auth verification)
2. End-to-end testing locally
3. Generate production secrets (JWT, etc.)
4. Execute deployment steps

**Razorpay Status:** Will configure AFTER deployment (requires live website URL)

---

## 📞 Support Resources

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Razorpay Docs: https://razorpay.com/docs/
- PostgreSQL: https://www.postgresql.org/docs/

**Local Development URLs:**
- Backend: http://localhost:5001
- Frontend: http://localhost:3001
