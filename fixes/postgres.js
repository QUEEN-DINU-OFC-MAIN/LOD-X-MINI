/**
 * fixes/postgres.js
 * PostgreSQL with AUTO-CREATE TABLES on boot + safe fallback to R2.
 *
 * Fixes: "PostgreSQL unavailable – settings stay in R2 err=Invalid URL"
 *
 * Usage (in site/index.js, after R2 init):
 *   const pg = require('./fixes/postgres');
 *   await pg.initPostgres();          // validates URL, connects, creates tables
 *   app.locals.db = pg;               // use everywhere
 *
 * Env: DATABASE_URL (set automatically by the Heroku Postgres add-on)
 *   heroku addons:create heroku-postgresql:essential-0
 *
 * npm install pg
 */

const { Pool } = require('pg');

let pool = null;
let ready = false;

/** Validate DATABASE_URL — returns null instead of throwing "Invalid URL" */
function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') return null;
    if (!u.hostname) return null;
    return raw.trim();
  } catch {
    return null; // malformed → treat as missing
  }
}

/** Connect with retry, then auto-create all tables */
async function initPostgres(logger = console) {
  const url = getDatabaseUrl();
  if (!url) {
    logger.warn('🔴 PostgreSQL unavailable – settings stay in R2 (DATABASE_URL missing/invalid)');
    logger.warn('   → heroku addons:create heroku-postgresql:essential-0');
    return null;
  }

  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }, // Heroku PG uses a self-signed cert
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
  pool.on('error', (e) => logger.error('pg pool error:', e.message));

  // Retry connect (Heroku PG can take a few seconds after dyno boot)
  let connected = false;
  for (let i = 1; i <= 5 && !connected; i++) {
    try {
      await pool.query('SELECT 1');
      connected = true;
    } catch (e) {
      logger.warn(`🟡 PostgreSQL connect attempt ${i}/5 failed: ${e.message}`);
      if (i < 5) await new Promise((r) => setTimeout(r, i * 1000));
    }
  }
  if (!connected) {
    logger.error('🔴 PostgreSQL connect failed – settings stay in R2');
    return null;
  }

  try {
    await createTables(logger);
    ready = true;
    logger.log('🟢 PostgreSQL connected – tables auto-created');
    return pool;
  } catch (e) {
    logger.error('🔴 PostgreSQL table creation failed:', e.message);
    return null;
  }
}

/** AUTO-CREATE all tables (idempotent — safe to run on every boot) */
async function createTables(logger = console) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      number        TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_number TEXT NOT NULL,
      key         TEXT NOT NULL,
      value       JSONB,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_number, key)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      data       BYTEA,
      expires_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS stats_history (
      id       BIGSERIAL PRIMARY KEY,
      ts       TIMESTAMPTZ NOT NULL DEFAULT now(),
      server   TEXT,
      live     INT NOT NULL DEFAULT 0,
      paired   INT NOT NULL DEFAULT 0,
      samples  INT NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_stats_history_ts ON stats_history (ts);
  `);
}

/* ---------- helpers ---------- */

function isReady() { return ready; }

async function query(text, params) {
  if (!pool) throw new Error('PostgreSQL not initialized');
  return pool.query(text, params);
}

async function saveSetting(userNumber, key, value) {
  if (!pool) return false;
  await pool.query(
    `INSERT INTO settings (user_number, key, value, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_number, key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [userNumber, key, JSON.stringify(value)]
  );
  return true;
}

async function getSettings(userNumber) {
  if (!pool) return null;
  const { rows } = await pool.query(
    'SELECT key, value FROM settings WHERE user_number = $1', [userNumber]
  );
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

async function addStatsSample({ server, live, paired, samples }) {
  if (!pool) return false;
  await pool.query(
    'INSERT INTO stats_history (server, live, paired, samples) VALUES ($1, $2, $3, $4)',
    [server || null, live || 0, paired || 0, samples || 0]
  );
  return true;
}

async function getStatsHistory(limit = 1440) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT ts, server, live, paired, samples FROM stats_history
     ORDER BY ts DESC LIMIT $1`, [limit]
  );
  return rows.reverse();
}

async function close() {
  if (pool) await pool.end();
}

module.exports = {
  initPostgres, createTables, isReady, query,
  saveSetting, getSettings, addStatsSample, getStatsHistory, close,
};
