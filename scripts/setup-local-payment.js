#!/usr/bin/env node
/**
 * setup-local-payment.js
 *
 * Script bootstrap toàn diện cho môi trường dev local.
 * Chạy lệnh: node scripts/setup-local-payment.js
 *
 * Thực hiện:
 *   1. Verify Hardhat node đang chạy tại http://127.0.0.1:8545
 *   2. Verify EscrowCore contract đã deploy tại địa chỉ cấu hình
 *   3. Kiểm tra OPERATOR_ROLE đã được grant cho deployer (Account #0)
 *   4. Seed token_whitelist cho chain 31337 (ETH native)
 *   5. Update seller payout_wallet sang Hardhat Account #1
 *   6. Seed sample product accepted_tokens metadata (nếu cần)
 *   7. Print hướng dẫn MetaMask setup và danh sách accounts
 */

'use strict';

const path = require('path');

// Resolve modules from payment-service since that's where deps are installed
const paymentSvcDir = path.resolve(__dirname, '..', 'backend', 'payment-service');
const ethersModule = require(path.join(paymentSvcDir, 'node_modules', 'ethers'));
const { Pool } = require(path.join(paymentSvcDir, 'node_modules', 'pg'));
const dotenv = require(path.join(paymentSvcDir, 'node_modules', 'dotenv'));
const { ethers } = ethersModule;

// ─── Config ────────────────────────────────────────────────────────────────

const HARDHAT_RPC = process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545';
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_LOCALHOST || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:kien2909@localhost:5433/marketplace_db';
const PAYMENT_DB_URL = process.env.PAYMENT_DATABASE_URL || DATABASE_URL; // payment-service có thể dùng DB riêng
const DEPLOYER_PK = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Hardhat well-known accounts
const HARDHAT_ACCOUNTS = [
    { index: 0, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', role: 'Deployer / Buyer (bạn import vào MetaMask)' },
    { index: 1, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', role: 'Seller (nhận tiền escrow)' },
    { index: 2, address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', role: 'Spare account #2' },
    { index: 3, address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', role: 'Spare account #3' },
];

const ESCROW_ABI_MINI = [
    'function OPERATOR_ROLE() external view returns (bytes32)',
    'function hasRole(bytes32 role, address account) external view returns (bool)',
    'function grantRole(bytes32 role, address account) external',
    'function getOrder(bytes32 orderId) external view returns (tuple(address buyer, address seller, address token, uint256 amount, uint256 fee, uint8 status, uint256 createdAt, uint256 expiresAt))',
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function log(emoji, msg) {
    console.log(`  ${emoji}  ${msg}`);
}

function section(title) {
    console.log('\n' + bold(cyan(`── ${title} `)) + cyan('─'.repeat(Math.max(0, 50 - title.length))));
}

function ok(msg) { log('✅', green(msg)); }
function warn(msg) { log('⚠️ ', yellow(msg)); }
function err(msg) { log('❌', red(msg)); }
function info(msg) { log('ℹ️ ', msg); }

// ─── Step 1: Verify Hardhat Node ───────────────────────────────────────────

async function checkHardhatNode(provider) {
    section('STEP 1: Kiểm tra Hardhat Node');
    try {
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        const chainId = Number(network.chainId);

        if (chainId !== 31337) {
            warn(`Chain ID ${chainId} không phải Hardhat (31337). Kiểm tra lại RPC URL.`);
            return false;
        }

        ok(`Hardhat node đang chạy tại ${HARDHAT_RPC}`);
        ok(`Chain ID: ${chainId} | Block mới nhất: #${blockNumber}`);

        // Kiểm tra balance của các accounts
        const bal0 = await provider.getBalance(HARDHAT_ACCOUNTS[0].address);
        const bal1 = await provider.getBalance(HARDHAT_ACCOUNTS[1].address);
        info(`Account #0 (Buyer):  ${ethers.formatEther(bal0)} ETH  → ${HARDHAT_ACCOUNTS[0].address}`);
        info(`Account #1 (Seller): ${ethers.formatEther(bal1)} ETH  → ${HARDHAT_ACCOUNTS[1].address}`);

        return true;
    } catch (e) {
        err(`Không kết nối được Hardhat node tại ${HARDHAT_RPC}`);
        err(`Lỗi: ${e.message}`);
        console.log('\n  👉 Chạy lệnh sau để start Hardhat node:');
        console.log(bold('      cd contracts && npx hardhat node\n'));
        return false;
    }
}

// ─── Step 2: Verify EscrowCore Contract ────────────────────────────────────

async function checkContract(provider, signer) {
    section('STEP 2: Kiểm tra EscrowCore Contract');
    try {
        const code = await provider.getCode(ESCROW_ADDRESS);

        if (!code || code === '0x') {
            err(`Không tìm thấy contract tại ${ESCROW_ADDRESS}`);
            warn('Hardhat node có thể đã bị restart và mất state. Cần redeploy!');
            console.log('\n  👉 Chạy lệnh này để redeploy:');
            console.log(bold('      cd contracts && npx hardhat run scripts/deploy.ts --network localhost\n'));
            return false;
        }

        ok(`EscrowCore contract tồn tại tại: ${ESCROW_ADDRESS}`);
        info(`Contract code size: ${(code.length - 2) / 2} bytes`);

        // Kiểm tra OPERATOR_ROLE
        const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI_MINI, provider);
        const OPERATOR_ROLE = await escrow.OPERATOR_ROLE();
        const deployerHasRole = await escrow.hasRole(OPERATOR_ROLE, HARDHAT_ACCOUNTS[0].address);

        if (deployerHasRole) {
            ok(`Deployer (Account #0) đã có OPERATOR_ROLE`);
        } else {
            warn(`Deployer chưa có OPERATOR_ROLE. Đang grant...`);
            const escrowWithSigner = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI_MINI, signer);
            const tx = await escrowWithSigner.grantRole(OPERATOR_ROLE, HARDHAT_ACCOUNTS[0].address);
            await tx.wait();
            ok(`Đã grant OPERATOR_ROLE cho Account #0: ${tx.hash}`);
        }

        return true;
    } catch (e) {
        err(`Lỗi khi kiểm tra contract: ${e.message}`);
        return false;
    }
}

// ─── Step 3: Seed DB — token_whitelist ─────────────────────────────────────

async function seedTokenWhitelist(pool) {
    section('STEP 3: Seed token_whitelist cho chain 31337');
    try {
        // ETH native (address(0))
        const existingEth = await pool.query(
            "SELECT token_id, is_active FROM token_whitelist WHERE chain_id = 31337 AND symbol = 'ETH'"
        );

        if (existingEth.rows.length === 0) {
            await pool.query(
                `INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                ['ETH', '0x0000000000000000000000000000000000000000', 31337, 18, true,
                    JSON.stringify({ name: 'Ethereum (Hardhat Local)', type: 'native', description: 'Native currency of Hardhat local network' })]
            );
            ok('Đã insert ETH native (addr(0)) cho chain 31337');
        } else if (!existingEth.rows[0].is_active) {
            await pool.query(
                "UPDATE token_whitelist SET is_active = true WHERE chain_id = 31337 AND symbol = 'ETH'"
            );
            ok('Đã kích hoạt lại ETH cho chain 31337');
        } else {
            ok('ETH native (chain 31337) đã tồn tại và active');
        }

        // Deactivate fake USDT cho chain 31337 (Polygon USDT address không có trên Hardhat)
        const deactivated = await pool.query(
            "UPDATE token_whitelist SET is_active = false WHERE chain_id = 31337 AND symbol != 'ETH' RETURNING symbol"
        );
        if (deactivated.rows.length > 0) {
            const syms = deactivated.rows.map(r => r.symbol).join(', ');
            warn(`Đã deactivate các token không hợp lệ cho chain 31337: ${syms}`);
        }

        // Verify kết quả
        const tokens = await pool.query(
            'SELECT symbol, token_address, decimals, is_active FROM token_whitelist WHERE chain_id = 31337 ORDER BY symbol'
        );
        info('Token whitelist chain 31337:');
        tokens.rows.forEach(t => {
            const status = t.is_active ? green('active') : yellow('inactive');
            console.log(`     ${t.symbol.padEnd(8)} ${t.token_address.slice(0, 20)}...  [${status}]`);
        });

        return true;
    } catch (e) {
        err(`Lỗi seed token_whitelist: ${e.message}`);
        return false;
    }
}

// ─── Step 4: Update Seller Payout Wallets ──────────────────────────────────

async function updateSellerWallets(pool) {
    section('STEP 4: Kiểm tra & Update seller payout_wallet');

    const SELLER_WALLET = HARDHAT_ACCOUNTS[1].address; // Account #1

    try {
        // Lấy danh sách sellers
        const sellers = await pool.query(
            `SELECT sp.seller_id, u.email, u.username, sp.payout_wallet
       FROM seller_profiles sp
       JOIN users u ON u.user_id = sp.seller_id
       ORDER BY sp.seller_id`
        );

        const isValidWallet = (w) => w && /^0x[0-9a-fA-F]{40}$/.test(w);

        let updated = 0;
        for (const seller of sellers.rows) {
            if (!isValidWallet(seller.payout_wallet)) {
                await pool.query(
                    'UPDATE seller_profiles SET payout_wallet = $1 WHERE seller_id = $2',
                    [SELLER_WALLET, seller.seller_id]
                );
                ok(`Đã update wallet cho seller: ${seller.email} → ${SELLER_WALLET}`);
                updated++;
            } else {
                ok(`Seller ${seller.email}: wallet hợp lệ → ${seller.payout_wallet}`);
            }
        }

        if (updated === 0) {
            info('Tất cả seller đã có payout_wallet hợp lệ');
        } else {
            info(`Đã update ${updated} seller(s)`);
        }

        return true;
    } catch (e) {
        err(`Lỗi update seller wallets: ${e.message}`);
        return false;
    }
}

// ─── Step 5: Update Product accepted_tokens để hiện ETH ─────────────────────

async function updateProductTokens(pool) {
    section('STEP 5: Update product metadata — accepted_tokens');
    try {
        // Lấy số sản phẩm không có accepted_tokens
        const noTokens = await pool.query(
            `SELECT COUNT(*) AS cnt FROM products
       WHERE metadata IS NULL
          OR metadata->>'accepted_tokens' IS NULL
          OR metadata->'accepted_tokens'->>'crypto' IS NULL`
        );
        const count = parseInt(noTokens.rows[0].cnt);

        if (count === 0) {
            ok('Tất cả sản phẩm đã có accepted_tokens');
            return true;
        }

        // Update tất cả products chưa có accepted_tokens → thêm ETH
        await pool.query(
            `UPDATE products
       SET metadata = COALESCE(metadata, '{}'::jsonb) ||
         '{"accepted_tokens": {"crypto": ["ETH", "MATIC", "USDT"], "fiat": ["paypal"]}}'::jsonb
       WHERE metadata IS NULL
          OR metadata->>'accepted_tokens' IS NULL
          OR metadata->'accepted_tokens'->>'crypto' IS NULL`
        );
        ok(`Đã update ${count} sản phẩm với accepted_tokens: ETH, MATIC, USDT`);

        return true;
    } catch (e) {
        warn(`Không thể update product metadata: ${e.message} (không ảnh hưởng payment flow chính)`);
        return true;
    }
}

// ─── Step 6: Verify Payment Flow Readiness ─────────────────────────────────

async function verifyPaymentFlow(pool, provider) {
    section('STEP 6: Xác minh Payment Flow sẵn sàng');
    let allGood = true;

    // Check 1: token_whitelist có ETH cho chain 31337?
    const ethToken = await pool.query(
        "SELECT * FROM token_whitelist WHERE chain_id = 31337 AND symbol = 'ETH' AND is_active = true"
    );
    if (ethToken.rows.length > 0) {
        ok('token_whitelist[31337][ETH] = ✅ active');
    } else {
        err('token_whitelist[31337][ETH] chưa có! Cần seed lại.');
        allGood = false;
    }

    // Check 2: Có ít nhất 1 seller với payout_wallet hợp lệ?
    const validSellers = await pool.query(
        "SELECT COUNT(*) AS cnt FROM seller_profiles WHERE payout_wallet ~ '^0x[0-9a-fA-F]{40}$'"
    );
    const sellerCount = parseInt(validSellers.rows[0].cnt);
    if (sellerCount > 0) {
        ok(`${sellerCount} seller(s) có payout_wallet hợp lệ ✅`);
    } else {
        err('Không có seller nào có payout_wallet hợp lệ!');
        allGood = false;
    }

    // Check 3: Contract code tồn tại?
    const code = await provider.getCode(ESCROW_ADDRESS).catch(() => '0x');
    if (code && code !== '0x') {
        ok(`EscrowCore contract có code tại ${ESCROW_ADDRESS} ✅`);
    } else {
        err(`Không tìm thấy contract tại ${ESCROW_ADDRESS}. Hãy redeploy!`);
        allGood = false;
    }

    // Check 4: Có product nào UNPAID để test?
    const unpaidOrders = await pool.query(
        "SELECT COUNT(*) AS cnt FROM orders WHERE status = 'UNPAID'"
    );
    const unpaidCount = parseInt(unpaidOrders.rows[0].cnt);
    if (unpaidCount > 0) {
        ok(`${unpaidCount} đơn hàng UNPAID sẵn sàng để test`);
    } else {
        warn('Không có đơn hàng UNPAID để test. Hãy tạo đơn hàng mới qua UI.');
    }

    return allGood;
}

// ─── Print Setup Guide ──────────────────────────────────────────────────────

function printGuide() {
    section('HƯỚNG DẪN METAMASK SETUP');
    console.log(bold('\n  Thêm mạng Hardhat Local vào MetaMask:'));
    console.log('  ┌─────────────────────────────────────────┐');
    console.log('  │ Network Name:  Hardhat Local             │');
    console.log('  │ RPC URL:       http://127.0.0.1:8545     │');
    console.log('  │ Chain ID:      31337                     │');
    console.log('  │ Currency:      ETH                       │');
    console.log('  └─────────────────────────────────────────┘');

    console.log(bold('\n  Import Wallet (Buyer) — Account #0:'));
    console.log(`  Address:  ${HARDHAT_ACCOUNTS[0].address}`);
    console.log(`  Key:      ${HARDHAT_ACCOUNTS[0].privateKey}`);
    console.log(`  Balance:  ~10,000 ETH (testnet — không có giá trị thật)`);

    console.log(bold('\n  Hardhat Test Accounts (10,000 ETH mỗi account):'));
    HARDHAT_ACCOUNTS.forEach(acc => {
        console.log(`  [${acc.index}] ${acc.address}  (${acc.role})`);
    });

    section('LUỒNG THANH TOÁN ĐẦY ĐỦ');
    console.log(`
  1. 🖥️  Start Hardhat node (terminal riêng):
         cd contracts && npx hardhat node

  2. 🔑  Import Account #0 vào MetaMask:
         ${HARDHAT_ACCOUNTS[0].privateKey}

  3. 🌐  Thêm mạng Hardhat Local (Chain ID: 31337)

  4. 🛒  Mở http://localhost:3000, login: buyer1@marketplace.com / Buyer123!

  5. 📦  Thêm sản phẩm vào giỏ → Checkout

  6. 💰  Chọn: Crypto (Web3) → Token: ETH → Mạng: Localhost (Hardhat)

  7. 📋  Click "Lấy hóa đơn" 

  8. ✅  Click "Thanh toán qua MetaMask" → Confirm trong MetaMask

  9. 🎉  Order status: UNPAID → TX_SUBMITTED → ONCHAIN_CONFIRMED
  `);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n' + bold('═'.repeat(58)));
    console.log(bold('  🚀  Web3 Marketplace — Local Payment Setup Script'));
    console.log(bold('═'.repeat(58)));

    // Load .env từ payment-service nếu đang chạy từ root
    try {
        require('dotenv').config({ path: path.join(__dirname, '..', 'backend', 'payment-service', '.env') });
    } catch { }

    const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
    const signer = new ethers.Wallet(DEPLOYER_PK, provider);

    const mainPool = new Pool({ connectionString: DATABASE_URL });

    const steps = [
        () => checkHardhatNode(provider),
        () => checkContract(provider, signer),
        () => seedTokenWhitelist(mainPool),
        () => updateSellerWallets(mainPool),
        () => updateProductTokens(mainPool),
        () => verifyPaymentFlow(mainPool, provider),
    ];

    let allPassed = true;
    for (const step of steps) {
        try {
            const passed = await step();
            if (!passed) allPassed = false;
        } catch (e) {
            err(`Lỗi không mong đợi: ${e.message}`);
            allPassed = false;
        }
    }

    printGuide();

    section('KẾT QUẢ');
    if (allPassed) {
        console.log('\n  ' + bold(green('✅ Setup hoàn tất! Payment flow đã sẵn sàng.')));
        console.log('  ' + green('Bạn có thể test thanh toán ngay bây giờ.\n'));
    } else {
        console.log('\n  ' + bold(yellow('⚠️  Một số bước có vấn đề. Kiểm tra log ở trên để fix.\n')));
    }

    await mainPool.end().catch(() => { });
    process.exit(allPassed ? 0 : 1);
}

main().catch(e => {
    console.error('\n' + red(`Fatal error: ${e.message}`));
    process.exit(1);
});
