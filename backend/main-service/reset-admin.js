require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function resetAdminPassword() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('✅ Đã kết nối Database thành công.');

        const hash = await bcrypt.hash('password123', 10);
        const res = await client.query(
            "UPDATE users SET password_hash = $1 WHERE email = 'admin@marketplace.com'",
            [hash]
        );

        if (res.rowCount > 0) {
            console.log('✅ Đã cập nhật thành công mật khẩu admin thành: password123');
        } else {
            console.log('⚠️ Không tìm thấy tài khoản admin@marketplace.com trong DB.');
        }
    } catch (error) {
        console.error('❌ Lỗi Database:', error.message);
    } finally {
        await client.end();
    }
}

resetAdminPassword();
