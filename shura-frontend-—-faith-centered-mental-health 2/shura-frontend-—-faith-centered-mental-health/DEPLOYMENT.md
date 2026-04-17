# SHURA Frontend - Production Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Environment Configuration

Create `.env.production` with your production API URLs:

```bash
VITE_API_URL=https://your-backend-domain.com
VITE_WS_URL=https://your-backend-domain.com
```

### 2. Update Backend CORS Settings

Ensure your backend allows requests from your production frontend domain.

### 3. Test Production Build Locally

```bash
npm run build
npm run preview
```

## 🚀 Deployment Options

### Option A: Vercel (Recommended for Frontend)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Environment Variables:**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add `VITE_API_URL` with your backend URL
   - Add `VITE_WS_URL` with your WebSocket URL

### Option B: Netlify

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login:**
   ```bash
   netlify login
   ```

3. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

4. **Configuration:**
   Create `netlify.toml`:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

### Option C: AWS S3 + CloudFront

1. **Build:**
   ```bash
   npm run build
   ```

2. **Upload to S3:**
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

3. **Invalidate CloudFront Cache:**
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
   ```

### Option D: DigitalOcean App Platform

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables in the dashboard

## 🔒 Security Checklist

- [ ] All API URLs use HTTPS
- [ ] CORS properly configured on backend
- [ ] No sensitive data in client-side code
- [ ] Environment variables set correctly
- [ ] CSP headers configured (if applicable)

## 📊 Performance Optimization

Before deploying:

1. **Check bundle size:**
   ```bash
   npm run build -- --mode production
   ```

2. **Enable compression** on your hosting provider

3. **Set up CDN** for static assets

## 🔍 Post-Deployment Verification

1. Test all major user flows:
   - [ ] User registration/login
   - [ ] Therapist registration/login
   - [ ] Admin login
   - [ ] Intake form submission
   - [ ] Booking/scheduling
   - [ ] Audio/video calls
   - [ ] Payment processing

2. Check browser console for errors

3. Test on multiple devices and browsers

## 🐛 Troubleshooting

### API Connection Issues
- Verify `VITE_API_URL` is correct
- Check browser console for CORS errors
- Ensure backend is running and accessible

### Build Failures
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npx tsc --noEmit`

### Environment Variables Not Working
- Restart dev server after changing .env files
- Ensure variables start with `VITE_`

## 📞 Support

For issues, check:
1. Browser developer console
2. Network tab for failed requests
3. Backend logs
