import { ethers } from "hardhat";

/**
 * Full deployment script for Web3Market RWA contracts:
 *   1. EscrowCore  — multi-token escrow with SBT dynamic fees
 *   2. ProductNFT  — ERC721 + ERC2981 royalty + Physical-Digital Link
 *   3. CreditScoreSBT — ERC5192 Soulbound Token credit score
 *
 * After deploy: wires SBT into EscrowCore and grants backend wallet MINTER + UPDATER roles.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const backendWallet = process.env.BACKEND_WALLET_ADDRESS || deployer.address;
  const feeVault      = process.env.FEE_VAULT_ADDRESS      || deployer.address;

  console.log("=".repeat(60));
  console.log(" Web3Market RWA Deployment");
  console.log("=".repeat(60));
  console.log("Deployer   :", deployer.address);
  console.log("Backend    :", backendWallet);
  console.log("Fee Vault  :", feeVault);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance    :", ethers.formatEther(balance), "MATIC/ETH\n");

  // ── 1. EscrowCore ──────────────────────────────────────────────────────────
  console.log("1/3. Deploying EscrowCore...");
  const EscrowCore = await ethers.getContractFactory("EscrowCore");
  const escrow = await EscrowCore.deploy(feeVault);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("     EscrowCore :", escrowAddr);

  // ── 2. ProductNFT ───────────────────────────────────────────────────────────
  console.log("2/3. Deploying ProductNFT...");
  const ProductNFT = await ethers.getContractFactory("ProductNFT");
  const productNFT = await ProductNFT.deploy(feeVault);
  await productNFT.waitForDeployment();
  const productNFTAddr = await productNFT.getAddress();
  console.log("     ProductNFT :", productNFTAddr);

  // ── 3. CreditScoreSBT ───────────────────────────────────────────────────────
  console.log("3/3. Deploying CreditScoreSBT...");
  const CreditScoreSBT = await ethers.getContractFactory("CreditScoreSBT");
  const sbt = await CreditScoreSBT.deploy();
  await sbt.waitForDeployment();
  const sbtAddr = await sbt.getAddress();
  console.log("     CreditScoreSBT:", sbtAddr);

  // ── Wire contracts ───────────────────────────────────────────────────────────
  console.log("\nWiring contracts...");

  // Set SBT contract in EscrowCore for dynamic fees
  const tx1 = await escrow.setSBTContract(sbtAddr);
  await tx1.wait();
  console.log("  EscrowCore.setSBTContract:", sbtAddr);

  // Grant MINTER_ROLE on ProductNFT to backend wallet
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const tx2 = await productNFT.grantRole(MINTER_ROLE, backendWallet);
  await tx2.wait();
  console.log("  ProductNFT.grantRole(MINTER_ROLE) ->" , backendWallet);

  // Grant UPDATER_ROLE on CreditScoreSBT to backend wallet
  const UPDATER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPDATER_ROLE"));
  const tx3 = await sbt.grantRole(UPDATER_ROLE, backendWallet);
  await tx3.wait();
  console.log("  CreditScoreSBT.grantRole(UPDATER_ROLE) ->", backendWallet);

  // Grant OPERATOR_ROLE on EscrowCore to backend wallet
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const tx4 = await escrow.grantRole(OPERATOR_ROLE, backendWallet);
  await tx4.wait();
  console.log("  EscrowCore.grantRole(OPERATOR_ROLE) ->", backendWallet);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(" Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\nAdd these to your backend .env files:\n");
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddr}`);
  console.log(`PRODUCT_NFT_ADDRESS=${productNFTAddr}`);
  console.log(`CREDIT_SBT_ADDRESS=${sbtAddr}`);
  console.log(`MINTER_PRIVATE_KEY=<your_backend_wallet_pk>`);
  console.log(`PINATA_JWT=<your_pinata_jwt_for_ipfs>`);
  console.log(`FRONTEND_URL=https://your-domain.com`);

  console.log("\nVerify on Polygonscan:");
  console.log(`  npx hardhat verify --network polygon ${escrowAddr} ${feeVault}`);
  console.log(`  npx hardhat verify --network polygon ${productNFTAddr} ${feeVault}`);
  console.log(`  npx hardhat verify --network polygon ${sbtAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
