import { ethers } from 'ethers';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ABIs (minimal)
const FACTORY_ABI = [
    'function createAsset(string assetIdStr, string name, string symbol, uint8 assetType, string legalDocIPFS, uint256 totalVal, uint256 pricePerToken, address operator) external returns (address tokenAddr, address distAddr)',
    'function createAssetV2(string assetIdStr, string name, string symbol, uint8 assetType, string legalDocIPFS, uint256 totalVal, uint256 pricePerToken, address operator, uint256 quorum, uint256 supermajority, uint256 votingPeriod) external returns (address tokenAddr, address distAddr, address govAddr)',
    'event AssetCreated(bytes32 indexed assetId, address indexed token, address indexed distributor, string name, uint8 assetType, uint256 totalValuationUSD, uint256 pricePerTokenUSD)',
    'event AssetV2Created(bytes32 indexed assetId, address token, address distributor, address governance, string name)',
];

const COMPLIANCE_ABI = [
    'function setKYCStatus(address investor, bool verified, string jurisdiction, uint256 expiresAt) external',
    'function batchSetKYC(address[] investors, string jurisdiction) external',
    'function isVerified(address investor) view returns (bool)',
];

const TOKEN_ABI = [
    'function mint(address to, uint256 amount) external',
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function tokensAvailable() view returns (uint256)',
    'function pricePerTokenUSD() view returns (uint256)',
];

const DISTRIBUTOR_ABI = [
    'function depositProfit(string desc) external payable',
    'function claimReward() external',
    'function pendingReward(address investor) view returns (uint256)',
    'function totalProfitDeposited() view returns (uint256)',
    'function totalProfitClaimed() view returns (uint256)',
    'function distributionCount() view returns (uint256)',
];

function getProvider() {
    const rpcUrl = process.env.LOCALHOST_RPC_URL || process.env.VPS_RPC_URL || 'http://hardhat-node:8545';
    return new ethers.JsonRpcProvider(rpcUrl);
}

function getSigner() {
    const adminKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminKey) throw new Error('ADMIN_PRIVATE_KEY not set');
    return new ethers.Wallet(adminKey, getProvider());
}

/* ── Create asset on-chain ───────────────────────────────────────────── */
export async function createAssetOnChain(params: {
    assetId: string;
    name: string;
    symbol: string;
    assetType: number;
    legalDocIPFS: string;
    totalValUSD: bigint;
    pricePerTokenUSD: bigint;
    withGovernance?: boolean;
    quorum?: number;
    supermajority?: number;
    votingPeriodSeconds?: number;
}) {
    const factoryAddr = process.env.RWA_FACTORY_ADDRESS;
    if (!factoryAddr || factoryAddr === ZERO_ADDRESS || !ethers.isAddress(factoryAddr)) {
        throw new Error('RWA_FACTORY_ADDRESS not configured');
    }

    const signer = getSigner();
    const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, signer);

    console.log(`[RWAFactory] Creating asset "${params.name}" on-chain...`);
    const tx = params.withGovernance === false
        ? await factory.createAsset(
            params.assetId,
            params.name,
            params.symbol,
            params.assetType,
            params.legalDocIPFS,
            params.totalValUSD,
            params.pricePerTokenUSD,
            signer.address,
        )
        : await factory.createAssetV2(
            params.assetId,
            params.name,
            params.symbol,
            params.assetType,
            params.legalDocIPFS,
            params.totalValUSD,
            params.pricePerTokenUSD,
            signer.address,
            params.quorum ?? 50,
            params.supermajority ?? 67,
            params.votingPeriodSeconds ?? 48 * 60 * 60,
        );

    const receipt = await tx.wait(1);
    // Parse AssetCreated event to get token + distributor addresses
    const iface = new ethers.Interface(FACTORY_ABI);
    const parsedLogs = receipt.logs
        .map((l: any) => {
            try { return iface.parseLog(l); } catch { return null; }
        })
        .filter(Boolean);
    const log = parsedLogs.find((l: any) => l.name === 'AssetV2Created' || l.name === 'AssetCreated');

    if (!log) throw new Error('AssetCreated event not found in receipt');
    return {
        tokenAddress: log.args.token as string,
        distributorAddress: log.args.distributor as string,
        governanceAddress: (log.name === 'AssetV2Created' ? log.args.governance : ZERO_ADDRESS) as string,
        tokenVersion: log.name === 'AssetV2Created' ? 2 : 1,
        txHash: receipt.hash,
    };
}

/* ── KYC: whitelist an investor on-chain ─────────────────────────────── */
export async function setKYCOnChain(investorAddress: string, verified: boolean, jurisdiction = 'VN') {
    const registryAddr = process.env.COMPLIANCE_REGISTRY_ADDRESS;
    if (!registryAddr || registryAddr === ZERO_ADDRESS || !ethers.isAddress(registryAddr)) {
        throw new Error('COMPLIANCE_REGISTRY_ADDRESS not configured');
    }

    const signer = getSigner();
    const registry = new ethers.Contract(registryAddr, COMPLIANCE_ABI, signer);
    const tx = await registry.setKYCStatus(investorAddress, verified, jurisdiction, 0);
    return tx.wait(1);
}

/* ── Mint tokens to investor after purchase ─────────────────────────── */
export async function mintTokens(tokenAddress: string, to: string, amount: bigint) {
    if (!ethers.isAddress(tokenAddress) || tokenAddress === ZERO_ADDRESS) {
        throw new Error('Invalid RWA token contract address');
    }
    if (!ethers.isAddress(to) || to === ZERO_ADDRESS) {
        throw new Error('Invalid recipient wallet address');
    }
    const signer = getSigner();
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
    const tx = await token.mint(to, amount);
    return tx.wait(1);
}

/* ── Deposit profit into distributor ────────────────────────────────── */
export async function depositProfitOnChain(distributorAddress: string, amountEth: string, desc: string) {
    if (!ethers.isAddress(distributorAddress) || distributorAddress === ZERO_ADDRESS) {
        throw new Error('Invalid profit distributor contract address');
    }
    const signer = getSigner();
    const distributor = new ethers.Contract(distributorAddress, DISTRIBUTOR_ABI, signer);
    const tx = await distributor.depositProfit(desc, { value: ethers.parseEther(amountEth) });
    return tx.wait(1);
}

/* ── Get on-chain stats for an asset ────────────────────────────────── */
export async function getOnChainStats(tokenAddress: string, distributorAddress: string) {
    if (!ethers.isAddress(tokenAddress) || tokenAddress === ZERO_ADDRESS || !ethers.isAddress(distributorAddress) || distributorAddress === ZERO_ADDRESS) {
        throw new Error('Asset is not deployed on-chain');
    }
    const provider = getProvider();
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
    const dist = new ethers.Contract(distributorAddress, DISTRIBUTOR_ABI, provider);

    const [totalSupply, tokensAvailable, totalDeposited, totalClaimed] = await Promise.all([
        token.totalSupply(),
        token.tokensAvailable(),
        dist.totalProfitDeposited(),
        dist.totalProfitClaimed(),
    ]);

    return {
        totalSupply: totalSupply.toString(),
        tokensAvailable: tokensAvailable.toString(),
        tokensSold: (totalSupply - tokensAvailable).toString(),
        totalDepositedWei: totalDeposited.toString(),
        totalClaimedWei: totalClaimed.toString(),
    };
}

export async function getPendingReward(distributorAddress: string, investorAddress: string) {
    if (!ethers.isAddress(distributorAddress) || distributorAddress === ZERO_ADDRESS) {
        throw new Error('Invalid profit distributor contract address');
    }
    if (!ethers.isAddress(investorAddress) || investorAddress === ZERO_ADDRESS) {
        throw new Error('Invalid investor wallet address');
    }
    const provider = getProvider();
    const dist = new ethers.Contract(distributorAddress, DISTRIBUTOR_ABI, provider);
    const pending = await dist.pendingReward(investorAddress);
    return pending.toString(); // wei
}
