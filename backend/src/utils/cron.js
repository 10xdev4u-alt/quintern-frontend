const cron = require('node-cron');
const fsp = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const config = require('../config');

// Tracks whether a job is currently running so a long tick doesn't overlap
// with the next one. node-cron will happily fire a new tick while the
// previous tick is still draining files.
let running = false;

function setupCronJobs() {
  // Top of every hour: clean up proof images older than 24h.
  cron.schedule('0 * * * *', async () => {
    if (running) {
      console.warn(JSON.stringify({ job: 'proof-image-cleanup', skipped: 'previous run still in progress' }), 'cron skipped');
      return;
    }
    running = true;
    const start = Date.now();
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Eligible rows whose image still exists. We snapshot ids + paths and
      // free the DB connection immediately; the per-file IO is then async.
      const { rows } = await pool.query(
        "SELECT id, image_path FROM proof_submissions WHERE status='VERIFIED' AND verified_at < $1 AND image_path IS NOT NULL",
        [cutoff],
      );

      const uploadDir = path.join(__dirname, '..', '..', config.uploadDir);

      // Bounded concurrency — don't fork 10k unlinks at once.
      const CONCURRENCY = 16;
      const results = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
        if (!row.image_path) return false;
        const fp = path.join(uploadDir, row.image_path);
        try {
          await fsp.unlink(fp);
          return true;
        } catch (e) {
          if (e.code !== 'ENOENT') {
            console.warn(JSON.stringify({ job: 'proof-image-cleanup', file: fp, err: e.message }), 'unlink failed');
          }
          return false;
        }
      });

      const filesDeleted = results.filter(Boolean).length;
      // DB update is best-effort. If the file delete fails, the row is
      // still updated to image_path=NULL — otherwise the next tick would
      // try the same file again.
      await pool.query(
        "UPDATE proof_submissions SET image_path=NULL WHERE status='VERIFIED' AND verified_at < $1",
        [cutoff],
      );

      console.info(JSON.stringify({
        job: 'proof-image-cleanup',
        durationMs: Date.now() - start,
        recordsProcessed: rows.length,
        filesDeleted,
      }), 'cron job completed');
    } catch (err) {
      console.error(JSON.stringify({ job: 'proof-image-cleanup', err: err.message }), 'cron job failed');
    } finally {
      running = false;
    }
  });
}

async function mapWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}

module.exports = { setupCronJobs };
