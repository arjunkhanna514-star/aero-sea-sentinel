// src/db/pool.js — PostgreSQL connection pool
const { Pool } = require('pg');
require('dotenv').config();

// Support both DB_URL (Supabase/Render) and individual params (local Docker)
const poolConfig = process.env.DB_URL || process.env.DATABASE_URL
  ? {
      connectionString: process.env.DB_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host:     process.env.DB_HOST     || 'postgres',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'aero_sea_sentinel',
      user:     process.env.DB_USER     || 'sentinel_user',
      password: process.env.DB_PASSWORD || '',
      min:      2,
      max:      20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('DB query', { text: text.substring(0, 80), duration, rows: res.rowCount });
  return res;
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
