import { pool } from './src/config/database';
import fs from 'fs';
import path from 'path';

async function migrate() {
    try {
        const sqlPath = path.join(__dirname, '../../init_database.sql/05_orders_crypto_pricing.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Applying migration...');
        await pool.query(sql);
        console.log('Migration applied successfully!');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}
migrate();
