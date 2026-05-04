/**
 * test-kyc-upload.js
 * ─────────────────────────────────────────────────────────────────
 * Kiểm tra toàn bộ luồng KYC upload:
 *   1. Kiểm tra Cloudinary credentials (local .env)
 *   2. Upload ảnh test lên Cloudinary trực tiếp (bypass API)
 *   3. Test API /api/kyc/upload-document LOCAL  (port 3001)
 *   4. Test API /api/kyc/upload-document VPS    (kienai.id.vn)
 *
 * Chạy: node scripts/test-kyc-upload.js
 * Yêu cầu: node >= 18 (fetch built-in) + có file .env trong backend/main-service
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── Load .env từ backend/main-service ────────────────────────────
const envPath = path.join(__dirname, '../backend/main-service/.env');
const dockerEnvPath = path.join(__dirname, '../docker/.env');

function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/\r$/, '');
        env[key] = val;
    }
    return env;
}

const localEnv = loadEnv(envPath);
const dockerEnv = loadEnv(dockerEnvPath);

// ── Colors ────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    red:   '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan:  '\x1b[36m',
    bold:  '\x1b[1m',
};
const ok   = (s) => console.log(`  ${C.green}✓${C.reset} ${s}`);
const fail = (s) => console.log(`  ${C.red}✗${C.reset} ${s}`);
const warn = (s) => console.log(`  ${C.yellow}⚠${C.reset} ${s}`);
const info = (s) => console.log(`  ${C.cyan}ℹ${C.reset} ${s}`);
const sep  = ()  => console.log(`\n${C.bold}${'─'.repeat(60)}${C.reset}`);

// ── Tạo ảnh test nhỏ (PNG 1x1 pixel) ────────────────────────────
function createTestImageBuffer() {
    // PNG 1×1 màu vàng (#f0b90b)
    const PNG_1x1 = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
        '2e0000000c4944415478016360f8cf000001020001e221bc330000000049454e44ae426082',
        'hex'
    );
    return PNG_1x1;
}

// ── Test 1: Kiểm tra credentials ─────────────────────────────────
async function checkCredentials() {
    sep();
    console.log(`${C.bold}[1] Kiểm tra Cloudinary Credentials${C.reset}`);

    const cloudName = localEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey    = localEnv.CLOUDINARY_API_KEY;
    const apiSecret = localEnv.CLOUDINARY_API_SECRET;

    const PLACEHOLDERS = ['your_cloudinary_cloud', 'your_cloudinary_key', 'your_cloudinary_secret', ''];

    let allOk = true;

    if (!cloudName || PLACEHOLDERS.includes(cloudName)) {
        fail(`LOCAL .env: CLOUDINARY_CLOUD_NAME = "${cloudName}" ← CHƯA CẤU HÌNH!`);
        allOk = false;
    } else {
        ok(`LOCAL .env: CLOUDINARY_CLOUD_NAME = "${cloudName}"`);
    }

    if (!apiKey || PLACEHOLDERS.includes(apiKey)) {
        fail(`LOCAL .env: CLOUDINARY_API_KEY = "${apiKey}" ← CHƯA CẤU HÌNH!`);
        allOk = false;
    } else {
        ok(`LOCAL .env: CLOUDINARY_API_KEY = "${apiKey.slice(0, 6)}..."`);
    }

    if (!apiSecret || PLACEHOLDERS.includes(apiSecret)) {
        fail(`LOCAL .env: CLOUDINARY_API_SECRET = "${apiSecret}" ← CHƯA CẤU HÌNH!`);
        allOk = false;
    } else {
        ok(`LOCAL .env: CLOUDINARY_API_SECRET = "${apiSecret.slice(0, 6)}..."`);
    }

    // Kiểm tra docker/.env
    console.log('');
    const dockerCloud = dockerEnv.CLOUDINARY_CLOUD_NAME;
    const dockerKey   = dockerEnv.CLOUDINARY_API_KEY;
    const dockerSec   = dockerEnv.CLOUDINARY_API_SECRET;

    if (!dockerCloud) {
        fail(`docker/.env: CLOUDINARY_CLOUD_NAME KHÔNG TỒN TẠI ← VPS sẽ dùng biến trống!`);
    } else if (PLACEHOLDERS.includes(dockerCloud)) {
        fail(`docker/.env: CLOUDINARY_CLOUD_NAME = "${dockerCloud}" ← placeholder!`);
    } else {
        ok(`docker/.env: CLOUDINARY_CLOUD_NAME = "${dockerCloud}"`);
    }

    if (!allOk) {
        warn('→ Credentials chưa đúng. Xem hướng dẫn fix bên dưới.');
    }

    return { cloudName, apiKey, apiSecret, allOk };
}

// ── Test 2: Upload thẳng lên Cloudinary API ───────────────────────
async function testCloudinaryDirect(cloudName, apiKey, apiSecret) {
    sep();
    console.log(`${C.bold}[2] Test Upload Thẳng Lên Cloudinary API${C.reset}`);

    if (!cloudName || !apiKey || !apiSecret ||
        ['your_cloudinary_cloud','your_cloudinary_key','your_cloudinary_secret'].includes(cloudName)) {
        warn('Bỏ qua — credentials chưa được cấu hình');
        return false;
    }

    try {
        // Tạo signature
        const crypto = require('crypto');
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = 'marketplace/kyc-documents';
        const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(toSign).digest('hex');

        // Build FormData thủ công (multipart)
        const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
        const imgBuffer = createTestImageBuffer();

        const parts = [
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`,
            imgBuffer,
            `\r\n--${boundary}\r\nContent-Disposition: form-data; name="api_key"\r\n\r\n${apiKey}`,
            `\r\n--${boundary}\r\nContent-Disposition: form-data; name="timestamp"\r\n\r\n${timestamp}`,
            `\r\n--${boundary}\r\nContent-Disposition: form-data; name="signature"\r\n\r\n${signature}`,
            `\r\n--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folder}`,
            `\r\n--${boundary}--\r\n`,
        ];

        const bodyParts = parts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
        const body = Buffer.concat(bodyParts);

        const result = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.cloudinary.com',
                path: `/v1_1/${cloudName}/image/upload`,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length,
                },
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });

        const json = JSON.parse(result.body);
        if (result.status === 200 && json.secure_url) {
            ok(`Upload thành công!`);
            ok(`URL: ${json.secure_url}`);
            ok(`Public ID: ${json.public_id}`);
            info(`→ Xóa ảnh test: https://cloudinary.com/console (folder: marketplace/kyc-documents)`);
            return true;
        } else {
            fail(`Upload thất bại! HTTP ${result.status}`);
            fail(`Lỗi: ${json.error?.message || result.body}`);
            return false;
        }
    } catch (err) {
        fail(`Lỗi kết nối Cloudinary: ${err.message}`);
        return false;
    }
}

// ── Test 3 & 4: Test API endpoint ────────────────────────────────
async function testKYCEndpoint(label, baseUrl, token) {
    sep();
    console.log(`${C.bold}[${label}] Test API ${baseUrl}/api/kyc/upload-document${C.reset}`);

    if (!token) {
        warn('Không có JWT token → bỏ qua test API (cần đăng nhập trước)');
        info('Để test API, truyền token qua biến môi trường: TEST_JWT=<token> node scripts/test-kyc-upload.js');
        return;
    }

    const boundary = '----Boundary' + Math.random().toString(36).slice(2);
    const imgBuffer = createTestImageBuffer();

    const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="kyc_test.png"\r\nContent-Type: image/png\r\n\r\n`,
        imgBuffer,
        `\r\n--${boundary}--\r\n`,
    ];
    const body = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));

    const isHttps = baseUrl.startsWith('https');
    const urlObj = new URL(baseUrl + '/api/kyc/upload-document');

    const result = await new Promise((resolve, reject) => {
        const lib = isHttps ? https : http;
        const req = lib.request({
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
                'Authorization': `Bearer ${token}`,
            },
            timeout: 15000,
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout 15s')); });
        req.write(body);
        req.end();
    });

    try {
        const json = JSON.parse(result.body);
        if (result.status === 200 && json.url) {
            ok(`API trả về URL: ${json.url}`);
        } else if (result.status === 401) {
            warn(`HTTP 401 — Token không hợp lệ hoặc hết hạn`);
        } else if (result.status === 500) {
            fail(`HTTP 500 — Server lỗi: ${json.error || result.body}`);
            if (json.error?.includes('cloudinary') || result.body.toLowerCase().includes('cloudinary')) {
                fail('→ Lỗi Cloudinary! Credentials chưa đúng trên server này.');
            }
        } else {
            info(`HTTP ${result.status}: ${result.body.slice(0, 200)}`);
        }
    } catch {
        fail(`Response không phải JSON: ${result.body.slice(0, 200)}`);
    }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${C.bold}${C.cyan}═══ KYC UPLOAD DIAGNOSTIC ═══${C.reset}`);
    console.log(`Thời gian: ${new Date().toLocaleString('vi-VN')}`);

    const { cloudName, apiKey, apiSecret, allOk } = await checkCredentials();
    await testCloudinaryDirect(cloudName, apiKey, apiSecret);

    const token = process.env.TEST_JWT;
    await testKYCEndpoint('3', 'http://localhost:3001', token).catch(e => fail(`Local API không reachable: ${e.message}`));
    await testKYCEndpoint('4', 'https://kienai.id.vn', token).catch(e => fail(`VPS API không reachable: ${e.message}`));

    sep();
    console.log(`\n${C.bold}📋 TÓM TẮT VẤN ĐỀ & CÁCH FIX:${C.reset}\n`);

    if (!allOk) {
        console.log(`${C.red}❌ NGUYÊN NHÂN CHÍNH: Cloudinary credentials chưa được cấu hình!${C.reset}`);
        console.log(`
${C.bold}Bước 1: Lấy credentials Cloudinary${C.reset}
  → Vào https://cloudinary.com/console
  → Copy: Cloud Name, API Key, API Secret

${C.bold}Bước 2: Cập nhật LOCAL (backend/main-service/.env)${C.reset}
  CLOUDINARY_CLOUD_NAME=<cloud_name_thật>
  CLOUDINARY_API_KEY=<api_key_thật>
  CLOUDINARY_API_SECRET=<api_secret_thật>

${C.bold}Bước 3: Cập nhật VPS (docker/.env)${C.reset}
  Thêm vào docker/.env:
  CLOUDINARY_CLOUD_NAME=<cloud_name_thật>
  CLOUDINARY_API_KEY=<api_key_thật>
  CLOUDINARY_API_SECRET=<api_secret_thật>

  Sau đó deploy lại trên VPS:
  docker compose --env-file docker/.env up -d main-service

${C.bold}Bước 4: Test lại${C.reset}
  node scripts/test-kyc-upload.js
`);
    } else {
        console.log(`${C.green}✓ Credentials OK — nếu vẫn lỗi, chạy lại với TEST_JWT để test API endpoint${C.reset}`);
    }
}

main().catch(console.error);
