const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
    try {
        console.log('--- Step 1: DB query ---');
        const r = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', ['admin@marketplace.com']);
        if (r.rows.length === 0) { console.log('USER NOT FOUND'); return; }
        const user = r.rows[0];
        console.log('Found user:', user.email, '| role:', user.role, '| status:', user.status);
        console.log('has password_hash:', !!user.password_hash);

        console.log('\n--- Step 2: bcrypt.compare ---');
        const isValid = await bcrypt.compare('Admin123!', user.password_hash);
        console.log('Password match:', isValid);
        if (!isValid) { console.log('STOP: password mismatch'); return; }

        console.log('\n--- Step 3: JWT sign ---');
        console.log('JWT_SECRET:', process.env.JWT_SECRET);
        console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET);
        const payload = { user_id: user.user_id, email: user.email, role: user.role };
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
        const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
        console.log('accessToken (first 40 chars):', accessToken.substring(0, 40) + '...');
        console.log('refreshToken (first 40 chars):', refreshToken.substring(0, 40) + '...');

        console.log('\n--- Step 4: sanitizeUser ---');
        const { password_hash, nonce, ...sanitized } = user;
        console.log('sanitized user keys:', Object.keys(sanitized));

        console.log('\nALL STEPS PASSED ✅');
    } catch (e) {
        console.error('\n❌ ERROR at step:', e.message);
        console.error(e.stack);
    } finally {
        pool.end();
    }
}

test();
