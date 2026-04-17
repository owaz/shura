// db/index.js
require('dotenv').config();
const { Pool } = require('pg');

// Support both DATABASE_URL (Railway/Render) and individual parameters (local)
const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'shura',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    };

const pool = new Pool(connectionConfig);

// Test connection
pool.on('connect', () => {  console.log('✅ Database pool connected');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

module.exports = pool;
