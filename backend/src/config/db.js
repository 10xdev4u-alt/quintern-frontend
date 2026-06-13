/**
 * Database connection module.
 *
 * Automatically selects the backend:
 *   - PGLITE_DB_DIR is set        → @electric-sql/pglite (PostgreSQL in WASM — no Docker, no server)
 *   - DATABASE_URL starts with     → node-postgres Pool (production PostgreSQL, e.g. Neon)
 *   - Otherwise                    → node-postgres Pool (fallback, requires external PG server)
 *
 * The PGlite adapter lazy-initializes on the first query, so requiring this
 * module is synchronous and never blocks startup.
 */

const config = require('./index');

let pool;

if (process.env.PGLITE_DB_DIR !== undefined || config.pgliteDbDir !== undefined) {
  // ── PGlite mode (PostgreSQL in WASM, embedded in process) ──
  const { getPGlitePool } = require('./pglite');
  pool = getPGlitePool();
  console.log(
    `[DB] Using PGlite (PostgreSQL in WASM) — data dir: ${config.pgliteDbDir || process.env.PGLITE_DB_DIR || './pglite-data'}`
  );
} else {
  // ── Production PostgreSQL (Neon / Render / local) ──
  const { Pool } = require('pg');

  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
  });

  pool.on('error', (err) => {
    console.error('DB pool error:', err);
    process.exit(-1);
  });

  console.log('[DB] Using PostgreSQL (node-postgres Pool)');
}

module.exports = pool;
