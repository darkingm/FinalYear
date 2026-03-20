import { ethers } from "hardhat";

/**
 * Deploy the full RWA tokenization stack:
 *   1. ComplianceRegistry
 *   2. RWAFactory (references ComplianceRegistry)
 *   3. (Optional) A demo asset for testing
 *
 * Usage:
 *   npx hardhat run scripts/deploy-rwa.ts --network vps
 *   npx hardhat run scripts/deploy-rwa.ts --network amoy
 *   DEPLOY_DEMO_ASSET=true npx hardhat run scripts/deploy-rwa.ts --network vps
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n=====================================");
  console.log("  RWA Tokenization — Deployment");
  console.log("=====================================");
  console.log("Deployer :", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance  :", ethers.formatEther(balance), "ETH");

  const OPERATOR = process.env.OPERATOR_ADDRESS || deployer.address;
  console.log("Operator :", OPERATOR);

  // ── 1. ComplianceRegistry ─────────────────────────────────────
  console.log("\n[1/3] Deploying ComplianceRegistry...");
  const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
  const registry = await ComplianceRegistry.deploy(deployer.address) as any;
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("✅ ComplianceRegistry:", registryAddr);

  const KYC_OP_ROLE = ethers.keccak256(ethers.toUtf8Bytes("KYC_OPERATOR_ROLE"));
  await (await registry.grantRole(KYC_OP_ROLE, OPERATOR)).wait(1);
  console.log("   KYC_OPERATOR_ROLE → OPERATOR wallet");

  // ── 2. RWAFactory ─────────────────────────────────────────────
  console.log("\n[2/3] Deploying RWAFactory...");
  const RWAFactory = await ethers.getContractFactory("RWAFactory");
  const factory = await RWAFactory.deploy(registryAddr, deployer.address) as any;
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("✅ RWAFactory:", factoryAddr);

  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await (await factory.grantRole(ISSUER_ROLE, OPERATOR)).wait(1);
  console.log("   ISSUER_ROLE → OPERATOR wallet");

  // ── 3. Optional demo asset ────────────────────────────────────
  if (process.env.DEPLOY_DEMO_ASSET === "true") {
    console.log("\n[3/3] Creating demo RWA asset (Real Estate)...");

    await (await registry.batchSetKYC([deployer.address, OPERATOR], "VN")).wait(1);
    console.log("   KYC: whitelisted deployer + operator");

    const tx = await factory.createAsset(
      "demo-asset-uuid-0001",
      "HCM Tower Unit 2101",
      "HCMT-2101",
      0, // AssetType.REAL_ESTATE
      "QmDemoLegalDocIPFSHashPlaceholder123456",
      500_000_000_000n, // $500K USD × 1e6
      100_000_000n,     // $100/token × 1e6
      OPERATOR
    );
    await tx.wait(1);
    console.log("✅ Demo asset created (5,000 tokens @ $100)");
  } else {
    console.log("\n[3/3] Demo asset skipped (DEPLOY_DEMO_ASSET=true to enable)");
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("  ✅ RWA Stack Deployed!");
  console.log("========================================");
  console.log(`
Add to docker/.env on VPS:
  COMPLIANCE_REGISTRY_ADDRESS=${registryAddr}
  RWA_FACTORY_ADDRESS=${factoryAddr}

Quick update:
  ssh root@103.20.96.79 "echo COMPLIANCE_REGISTRY_ADDRESS=${registryAddr} >> /root/services/FinalYear/docker/.env && echo RWA_FACTORY_ADDRESS=${factoryAddr} >> /root/services/FinalYear/docker/.env"
`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
