/**
 * Jest globalSetup: applies DB schema for tests.
 * Uses ONLY process.env.DATABASE_URL. Idempotent: if schema exists, skip (no DROP, no GRANT TO postgres).
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_FILENAME = '01_schema.sql';
const SEED_FILENAME = '02_seed_data.sql';

function findSchemaFile(): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'docs', SCHEMA_FILENAME),
    path.join(cwd, '..', 'docs', SCHEMA_FILENAME),
    path.join(cwd, '..', '..', 'docs', SCHEMA_FILENAME),
    path.join(cwd, '..', '..', 'init_database.sql', SCHEMA_FILENAME),
    path.join(cwd, 'init_database.sql', SCHEMA_FILENAME),
    path.join(cwd, 'backend', 'main-service', '..', '..', 'docs', SCHEMA_FILENAME),
    path.join(cwd, 'backend', 'main-service', '..', '..', 'init_database.sql', SCHEMA_FILENAME),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.normalize(p))) return path.normalize(p);
  }
  return null;
}

async function isSchemaApplied(pool: Pool): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`
  );
  return (r.rowCount ?? 0) > 0;
}

async function runSqlFile(pool: Pool, filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
}

export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.log('[globalSetup] DATABASE_URL not set — skipping.');
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  });

  try {
    if (await isSchemaApplied(pool)) {
      console.log('[globalSetup] Schema already applied — skipping.');
      return;
    }

    const schemaPath = findSchemaFile();
    if (!schemaPath) {
      console.log('[globalSetup] Schema file not found (cwd: ' + process.cwd() + ').');
      return;
    }

    console.log('[globalSetup] Applying schema from', schemaPath);
    await runSqlFile(pool, schemaPath);

    const seedPath = path.join(path.dirname(schemaPath), SEED_FILENAME);
    if (fs.existsSync(seedPath)) {
      console.log('[globalSetup] Applying seed from', seedPath);
      await runSqlFile(pool, seedPath);
    }

    console.log('[globalSetup] Done.');
  } catch (err: unknown) {
    console.error('[globalSetup] Error:', err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    await pool.end();
  }
}
