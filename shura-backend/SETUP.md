# Shura Backend Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd /Users/asmafathima/Desktop/SHURA/shura-backend
npm install
```

### 2. Create Database Tables
Open a terminal and run:
```bash
psql -U postgres -d shura_db -f /Users/asmafathima/Desktop/SHURA/shura-backend/setup.sql
```

Or if you prefer to do it manually in psql:
```bash
psql -U postgres
\c shura_db
-- Then paste the contents of setup.sql
```

### 3. Start the Backend Server
```bash
npm run dev
```

You should see:
```
🚀 Starting Shura Backend...
✅ CORS enabled for: http://localhost:3001
✅ Server running on port 5000
🌐 http://localhost:5000/api/health
```

### 4. Test the Connection
In another terminal:
```bash
curl http://localhost:5000/api/health
```

You should see:
```json
{"status":"OK","message":"Shura API is running"}
```

## Environment Variables (.env)

All are already configured in your `.env` file:

```
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=shura_db
DB_PASSWORD=Asma@1996  # Your PostgreSQL password
DB_PORT=5432
JWT_SECRET=shura_super_secret_jwt_key_2024
FRONTEND_URL=http://localhost:3001
```

## API Endpoints

### Authentication
- **POST** `/api/auth/signup` - Register new user
  - Body: `{ email, password, full_name }`
  - Returns: `{ user, token }`

- **POST** `/api/auth/login` - Login user
  - Body: `{ email, password }`
  - Returns: `{ user, token }`

### Newsletter
- **POST** `/api/newsletter/subscribe` - Subscribe to newsletter
  - Body: `{ email, name, optIn }`
  - Returns: `{ message, subscription }`

- **POST** `/api/newsletter/unsubscribe` - Unsubscribe from newsletter
  - Body: `{ email }`
  - Returns: `{ message }`

### Health Checks
- **GET** `/api/health` - API status
- **GET** `/ping` - Quick ping
- **GET** `/db-time` - Database connection test

## Database Schema

### users table
```
id (SERIAL PRIMARY KEY)
email (VARCHAR UNIQUE NOT NULL)
password_hash (VARCHAR NOT NULL)
full_name (VARCHAR)
created_at (TIMESTAMP DEFAULT NOW())
updated_at (TIMESTAMP DEFAULT NOW())
```

### newsletter table
```
id (SERIAL PRIMARY KEY)
email (VARCHAR UNIQUE NOT NULL)
name (VARCHAR)
opt_in (BOOLEAN DEFAULT false)
subscribed_at (TIMESTAMP DEFAULT NOW())
updated_at (TIMESTAMP DEFAULT NOW())
```

## Troubleshooting

### PostgreSQL not running?
```bash
# On macOS with Homebrew
brew services start postgresql

# Check status
brew services list
```

### CORS errors in browser console?
- Verify CORS is enabled in server.js
- Check FRONTEND_URL in .env matches your frontend URL (http://localhost:3001)

### Database connection error?
- Verify PostgreSQL is running: `psql -U postgres`
- Check .env credentials
- Ensure shura_db database exists: `createdb shura_db -U postgres`

### Table doesn't exist error?
Run the setup.sql file:
```bash
psql -U postgres -d shura_db -f setup.sql
```

## Testing with cURL

### Signup
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","full_name":"Test User"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Newsletter Subscribe
```bash
curl -X POST http://localhost:5000/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","optIn":true}'
```
