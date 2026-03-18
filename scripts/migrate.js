#!/usr/bin/env node
// scripts/migrate.js — Run DB migrations + seeds
require('dotenv').config({ path: '../backend/.env' });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'aero_sea_sentinel',
  user:     process.env.DB_USER     || 'sentinel_user',
  password: process.env.DB_PASSWORD || '',
});

const MIGRATIONS = [
  '../database/migrations/001_init_schema.sql',
  '../database/seeds/001_seed_data.sql',
];

async function run() {
  const client = await pool.connect();
  try {
    for (const file of MIGRATIONS) {
      const absPath = path.resolve(__dirname, file);
      if (!fs.existsSync(absPath)) { console.warn(`Skipping: ${file}`); continue; }
      console.log(`Running: ${path.basename(file)}`);
      const sql = fs.readFileSync(absPath, 'utf8');
      await client.query(sql);
      console.log(`  ✓ Done`);
    }
    console.log('\nAll migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
