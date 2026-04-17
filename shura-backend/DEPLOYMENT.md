# SHURA Backend - Production Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Environment Configuration

Create `.env.production` with production values:

```bash
# Server
PORT=5001
NODE_ENV=production

# Database - Use production database
DB_USER=your_prod_db_user
DB_HOST=your_prod_db_host
DB_NAME=shura_production
DB_PASSWORD=your_strong_production_password
DB_PORT=5432

# JWT - Generate a strong secret
JWT_SECRET=your_very_long_random_secret_key_here_at_least_64_characters

# Cloudinary
CLOUD_NAME=your_cloudinary_name
CLOUD_API_KEY=your_api_key
CLOUD_API_SECRET=your_api_secret

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@shuraa.life

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com
```

### 2. Database Setup

1. **Create production database:**
   ```bash
   createdb -U postgres shura_production
   ```

2. **Run migrations:**
   ```bash
   psql -U postgres -d shura_production < intake_schema.sql
   ```

3. **Backup strategy:**
   - Set up automated daily backups
   - Test restore process

### 3. Security Hardening

Update `server.js` CORS configuration:

```javascript
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

## 🚀 Deployment Options

### Option A: Railway (Recommended - Easy Setup)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Initialize:**
   ```bash
   railway init
   ```

4. **Add PostgreSQL:**
   ```bash
   railway add postgresql
   ```

5. **Set environment variables:**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set JWT_SECRET=your_secret
   # ... add all other variables
   ```

6. **Deploy:**
   ```bash
   railway up
   ```

### Option B: Heroku

1. **Install Heroku CLI and login:**
   ```bash
   heroku login
   ```

2. **Create app:**
   ```bash
   heroku create shura-backend
   ```

3. **Add PostgreSQL:**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Set environment variables:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your_secret
   # ... set all variables
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

6. **Run migrations:**
   ```bash
   heroku run bash
   psql $DATABASE_URL < intake_schema.sql
   ```

### Option C: DigitalOcean Droplet

1. **Create Ubuntu droplet**

2. **SSH into server:**
   ```bash
   ssh root@your_server_ip
   ```

3. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Install PostgreSQL:**
   ```bash
   sudo apt install postgresql postgresql-contrib
   ```

5. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

6. **Clone and setup:**
   ```bash
   git clone your-repo
   cd shura-backend
   npm install --production
   ```

7. **Create .env file** with production values

8. **Start with PM2:**
   ```bash
   pm2 start server.js --name shura-backend
   pm2 startup
   pm2 save
   ```

9. **Setup Nginx reverse proxy:**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:5001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

10. **Install SSL with Let's Encrypt:**
    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com
    ```

### Option D: AWS EC2 + RDS

1. **Create RDS PostgreSQL instance**

2. **Launch EC2 instance** (Ubuntu)

3. **Follow DigitalOcean steps** but use RDS connection string

4. **Setup Application Load Balancer** for SSL termination

## 🔒 Production Security

### 1. Add Security Middleware

```bash
npm install helmet compression
```

Update `server.js`:

```javascript
const helmet = require('helmet');
const compression = require('compression');

app.use(helmet());
app.use(compression());
```

### 2. Rate Limiting (Already Installed)

Ensure rate limiting is properly configured for production.

### 3. Monitoring & Logging

Install logging:
```bash
npm install winston
```

Setup error monitoring (e.g., Sentry):
```bash
npm install @sentry/node
```

## 📊 Performance Optimization

1. **Enable Node.js clustering** for multi-core support

2. **Setup Redis** for session storage and caching

3. **Database optimization:**
   - Add appropriate indexes
   - Set up connection pooling
   - Regular VACUUM and ANALYZE

## 🔍 Post-Deployment Verification

Test all endpoints:

```bash
# Health check
curl https://your-api-domain.com/api/health

# Authentication
curl -X POST https://your-api-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## 📈 Monitoring

### Setup Monitoring Tools

1. **Uptime monitoring:** UptimeRobot, Pingdom
2. **Performance:** New Relic, DataDog
3. **Error tracking:** Sentry
4. **Database:** pgAdmin, DataGrip

### Key Metrics to Monitor

- Response times
- Error rates
- Database connection pool
- Memory usage
- CPU usage
- Disk space

## 🔄 Backup & Disaster Recovery

### Automated Database Backups

```bash
# Daily backup script
#!/bin/bash
pg_dump -U postgres shura_production > backup_$(date +%Y%m%d).sql
# Upload to S3 or storage service
```

### Environment Backup

Store encrypted .env.production in secure location.

## 🐛 Troubleshooting

### Server Won't Start
- Check logs: `pm2 logs`
- Verify all environment variables are set
- Check database connection

### Database Connection Issues
- Verify credentials
- Check firewall/security groups
- Test connection string locally

### High Memory Usage
- Check for memory leaks
- Implement connection pooling
- Add caching layer

## 📞 Support

Monitor logs regularly:
```bash
pm2 logs --lines 100
```

Check error logs for issues.
