/**
 * Runs ONCE before all test suites.
 * Applies the database schema to the test PostgreSQL instance if not yet applied.
 *
 * Path layout (from __dirname):
 *   __dirname = .../backend/main-service/src/__tests__
 *   repo root = ../../../../  (4 levels up)
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

function findSchemaFile(startDir: string): string | null {
  // Walk up directories until we find init_database.sql/ or docs/
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'init_database.sql', '01_schema.sql');
    if (fs.existsSync(candidate)) return candidate;
    const fallback = path.join(dir, 'docs', '01_schema.sql');
    if (fs.existsSync(fallback)) return fallback;
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

  // Check if schema is already applied (tables exist)
  const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });
  try {
    const res = await pool.query(
      `SELECT COUNT(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'`
    );
    if (parseInt(res.rows[0].count) > 0) {
      console.log('[globalSetup] Schema already applied — skipping.');
      await pool.end();
      return;
    }
  } catch (err) {
    console.warn('[globalSetup] Could not check schema status:', err);
    await pool.end().catch(() => {});
  }
  await pool.end().catch(() => {});

  // Find schema file by walking up from __dirname
  const schemaFile = findSchemaFile(__dirname);
  if (!schemaFile) {
    console.warn('[globalSetup] Schema file not found — assuming already applied by CI.');
    return;
  }

  console.log(`[globalSetup] Applying schema from: ${schemaFile}`);
  execSync(`psql "${dbUrl}" -f "${schemaFile}"`, { stdio: 'inherit' });
  console.log('[globalSetup] Schema applied successfully.');
}
