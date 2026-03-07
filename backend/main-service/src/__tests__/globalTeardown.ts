import { Pool } from 'pg';

export default async function globalTeardown() {
  // Close any lingering PG pool connections
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.end();
  } catch (_) {
    // ignore
  }
  console.log('[globalTeardown] Cleanup complete.');
}
