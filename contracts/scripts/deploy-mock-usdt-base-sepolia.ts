import { ethers } from 'hardhat';

const DECIMALS = 6n;
const DEFAULT_DEPLOYER_SUPPLY = 1_000_000n * 10n ** DECIMALS;
const DEFAULT_DEMO_SUPPLY = 5_000n * 10n ** DECIMALS;

function parseWalletList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => /^0x[a-fA-F0-9]{40}$/.test(entry));
}

async function main() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim();
  if (!rpcUrl) {
    throw new Error('Missing BASE_SEPOLIA_RPC_URL. Set it before deploying Mock USDT.');
  }

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await deployer.provider.getBalance(deployer.address);

  console.log('\n=== Mock USDT -> Base Sepolia ===');
  console.log('RPC URL:', rpcUrl);
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(deployerBalance), 'ETH');

  if (deployerBalance < ethers.parseEther('0.001')) {
    throw new Error('Insufficient Base Sepolia ETH. Fund the deployer with at least 0.001 ETH.');
  }

  const MockUSDT = await ethers.getContractFactory('MockUSDT');
  const token = await MockUSDT.deploy(deployer.address, DEFAULT_DEPLOYER_SUPPLY);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log('Mock USDT deployed:', tokenAddress);
  console.log('Explorer:', `https://sepolia.basescan.org/address/${tokenAddress}`);

  const demoWallets = parseWalletList(process.env.MOCK_USDT_DEMO_WALLETS);
  for (const wallet of demoWallets) {
    const mintTx = await (token as any).mint(wallet, DEFAULT_DEMO_SUPPLY);
    await mintTx.wait(1);
    console.log(`Minted 5000 USDT to ${wallet}`);
  }

  console.log('\n=== Suggested whitelist payload ===');
  console.log(JSON.stringify({
    chain_id: 84532,
    symbol: 'USDT',
    token_address: tokenAddress,
    decimals: 6,
    is_active: true,
  }, null, 2));
  console.log('\n=== Copy into env if needed ===');
  console.log(`NEXT_PUBLIC_BASE_SEPOLIA_MOCK_USDT=${tokenAddress}`);
  console.log('=================================\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
