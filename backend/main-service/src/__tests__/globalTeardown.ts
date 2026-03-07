import { Pool } from 'pg';

export default async function globalTeardown() {
  if (!process.env.DATABASE_URL) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.end();
  } catch (_) {
    // ignore
  }
  console.log('[globalTeardown] Cleanup complete.');
}
