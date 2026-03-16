/**
 * scripts/bootstrap-local.ts
 *
 * Script Hardhat để deploy hoặc verify EscrowCore trên localhost.
 * Sử dụng: npx hardhat run scripts/bootstrap-local.ts --network localhost
 *
 * Thực hiện:
 *   1. Deploy EscrowCore (nếu chưa có hoặc bị reset sau node restart)
 *   2. Grant OPERATOR_ROLE cho Account #0 (deployer = backend service wallet)
 *   3. Ghi địa chỉ contract vào deployed-local.json để setup script đọc
 *   4. Print hướng dẫn update .env
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const DEPLOYED_FILE = path.join(__dirname, '..', 'deployed-local.json');
const KNOWN_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

async function main() {
    const [deployer, seller] = await ethers.getSigners();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('     Hardhat Local Bootstrap — EscrowCore');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Deployer (Account #0): ${deployer.address}`);
    console.log(`Seller   (Account #1): ${seller.address}`);
    console.log(`Network: ${(await ethers.provider.getNetwork()).name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);

    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`);

    // ─── Check nếu contract đã deploy tại địa chỉ đã biết ──────────────────
    let escrowAddress = KNOWN_ADDRESS;
    let escrow: any;

    const existingCode = await ethers.provider.getCode(KNOWN_ADDRESS);
    if (existingCode && existingCode !== '0x') {
        console.log(`\n✅ EscrowCore đã tồn tại tại: ${KNOWN_ADDRESS}`);
        escrow = await ethers.getContractAt('EscrowCore', KNOWN_ADDRESS);
    } else {
        // ─── Deploy mới ─────────────────────────────────────────────────────
        console.log(`\n⚠️  Không tìm thấy contract tại ${KNOWN_ADDRESS}. Đang deploy mới...`);

        const feeVault = deployer.address; // Account #0 nhận fee
        const EscrowCore = await ethers.getContractFactory('EscrowCore');
        escrow = await EscrowCore.deploy(feeVault);
        await escrow.waitForDeployment();

        escrowAddress = await escrow.getAddress();
        console.log(`✅ EscrowCore deployed tại: ${escrowAddress}`);
        console.log(`   Fee Vault: ${feeVault}`);
    }

    // ─── Grant OPERATOR_ROLE cho deployer (Account #0) ──────────────────
    const OPERATOR_ROLE = await escrow.OPERATOR_ROLE();
    const hasRole = await escrow.hasRole(OPERATOR_ROLE, deployer.address);

    if (!hasRole) {
        console.log('\n⚙️  Grant OPERATOR_ROLE cho Account #0...');
        const tx = await escrow.connect(deployer).grantRole(OPERATOR_ROLE, deployer.address);
        await tx.wait();
        console.log(`✅ OPERATOR_ROLE granted: ${tx.hash}`);
    } else {
        console.log(`\n✅ Account #0 đã có OPERATOR_ROLE`);
    }

    // ─── Verify seller (Account #1) có ETH để nhận payment ───────────────
    const sellerBalance = await ethers.provider.getBalance(seller.address);
    console.log(`\n✅ Seller Account #1: ${ethers.formatEther(sellerBalance)} ETH (có thể nhận payment)`);

    // ─── Ghi deployed addresses ra file ─────────────────────────────────
    const deployedInfo = {
        timestamp: new Date().toISOString(),
        network: 'localhost',
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        contracts: {
            EscrowCore: escrowAddress,
            FeeVault: deployer.address,
        },
        accounts: {
            deployer: deployer.address,
            seller: seller.address,
            operatorRole: deployer.address,
        },
    };

    fs.writeFileSync(DEPLOYED_FILE, JSON.stringify(deployedInfo, null, 2));
    console.log(`\n📄 Đã ghi deployment info → ${DEPLOYED_FILE}`);

    // ─── Print update instructions ────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  📝 Nếu địa chỉ mới, update các file .env này:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  backend/payment-service/.env:`);
    console.log(`    ESCROW_CONTRACT_LOCALHOST=${escrowAddress}`);
    console.log(`  backend/main-service/.env:`);
    console.log(`    ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log(`  contracts/.env:`);
    console.log(`    ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log('\n  Sau đó restart payment-service.\n');
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('❌ Bootstrap failed:', e);
        process.exit(1);
    });
