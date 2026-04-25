import { ethers } from 'hardhat';

function requireAddressEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a valid 0x EVM address`);
  }
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);
  const feeVault = requireAddressEnv('FEE_VAULT_ADDRESS') || deployer.address;
  const operatorAddress = requireAddressEnv('OPERATOR_ADDRESS');

  console.log('\n=== EscrowCore -> BNB Testnet (Chain 97) ===');
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'tBNB');
  console.log('Fee vault:', feeVault);

  if (balance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient tBNB. Fund deployer with at least 0.01 tBNB.');
  }

  console.log('\nDeploying EscrowCore...');
  const EscrowCore = await ethers.getContractFactory('EscrowCore');
  const escrow = await EscrowCore.deploy(feeVault);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log('✅ EscrowCore deployed:', escrowAddress);
  console.log('Explorer:', `https://testnet.bscscan.com/address/${escrowAddress}`);

  if (operatorAddress) {
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
    console.log('\nGranting OPERATOR_ROLE to:', operatorAddress);
    const grantTx = await (escrow as any).grantRole(OPERATOR_ROLE, operatorAddress);
    await grantTx.wait(2);
    console.log('✅ OPERATOR_ROLE granted');
  } else {
    console.log('\n⚠️ OPERATOR_ADDRESS not set. Skipping operator grant.');
  }

  console.log('\n=== Copy into env files ===');
  console.log(`ESCROW_CONTRACT_BSC_TESTNET=${escrowAddress}`);
  console.log(`NEXT_PUBLIC_ESCROW_CONTRACT_BSC_TESTNET=${escrowAddress}`);
  console.log('\n=== Verify on BscScan ===');
  console.log(`npx hardhat verify --network bscTestnet ${escrowAddress} ${feeVault}`);
  console.log('=========================\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
