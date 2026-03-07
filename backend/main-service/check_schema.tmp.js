const { Pool } = require('pg');
require('dotenv').config();

async function check() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
        console.log('Columns:', res.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
