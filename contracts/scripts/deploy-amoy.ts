import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../docker/.env' });

/**
 * Deploy EscrowCore to Polygon Amoy Testnet.
 * Amoy remains supported as a secondary testnet path.
 * Base Sepolia is the primary public testnet for testnet-lite demos.
 *
 * Prerequisites:
 *   1. Set POLYGON_AMOY_RPC_URL in .env (e.g. from Alchemy/Infura)
 *   2. Set DEPLOYER_PRIVATE_KEY with tMATIC for gas
 *   3. Get tMATIC from: https://faucet.polygon.technology
 *
 * Run:
 *   cd contracts
 *   npx hardhat run scripts/deploy-amoy.ts --network amoy
 *
 * After deploy:
 *   - Verify: npx hardhat verify --network amoy <ADDRESS> <FEE_VAULT>
 *   - Update ESCROW_CONTRACT_POLYGON_AMOY in docker/.env and VPS .env
 *   - Grant OPERATOR_ROLE to payment-service wallet
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('\n=== EscrowCore → Polygon Amoy Testnet ===');
    console.log('Deployer:', deployer.address);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log('Balance:', ethers.formatEther(balance), 'MATIC');

    if (balance < ethers.parseEther('0.01')) {
        console.error('\n❌ Insufficient MATIC. Get tMATIC from: https://faucet.polygon.technology');
        console.error('   Need at least 0.01 MATIC for deployment gas.');
        process.exit(1);
    }

    // feeVault = deployer EOA (same account that deploys)
    const feeVault = deployer.address;
    console.log('\nfeeVault (EOA):', feeVault);

    // Deploy EscrowCore
    console.log('\nDeploying EscrowCore...');
    const EscrowCore = await ethers.getContractFactory('EscrowCore');
    const escrow = await EscrowCore.deploy(feeVault);
    await escrow.waitForDeployment();

    const escrowAddress = await escrow.getAddress();
    console.log('✅ EscrowCore deployed:', escrowAddress);
    console.log('   Explorer: https://amoy.polygonscan.com/address/' + escrowAddress);

    // Grant OPERATOR_ROLE to payment-service wallet
    const operatorEnv = process.env.OPERATOR_ADDRESS;
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));

    if (operatorEnv && /^0x[0-9a-fA-F]{40}$/.test(operatorEnv)) {
        console.log('\nGranting OPERATOR_ROLE to:', operatorEnv);
        const tx = await (escrow as any).grantRole(OPERATOR_ROLE, operatorEnv);
        await tx.wait(2); // wait 2 confirmations on mainnet-like chains
        console.log('✅ OPERATOR_ROLE granted');
    } else {
        console.log('\n⚠️  OPERATOR_ADDRESS not set.');
        console.log('   After deploy, run:');
        console.log(`   npx hardhat run scripts/grant-operator.ts --network amoy`);
        console.log('   with OPERATOR_ADDRESS=<payment-service-wallet>');
    }

    // Print update instructions
    console.log('\n=== Update your .env files with: ===');
    console.log(`ESCROW_CONTRACT_POLYGON_AMOY=${escrowAddress}`);
    console.log('\n=== On VPS, run: ===');
    console.log(`ssh root@103.20.96.79 "sed -i 's|ESCROW_CONTRACT_POLYGON_AMOY=.*|ESCROW_CONTRACT_POLYGON_AMOY=${escrowAddress}|' /root/services/FinalYear/docker/.env && docker restart marketplace-payment-api marketplace-main-api"`);

    console.log('\n=== Verify contract on PolygonScan: ===');
    console.log(`npx hardhat verify --network amoy ${escrowAddress} ${feeVault}`);
    console.log('=========================================\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
