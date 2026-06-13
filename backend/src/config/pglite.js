'use strict';
// =============================================================================
// PGlite Pool adapter
// Wraps @electric-sql/pglite with an interface compatible with the `pg` Pool
// so it can be used as a drop-in replacement in all repository files.
//
// Usage:
//   1. Set PGLITE_DB_DIR (optional, default: ./pglite-data) to enable PGlite
//   2. The adapter lazy-initializes on first query — no startup perf hit
//   3. Supports the full PostgreSQL feature set because PGlite runs real PG
//      compiled to WebAssembly (WITH RECURSIVE, ON CONFLICT, RETURNiNG, ILIKE,
//      EXTRACT, JSONB, ENUMs, partial indexes, uuid-ossp, etc.)
// =============================================================================

const path = require('path');
const config = require('./index');

class PGlitePool {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.resolve(__dirname, '../../pglite-data');
    this._client = null;
    this._ready = null;
    this._errorHandler = null;
  }

  // ---- Lazy initialization (first query or connect triggers it) ----
  async _init() {
    if (!this._ready) {
      this._ready = this._initInternal().catch((err) => {
        this._ready = null; // Reset so retries can happen
        throw err;
      });
    }
    return this._ready;
  }

  async _initInternal() {
    const { PGlite } = await import('@electric-sql/pglite');
    const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp');

    this._client = await PGlite.create({
      dataDir: this.dataDir,
      extensions: { uuid_ossp },
    });
  }

  // ---- Main query interface (mirrors pg Pool.query) ----
  async query(text, params) {
    await this._init();
    try {
      // PGlite.query() uses prepared statements — single statement only.
      // PGlite.exec() supports multiple statements but no parameters.
      // We route accordingly:
      //   - params provided → use query() (parameterized, 1 statement)
      //   - no params       → use exec()  (multi-statement, raw SQL)
      if (params !== undefined && params !== null) {
        const result = await this._client.query(text, params);
        return {
          rows: result.rows || [],
          rowCount: result.affectedRows ?? result.rows?.length ?? 0,
        };
      }
      const result = await this._client.exec(text);
      return {
        rows: result.rows || [],
        rowCount: result.affectedRows ?? result.rows?.length ?? 0,
      };
    } catch (err) {
      if (this._errorHandler) {
        this._errorHandler(err);
      }
      throw err;
    }
  }

  // ---- Connect + transaction support (mirrors pg Pool.connect) ----
  async connect() {
    await this._init();
    const client = this._client;

    return {
      query: async (text, params) => {
        try {
          if (params !== undefined && params !== null) {
            const result = await client.query(text, params);
            return {
              rows: result.rows || [],
              rowCount: result.affectedRows ?? result.rows?.length ?? 0,
            };
          }
          const result = await client.exec(text);
          return {
            rows: result.rows || [],
            rowCount: result.affectedRows ?? result.rows?.length ?? 0,
          };
        } catch (err) {
          // Route pool-level errors through the same handler as direct query()
          if (this._errorHandler) this._errorHandler(err);
          throw err;
        }
      },
      // PGlite is single-connection, so release is a no-op
      release: () => {},
    };
  }

  // ---- Cleanup ----
  async end() {
    if (this._client) {
      try {
        await this._client.close();
      } catch (err) {
        // Close errors are non-fatal during shutdown
      }
      this._client = null;
      this._ready = null;
    }
  }

  // ---- Event handler (only 'error' is used by the codebase) ----
  on(event, cb) {
    if (event === 'error') {
      this._errorHandler = cb;
    }
  }
}

// ---- Singleton ----
let poolInstance = null;

function getPGlitePool() {
  if (!poolInstance) {
    poolInstance = new PGlitePool({
      dataDir: config.pgliteDbDir || process.env.PGLITE_DB_DIR,
    });
  }
  return poolInstance;
}

module.exports = { PGlitePool, getPGlitePool };
