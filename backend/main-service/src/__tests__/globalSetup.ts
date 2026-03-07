/**
 * Runs ONCE before all test suites.
 * Applies the database schema if the DB is reachable and schema not yet applied.
 * Gracefully skips when DB is unreachable (schema already applied by CI psql step).
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import 'dotenv/config';

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
  let dbReachable = false;

  try {
    const res = await pool.query(
      `SELECT COUNT(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'`
    );
    dbReachable = true;
    schemaExists = parseInt(res.rows[0].count) > 0;
  } catch {
    // DB not reachable — likely schema already applied by CI psql command
    dbReachable = false;
  }

  if (!dbReachable) {
    console.warn('[globalSetup] DB not reachable — assuming schema already applied by CI.');
    await pool.end().catch(() => { });
    return;
  }

  if (schemaExists) {
    console.log('[globalSetup] Dropping existing schema to ensure fresh start...');
    const client = await pool.connect();
    try {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await client.query('GRANT ALL ON SCHEMA public TO public;');
      await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    } finally {
      client.release();
    }
  }

  await pool.end().catch(() => { });

  const schemaFile = findSchemaFile(__dirname);
  if (!schemaFile) {
    console.warn('[globalSetup] Schema file not found — skipping (assume CI handles it).');
    return;
  }

  console.log(`[globalSetup] Applying schema from: ${schemaFile}`);
  execSync(`psql "${dbUrl}" -f "${schemaFile}"`, { stdio: 'inherit' });

  const seedFile = schemaFile.replace('01_schema.sql', '02_seed_data.sql');
  if (fs.existsSync(seedFile)) {
    console.log(`[globalSetup] Applying seed data from: ${seedFile}`);
    execSync(`psql "${dbUrl}" -f "${seedFile}"`, { stdio: 'inherit' });
  }

  console.log('[globalSetup] Database initialization complete.');
}
