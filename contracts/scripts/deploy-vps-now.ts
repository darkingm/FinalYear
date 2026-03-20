import { ethers } from "hardhat";

/**
 * Deploy EscrowCore to the VPS Hardhat node (http://103.20.96.79:8545, chain 31337)
 *
 * Run:
 *   npx hardhat run scripts/deploy-vps-now.ts --network vps
 *
 * What this does:
 * 1. Deploys EscrowCore using Hardhat #0 as deployer (feeVault = deployer)
 * 2. Grants OPERATOR_ROLE to ADMIN_PRIVATE_KEY wallet (0xC9F9052...)
 *    so payment-service can call releasePayment() and refund()
 * 3. Sends 0.5 ETH to ADMIN wallet so it has gas to call those functions
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("\n========================================");
    console.log("  EscrowCore → VPS Hardhat (chain 31337)");
    console.log("========================================");
    console.log("Deployer (Hardhat #0):", deployer.address);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    // The ADMIN_PRIVATE_KEY wallet that payment-service uses
    const ADMIN_WALLET = "0xC9F9052095481DE14a2f54c1103203328578C683";

    // feeVault = deployer (Hardhat #0 has 10,000 ETH — safe to use as vault on testnet)
    const feeVault = deployer.address;

    // ── 1. Deploy ─────────────────────────────────────────────────────────
    console.log("\n[1/3] Deploying EscrowCore...");
    const EscrowCore = await ethers.getContractFactory("EscrowCore");
    const escrow = await EscrowCore.deploy(feeVault);
    await escrow.waitForDeployment();

    const escrowAddress = await escrow.getAddress();
    console.log("✅ EscrowCore deployed:", escrowAddress);

    // ── 2. Grant OPERATOR_ROLE to ADMIN wallet ───────────────────────────
    console.log(`\n[2/3] Granting OPERATOR_ROLE to ${ADMIN_WALLET}...`);
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const tx1 = await (escrow as any).grantRole(OPERATOR_ROLE, ADMIN_WALLET);
    await tx1.wait(1);
    console.log("✅ OPERATOR_ROLE granted to ADMIN wallet");

    // Also grant ADMIN_ROLE for full access
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const tx2 = await (escrow as any).grantRole(ADMIN_ROLE, ADMIN_WALLET);
    await tx2.wait(1);
    console.log("✅ ADMIN_ROLE granted to ADMIN wallet");

    // ── 3. Fund ADMIN wallet with ETH for gas ─────────────────────────────
    console.log(`\n[3/3] Funding ${ADMIN_WALLET} with 5 ETH for gas...`);
    const tx3 = await deployer.sendTransaction({
        to: ADMIN_WALLET,
        value: ethers.parseEther("5.0"),
    });
    await tx3.wait(1);
    const adminBalance = await deployer.provider.getBalance(ADMIN_WALLET);
    console.log("✅ ADMIN wallet funded:", ethers.formatEther(adminBalance), "ETH");

    // ── Print summary ──────────────────────────────────────────────────────
    console.log("\n========================================");
    console.log("  DEPLOYMENT COMPLETE — Copy to .env:");
    console.log("========================================");
    console.log(`ESCROW_CONTRACT_LOCALHOST=${escrowAddress}`);
    console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log(`# Deployer/feeVault: ${deployer.address}`);
    console.log(`# ADMIN wallet (OPERATOR): ${ADMIN_WALLET}`);
    console.log("\nUpdate on VPS:");
    console.log(`  ssh root@103.20.96.79 "sed -i 's|ESCROW_CONTRACT_LOCALHOST=.*|ESCROW_CONTRACT_LOCALHOST=${escrowAddress}|g' /root/services/FinalYear/docker/.env && docker restart marketplace-payment-api marketplace-main-api"`);
    console.log("========================================\n");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
