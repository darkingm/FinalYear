/**
 * scripts/bootstrap-local.ts
 *
 * Script Hardhat deploy EscrowCore + CreditScoreSBT lên localhost/VPS.
 * Sử dụng: npx hardhat run scripts/bootstrap-local.ts --network vps
 *
 * Thực hiện:
 *   1. Deploy EscrowCore (nếu chưa có hoặc bị reset sau node restart)
 *   2. Deploy CreditScoreSBT (nếu chưa có)
 *   3. Grant OPERATOR_ROLE + UPDATER_ROLE cho deployer
 *   4. Ghi địa chỉ contracts vào deployed-local.json
 *   5. Print hướng dẫn update .env
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const DEPLOYED_FILE = path.join(__dirname, '..', 'deployed-local.json');
const KNOWN_ESCROW   = process.env.ESCROW_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const KNOWN_SBT      = process.env.CREDIT_SBT_ADDRESS || '';

async function deployOrReuse(name: string, knownAddress: string, deployer: any, ...deployArgs: any[]) {
    if (knownAddress) {
        const code = await ethers.provider.getCode(knownAddress);
        if (code && code !== '0x') {
            console.log(`  ✅ ${name} already deployed at: ${knownAddress}`);
            return ethers.getContractAt(name, knownAddress);
        }
        console.log(`  ⚠️  ${name} not found at ${knownAddress}, deploying fresh...`);
    } else {
        console.log(`  📦 Deploying ${name}...`);
    }

    const Factory = await ethers.getContractFactory(name);
    const contract = await Factory.deploy(...deployArgs);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log(`  ✅ ${name} deployed at: ${addr}`);
    return contract;
}

async function main() {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const network = await ethers.provider.getNetwork();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('     Web3Market — Full Contract Bootstrap');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  Network:  ${network.name} (chainId: ${network.chainId})`);
    console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log('───────────────────────────────────────────────────────\n');

    // ═══ 1. Deploy EscrowCore ═══════════════════════════════════════════════
    console.log('▶ EscrowCore:');
    const escrow = await deployOrReuse('EscrowCore', KNOWN_ESCROW, deployer, deployer.address);
    const escrowAddress = await escrow.getAddress();

    // Grant OPERATOR_ROLE
    const OPERATOR_ROLE = await escrow.OPERATOR_ROLE();
    if (!(await escrow.hasRole(OPERATOR_ROLE, deployer.address))) {
        const tx = await escrow.connect(deployer).grantRole(OPERATOR_ROLE, deployer.address);
        await tx.wait();
        console.log(`  ✅ OPERATOR_ROLE granted to deployer`);
    } else {
        console.log(`  ✅ Deployer already has OPERATOR_ROLE`);
    }

    // ═══ 2. Deploy CreditScoreSBT ═══════════════════════════════════════════
    console.log('\n▶ CreditScoreSBT:');
    const sbt = await deployOrReuse('CreditScoreSBT', KNOWN_SBT, deployer);
    const sbtAddress = await sbt.getAddress();

    // Grant UPDATER_ROLE
    const UPDATER_ROLE = await sbt.UPDATER_ROLE();
    if (!(await sbt.hasRole(UPDATER_ROLE, deployer.address))) {
        const tx = await sbt.connect(deployer).grantRole(UPDATER_ROLE, deployer.address);
        await tx.wait();
        console.log(`  ✅ UPDATER_ROLE granted to deployer`);
    } else {
        console.log(`  ✅ Deployer already has UPDATER_ROLE`);
    }

    // Quick verification — call getScore for deployer (should return 0)
    try {
        const score = await sbt.getScore(deployer.address);
        console.log(`  ✅ SBT verification: getScore(deployer) = ${score} (expected 0)`);
    } catch (e: any) {
        console.log(`  ⚠️ SBT verification failed: ${e.message}`);
    }

    // ═══ 3. Save deployment info ═══════════════════════════════════════════
    const deployedInfo = {
        timestamp: new Date().toISOString(),
        network: network.name,
        chainId: Number(network.chainId),
        contracts: {
            EscrowCore: escrowAddress,
            CreditScoreSBT: sbtAddress,
            FeeVault: deployer.address,
        },
        accounts: {
            deployer: deployer.address,
            operatorRole: deployer.address,
            updaterRole: deployer.address,
        },
    };

    fs.writeFileSync(DEPLOYED_FILE, JSON.stringify(deployedInfo, null, 2));
    console.log(`\n📄 Deployment info saved → ${DEPLOYED_FILE}`);

    // ═══ 4. Print env update instructions ═══════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  📝 Update your .env files:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  ESCROW_CONTRACT_LOCALHOST=${escrowAddress}`);
    console.log(`  ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log(`  CREDIT_SBT_ADDRESS=${sbtAddress}`);
    console.log(`  MINTER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`);
    console.log(`  LOCALHOST_RPC_URL=http://hardhat-node:8545`);
    console.log('\n  Then restart main-service + payment-service.\n');
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('❌ Bootstrap failed:', e);
        process.exit(1);
    });
