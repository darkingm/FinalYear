/**
 * Runs ONCE before all test suites.
 * Applies the database schema to the test PostgreSQL instance.
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL must be set for tests');
  }

  const schemaFile = path.resolve(__dirname, '../../../../../init_database.sql/01_schema.sql');
  if (!fs.existsSync(schemaFile)) {
    // Try docs/ folder fallback
    const fallback = path.resolve(__dirname, '../../../../../docs/01_schema.sql');
    if (!fs.existsSync(fallback)) {
      throw new Error(`Schema file not found: ${schemaFile}`);
    }
    console.log('[globalSetup] Applying schema to test DB...');
    execSync(`psql "${dbUrl}" -f "${fallback}"`, { stdio: 'inherit' });
  } else {
    console.log('[globalSetup] Applying schema to test DB...');
    execSync(`psql "${dbUrl}" -f "${schemaFile}"`, { stdio: 'inherit' });
  }

  console.log('[globalSetup] Schema applied successfully.');
}
