/**
 * seed-rwa-assets.mjs — run once to create 5 realistic RWA assets
 * Usage: node scripts/seed-rwa-assets.mjs
 * Requires the backend to be running on http://localhost:3001
 *
 * Auth: uses admin credentials or skips auth if API is open
 */
import fetch from 'node-fetch';

const BASE = process.env.API_URL || 'http://localhost:3001';

const ASSETS = [
    {
        name: 'Vinhomes Grand Park – Phân khu The Rainbow',
        symbol: 'VHGP-TK01',
        asset_type: 'REAL_ESTATE',
        description:
            'Tổ hợp căn hộ cao cấp tại TP. Thủ Đức, TP.HCM. Diện tích 271 ha, 44 tòa tháp, tiện ích Singapore Garden. Khu đất sạch, sổ hồng riêng từng căn. Token hóa quyền hưởng lợi tức từ cho thuê.',
        location: 'Long Bình, Thủ Đức, Hồ Chí Minh',
        total_valuation_usd: 120_000_000,
        price_per_token_usd: 500,
        expected_apy: 8.5,
        legal_doc_ipfs: 'bafybeigvfmztsjqctbxzpjukrcz4hle3vmrp553mmqzxcvovlf3yvxdmh4', // Real Vietnamese property doc on IPFS
    },
    {
        name: 'Trái phiếu VPBank 2026 – Lãi suất cố định 9.2%/năm',
        symbol: 'VPB-BD2026',
        asset_type: 'BOND',
        description:
            'Trái phiếu doanh nghiệp VPBank kỳ hạn 2 năm, lãi suất cố định 9.2%/năm, trả lãi định kỳ 6 tháng. Được bảo lãnh bởi tài sản thế chấp của ngân hàng. Mệnh giá gốc 100 triệu VND.',
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
        description:
            'Cổ phần VinFast (VFS) trước IPO lần hai, định giá 14.2 tỷ USD. VinFast đang mở rộng thị trường Mỹ, EU, Indonesia. Cổ đông hưởng quyền cổ tức và ưu đãi mua xe. Cam kết lock-up 12 tháng.',
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
        description:
            'Token hóa 500 tấn cà phê Arabica chất lượng cao từ Gia Lai, Việt Nam. Được chứng nhận Rainforest Alliance, lưu kho có bảo hiểm. Giá niêm yết theo CME Coffee C. Đáo hạn Thu Hoạch 2025.',
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
        description:
            'Dự án biệt thự và shophouse cao cấp tại Ocean Park Gia Lâm, Hà Nội. 2km mặt hồ muối Vinhomes, tiện ích resort 5 sao. Tỷ suất thuê bình quân 7.8%/năm dựa trên dữ liệu quản lý thực tế.',
        location: 'Gia Lâm, Hà Nội, Việt Nam',
        total_valuation_usd: 85_000_000,
        price_per_token_usd: 200,
        expected_apy: 7.8,
        legal_doc_ipfs: 'bafybeifz3zhk7zvjt4hklzq7avzzxr3vy54qfpxztmwkifm26m7dnkqjtu',
    },
];

async function seedAssets() {
    console.log('🌱 Seeding 5 RWA assets...\n');

    for (const asset of ASSETS) {
        try {
            // Create asset
            const createRes = await fetch(`${BASE}/api/rwa/assets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(asset),
            });
            const createData = await createRes.json();

            if (!createRes.ok) {
                console.error(`❌ Failed to create ${asset.symbol}:`, createData.error || createData);
                continue;
            }

            const assetId = createData.asset?.asset_id || createData.asset_id;
            console.log(`✅ Created: ${asset.name} (${asset.symbol}) → id: ${assetId}`);

            // Activate asset
            if (assetId) {
                const activateRes = await fetch(`${BASE}/api/rwa/assets/${assetId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'ACTIVE' }),
                });
                if (activateRes.ok) {
                    console.log(`   ✅ Activated → ACTIVE`);
                } else {
                    const err = await activateRes.json();
                    console.warn(`   ⚠️ Could not activate:`, err.error || err);
                }
            }
        } catch (e) {
            console.error(`❌ Error seeding ${asset.symbol}:`, e.message);
        }
    }

    console.log('\n🏁 Done seeding RWA assets.');
}

seedAssets();
