/**
 * Runs ONCE before all test suites.
 * Applies the database schema if the DB is reachable and schema not yet applied.
 * Gracefully skips when DB is unreachable (schema already applied by CI psql step).
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

function findSchemaFile(startDir: string): string | null {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const a = path.join(dir, 'init_database.sql', '01_schema.sql');
    if (fs.existsSync(a)) return a;
    const b = path.join(dir, 'docs', '01_schema.sql');
    if (fs.existsSync(b)) return b;
    dir = path.dirname(dir);
  }
  return null;
}

export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[globalSetup] DATABASE_URL not set — skipping schema init.');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 3000 });
  let schemaExists = false;
  let dbReachable  = false;

  try {
    const res = await pool.query(
      `SELECT COUNT(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'`
    );
    dbReachable  = true;
    schemaExists = parseInt(res.rows[0].count) > 0;
  } catch {
    // DB not reachable — likely schema already applied by CI psql command
    dbReachable = false;
  } finally {
    await pool.end().catch(() => {});
  }

  if (!dbReachable) {
    console.warn('[globalSetup] DB not reachable — assuming schema already applied by CI.');
    return;
  }

  if (schemaExists) {
    console.log('[globalSetup] Schema already applied — skipping.');
    return;
  }

  const schemaFile = findSchemaFile(__dirname);
  if (!schemaFile) {
    console.warn('[globalSetup] Schema file not found — skipping (assume CI handles it).');
    return;
  }

  console.log(`[globalSetup] Applying schema from: ${schemaFile}`);
  execSync(`psql "${dbUrl}" -f "${schemaFile}"`, { stdio: 'inherit' });
  console.log('[globalSetup] Schema applied successfully.');
}
