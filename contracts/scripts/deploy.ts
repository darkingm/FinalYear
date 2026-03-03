import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
  
  // Deploy FeeVault (simple address for now, can be a contract)
  const feeVault = deployer.address; // In production, deploy a FeeVault contract
  
  console.log("Using fee vault address:", feeVault);
  
  // Deploy EscrowCore
  const EscrowCore = await ethers.getContractFactory("EscrowCore");
  const escrow = await EscrowCore.deploy(feeVault);
  
  await escrow.waitForDeployment();
  
  const escrowAddress = await escrow.getAddress();
  
  console.log("\n=== Deployment Successful ===");
  console.log("EscrowCore deployed to:", escrowAddress);
  console.log("Fee Vault:", feeVault);
  console.log("\nUpdate your .env files with:");
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log("\n=== Next Steps ===");
  console.log("1. Verify contract on PolygonScan:");
  console.log(`   npx hardhat verify --network polygonMumbai ${escrowAddress} ${feeVault}`);
  console.log("2. Update backend .env files with the contract address");
  console.log("3. Grant OPERATOR_ROLE to backend service address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
