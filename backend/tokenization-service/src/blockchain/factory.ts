import { ethers } from 'ethers';

// ABIs (minimal)
const FACTORY_ABI = [
    'function createAsset(string assetIdStr, string name, string symbol, uint8 assetType, string legalDocIPFS, uint256 totalVal, uint256 pricePerToken, address operator) external returns (address tokenAddr, address distAddr)',
    'event AssetCreated(bytes32 indexed assetId, address indexed token, address indexed distributor, string name, uint8 assetType, uint256 totalValuationUSD, uint256 pricePerTokenUSD)',
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
}) {
    const factoryAddr = process.env.RWA_FACTORY_ADDRESS;
    if (!factoryAddr) throw new Error('RWA_FACTORY_ADDRESS not set in env');

    const signer = getSigner();
    const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, signer);

    console.log(`[RWAFactory] Creating asset "${params.name}" on-chain...`);
    const tx = await factory.createAsset(
        params.assetId,
        params.name,
        params.symbol,
        params.assetType,
        params.legalDocIPFS,
        params.totalValUSD,
        params.pricePerTokenUSD,
        signer.address,
    );

    const receipt = await tx.wait(1);
    // Parse AssetCreated event to get token + distributor addresses
    const iface = new ethers.Interface(FACTORY_ABI);
    const log = receipt.logs.find((l: any) => {
        try { iface.parseLog(l); return true; } catch { return false; }
    });

    if (!log) throw new Error('AssetCreated event not found in receipt');
    const parsed = iface.parseLog(log)!;
    return {
        tokenAddress: parsed.args.token as string,
        distributorAddress: parsed.args.distributor as string,
        txHash: receipt.hash,
    };
}

/* ── KYC: whitelist an investor on-chain ─────────────────────────────── */
export async function setKYCOnChain(investorAddress: string, verified: boolean, jurisdiction = 'VN') {
    const registryAddr = process.env.COMPLIANCE_REGISTRY_ADDRESS;
    if (!registryAddr) throw new Error('COMPLIANCE_REGISTRY_ADDRESS not set');

    const signer = getSigner();
    const registry = new ethers.Contract(registryAddr, COMPLIANCE_ABI, signer);
    const tx = await registry.setKYCStatus(investorAddress, verified, jurisdiction, 0);
    return tx.wait(1);
}

/* ── Mint tokens to investor after purchase ─────────────────────────── */
export async function mintTokens(tokenAddress: string, to: string, amount: bigint) {
    const signer = getSigner();
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
    const tx = await token.mint(to, amount);
    return tx.wait(1);
}

/* ── Deposit profit into distributor ────────────────────────────────── */
export async function depositProfitOnChain(distributorAddress: string, amountEth: string, desc: string) {
    const signer = getSigner();
    const distributor = new ethers.Contract(distributorAddress, DISTRIBUTOR_ABI, signer);
    const tx = await distributor.depositProfit(desc, { value: ethers.parseEther(amountEth) });
    return tx.wait(1);
}

/* ── Get on-chain stats for an asset ────────────────────────────────── */
export async function getOnChainStats(tokenAddress: string, distributorAddress: string) {
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
    const provider = getProvider();
    const dist = new ethers.Contract(distributorAddress, DISTRIBUTOR_ABI, provider);
    const pending = await dist.pendingReward(investorAddress);
    return pending.toString(); // wei
}
