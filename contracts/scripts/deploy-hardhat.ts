import { ethers } from "hardhat";

/**
 * Deploy EscrowCore on Hardhat local / any EVM chain.
 *
 * Key rules to avoid StackOverflow:
 *  - feeVault MUST be a plain EOA (not a contract with receive() logic)
 *  - OPERATOR_ROLE is granted to the payment-service backend wallet
 *
 * Run on Hardhat VPS:
 *   npx hardhat run scripts/deploy-hardhat.ts --network localhost
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("\n=== EscrowCore Deployment ===");
    console.log("Deployer (Account #0):", deployer.address);
    console.log(
        "Balance:",
        ethers.formatEther(await deployer.provider.getBalance(deployer.address)),
        "ETH"
    );

    // ── feeVault = deployer EOA (Account #0) ─────────────────────────────────
    // IMPORTANT: must NOT be a contract — use plain EOA to avoid StackOverflow
    // when EscrowCore sends ETH via call{value}("").
    const feeVault = deployer.address;
    console.log("\nfeeVault (EOA):", feeVault);

    // ── Deploy ────────────────────────────────────────────────────────────────
    const EscrowCore = await ethers.getContractFactory("EscrowCore");
    const escrow = await EscrowCore.deploy(feeVault);
    await escrow.waitForDeployment();

    const escrowAddress = await escrow.getAddress();
    console.log("\nEscrowCore deployed:", escrowAddress);

    // ── Grant OPERATOR_ROLE to payment-service backend wallet ─────────────────
    // The payment-service calls releasePayment() / refund() with ADMIN_PRIVATE_KEY.
    // That key's address must have OPERATOR_ROLE.
    const operatorEnv = process.env.OPERATOR_ADDRESS;
    if (operatorEnv && /^0x[0-9a-fA-F]{40}$/.test(operatorEnv)) {
        const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
        const tx = await (escrow as any).grantRole(OPERATOR_ROLE, operatorEnv);
        await tx.wait(1);
        console.log("OPERATOR_ROLE granted to:", operatorEnv);
    } else {
        // Default: also grant to Account #1 (Hardhat local test seller/operator)
        const signers = await ethers.getSigners();
        const operator = signers[1]?.address;
        if (operator) {
            const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
            const tx = await (escrow as any).grantRole(OPERATOR_ROLE, operator);
            await tx.wait(1);
            console.log("OPERATOR_ROLE granted to Account #1:", operator);
        }
        console.log(
            "\n⚠️  Set OPERATOR_ADDRESS env var to your payment-service wallet and re-run to grant proper role."
        );
    }

    // ── Print .env values ─────────────────────────────────────────────────────
    console.log("\n=== Copy these to your .env files ===");
    console.log(`ESCROW_CONTRACT_LOCALHOST=${escrowAddress}`);
    console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log(`# feeVault EOA: ${feeVault}`);
    console.log("=====================================\n");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
