/**
 * seed-rwa-direct.mjs — insert RWA assets DIRECTLY into PostgreSQL
 * Bypasses the API layer entirely. No services need to be running.
 * Usage: node scripts/seed-rwa-direct.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:kien2909@localhost:5433/marketplace_db',
});

const ASSETS = [
    {
        name: 'Vinhomes Grand Park – Phân khu The Rainbow',
        symbol: 'VHGP-TK01',
        asset_type: 'REAL_ESTATE',
        description: 'Tổ hợp căn hộ cao cấp tại TP. Thủ Đức, TP.HCM. Diện tích 271 ha, 44 tòa tháp, tiện ích Singapore Garden. Token hóa quyền hưởng lợi tức từ cho thuê.',
        location: 'Long Bình, Thủ Đức, Hồ Chí Minh',
        total_valuation_usd: 120_000_000,
        price_per_token_usd: 500,
        expected_apy: 8.5,
        legal_doc_ipfs: 'bafybeigvfmztsjqctbxzpjukrcz4hle3vmrp553mmqzxcvovlf3yvxdmh4',
    },
    {
        name: 'Trái phiếu VPBank 2026 – Lãi suất cố định 9.2%/năm',
        symbol: 'VPB-BD2026',
        asset_type: 'BOND',
        description: 'Trái phiếu doanh nghiệp VPBank kỳ hạn 2 năm, lãi suất cố định 9.2%/năm. Mệnh giá gốc 100 triệu VND.',
        location: 'Hà Nội, Việt Nam',
        total_valuation_usd: 50_000_000,
        price_per_token_usd: 100,
        expected_apy: 9.2,
        legal_doc_ipfs: 'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf26q',
    },
    {
        name: 'VinFast Auto – Cổ phần Series B Pre-IPO',
        symbol: 'VFS-PRE',
        asset_type: 'EQUITY',
        description: 'Cổ phần VinFast (VFS) trước IPO lần hai, định giá 14.2 tỷ USD. Cam kết lock-up 12 tháng.',
        location: 'Hải Phòng, Việt Nam',
        total_valuation_usd: 30_000_000,
        price_per_token_usd: 250,
        expected_apy: null,
        legal_doc_ipfs: 'bafybeicl6m3fpuuwmmk4aq5lm4yfvgd73tqp6x6xvwb5u7g2gp3o7ycai',
    },
    {
        name: 'Cà phê Arabica – Kho hàng Gia Lai Premium Reserve',
        symbol: 'CAFE-GL01',
        asset_type: 'COMMODITY',
        description: '500 tấn cà phê Arabica chất lượng cao từ Gia Lai, lưu kho có bảo hiểm. Đáo hạn Thu Hoạch 2025.',
        location: 'Pleiku, Gia Lai, Việt Nam',
        total_valuation_usd: 1_800_000,
        price_per_token_usd: 50,
        expected_apy: 12.0,
        legal_doc_ipfs: 'bafybeid6s4wfhpegqbmxd4sbizd6cw5z3gjnytg45haq3rscchxm64iq4q',
    },
    {
        name: 'Masteri Waterfront – Ocean Park Hà Nội',
        symbol: 'MAST-OP01',
        asset_type: 'REAL_ESTATE',
        description: 'Biệt thự và shophouse cao cấp tại Ocean Park Gia Lâm, Hà Nội. Tỷ suất thuê 7.8%/năm.',
        location: 'Gia Lâm, Hà Nội, Việt Nam',
        total_valuation_usd: 85_000_000,
        price_per_token_usd: 200,
        expected_apy: 7.8,
        legal_doc_ipfs: 'bafybeifz3zhk7zvjt4hklzq7avzzxr3vy54qfpxztmwkifm26m7dnkqjtu',
    },
];

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

async function seed() {
    console.log('🌱 Seeding RWA assets directly into DB...\n');
    const client = await pool.connect();
    try {
        for (const a of ASSETS) {
            const totalTokens = Math.floor(a.total_valuation_usd / a.price_per_token_usd);
            const assetId = crypto.randomUUID();

            try {
                // check if symbol already exists
                const existing = await client.query('SELECT asset_id FROM rwa_assets WHERE symbol=$1', [a.symbol]);
                if (existing.rows.length > 0) {
                    console.log(`⏭️  Skip ${a.symbol} — already exists`);
                    continue;
                }

                await client.query(
                    `INSERT INTO rwa_assets
            (asset_id, name, symbol, asset_type, description, location,
             total_valuation_usd, price_per_token_usd, total_tokens,
             legal_doc_ipfs, expected_apy, status,
             token_contract_address, distributor_contract_address, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ACTIVE',$12,$12,NOW())`,
                    [
                        assetId, a.name, a.symbol, a.asset_type, a.description, a.location,
                        a.total_valuation_usd, a.price_per_token_usd, totalTokens,
                        a.legal_doc_ipfs, a.expected_apy,
                        ZERO_ADDR,
                    ]
                );
                console.log(`✅ ${a.symbol} — ${a.name}`);
            } catch (e) {
                console.error(`❌ ${a.symbol}: ${e.message}`);
            }
        }
    } finally {
        client.release();
        await pool.end();
    }
    console.log('\n🏁 Done!');
}

seed();
