const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:kien2909@localhost:5433/marketplace_db' });

async function resetPasswords() {
    try {
        const adminHash = await bcrypt.hash('Admin123!', 10);
        const sellerHash = await bcrypt.hash('Seller123!', 10);
        const buyerHash = await bcrypt.hash('Buyer123!', 10);

        // Reset admin
        let r = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE email = 'admin@marketplace.com' RETURNING email",
            [adminHash]
        );
        console.log('Admin reset:', r.rows[0]?.email);

        // Reset sellers
        r = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE role = 'seller' RETURNING email",
            [sellerHash]
        );
        console.log('Sellers reset:', r.rows.map(u => u.email));

        // Reset buyers
        r = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE role = 'buyer' RETURNING email",
            [buyerHash]
        );
        console.log('Buyers reset:', r.rows.map(u => u.email));

        // Verify
        const verify = await pool.query('SELECT email, role FROM users ORDER BY user_id');
        console.log('\nAll users:');
        verify.rows.forEach(u => console.log(' -', u.email, '|', u.role));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        pool.end();
    }
}

resetPasswords();
