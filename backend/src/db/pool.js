// src/db/pool.js — PostgreSQL connection pool
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'aero_sea_sentinel',
  user:     process.env.DB_USER     || 'sentinel_user',
  password: process.env.DB_PASSWORD || '',
  min:      parseInt(process.env.DB_POOL_MIN || '2'),
  max:      parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.LOG_LEVEL === 'debug') {
    console.debug('DB query', { text, duration, rows: res.rowCount });
  }
  return res;
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
