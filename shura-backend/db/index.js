// db/index.js
require('dotenv').config();
const { Pool } = require('pg');
const { buildConnectionConfig } = require('./connectionConfig');

const connectionConfig = buildConnectionConfig(process.env);

const pool = new Pool(connectionConfig);

// Test connection
pool.on('connect', () => {  console.log('✅ Database pool connected');
});

pool.on('error', (err) => {
  console.error('Database pool error', { code: err?.code || 'DATABASE_POOL_ERROR' });
});

module.exports = pool;
