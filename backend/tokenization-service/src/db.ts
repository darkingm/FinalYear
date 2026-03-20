import { Pool } from 'pg';

export const pool = new Pool({
    connectionString: process.env.TOKENIZATION_DATABASE_URL || process.env.DATABASE_URL,
});

export async function query(text: string, params?: any[]) {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
}
