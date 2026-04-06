import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import type { Config } from 'wagmi';
import {
  polygon,
  polygonMumbai,
  arbitrum,
  polygonAmoy as baseAmoy,
  baseSepolia,
  bscTestnet,
  arbitrumSepolia,
  mainnet,
} from 'wagmi/chains';
import { defineChain } from 'viem';

// ─── TESTNET MODE ENV FLAG ─────────────────────────────────────────────────
// Set NEXT_PUBLIC_TESTNET_MODE=true in .env / docker-compose to enforce testnet
export const TESTNET_MODE = process.env.NEXT_PUBLIC_TESTNET_MODE === 'true';
export const DEFAULT_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '80002', // Polygon Amoy by default
  10
);

// ─── Polygon Amoy testnet (multiple RPC fallbacks) ────────────────────────
export const polygonAmoy = defineChain({
  ...baseAmoy,
  rpcUrls: {
    ...baseAmoy.rpcUrls,
    default: {
      http: [
        'https://rpc-amoy.polygon.technology',
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
      ],
    },
    public: {
      http: [
        'https://rpc-amoy.polygon.technology',
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'PolygonScan Amoy', url: 'https://amoy.polygonscan.com' },
  },
});

// ─── Hardhat / Anvil local node ───────────────────────────────────────────────────
// VPS Hardhat: http://103.20.96.79:8545 — chain ảo, không cần token thật
// Local: http://127.0.0.1:8545 — khi dùng locally
const HARDHAT_RPC_URL = process.env.NEXT_PUBLIC_HARDHAT_RPC_URL || 'http://127.0.0.1:8545';
export const localhost = defineChain({
  id: 31337,
  name: 'Hardhat (VPS Local)',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: [HARDHAT_RPC_URL, 'http://127.0.0.1:8545'] },
    public: { http: [HARDHAT_RPC_URL, 'http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Hardhat Local', url: 'http://103.20.96.79:8545' },
  },
  testnet: true,
});

// ─── Chain ordering ───────────────────────────────────────────────────────
// Hardhat VPS (31337) đặt đầu tiên — default cho test tự do
// Polygon Amoy (80002) — secondary khi có đủ MATIC
const testnets = [
  localhost,      // 31337  ← MặC ĐỊNH cho testing trên VPS
  polygonAmoy,    // 80002  ← Sử DỦNG khi có MATIC testnet
  bscTestnet,     // 97
  arbitrumSepolia,// 421614
  baseSepolia,    // 84532
] as const;

const mainnets = [
  polygon,        // 137
  arbitrum,       // 42161
  mainnet,        // 1
] as const;

// Testnets go first so MetaMask defaults to Amoy
const allChains = [...testnets, ...mainnets] as const;

// ─── Wagmi v2 config ────────────────────────────────────────────────────────
const wagmiConfig: Config = getDefaultConfig({
  appName: 'Web3Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'cea17a07a0cb8c74b022c41e21294643',
  chains: allChains as unknown as readonly [typeof polygonAmoy, ...typeof allChains],
  ssr: true,
  // Only MetaMask + WalletConnect — disable Coinbase popup
  wallets: [{
    groupName: 'Ví',
    wallets: [metaMaskWallet, walletConnectWallet],
  }],
}) as unknown as Config;

export function getWagmiConfig(): Config {
  return wagmiConfig;
}

export { allChains as chains };

// ─── Escrow contract addresses per chain ────────────────────────────────────
export const ESCROW_CONTRACTS: Record<number, string> = {
  // Hardhat VPS (ACTIVE — chạy trực tiếp trên VPS, instant confirmation)
  31337: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_LOCALHOST || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  // Polygon Amoy (secondary testnet — cần MATIC faucet)
  80002: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON_AMOY || '0xCDE08Be0190482691b3288C27240378497d74E79',
  // Other testnets (chưa deploy)
  97: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_BSC_TESTNET || '0x0000000000000000000000000000000000000000',
  421614: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARB_SEPOLIA || '0x0000000000000000000000000000000000000000',
  84532: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000',
  // Mainnets (NOT active yet — zero address means not deployed)
  137: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000',
  42161: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARBITRUM || '0x0000000000000000000000000000000000000000',
  1: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ETH || '0x0000000000000000000000000000000000000000',
};

// Helper: check if a chain has an active escrow contract
export function hasEscrow(chainId: number): boolean {
  const addr = ESCROW_CONTRACTS[chainId];
  return !!addr && addr !== '0x0000000000000000000000000000000000000000';
}

// ─── Payment UI Metadata ─────────────────────────────────────────────────────
export const PAYMENT_NETWORKS: Array<{
  chainId: number;
  name: string;
  icon: string;
  badge: string;
  badgeColor: 'emerald' | 'purple' | 'yellow';
  description: string;
}> = [
    {
      chainId: 31337,
      name: 'Hardhat (Local)',
      icon: '🔨',
      badge: 'LOCAL',
      badgeColor: 'yellow',
      description: 'Môi trường dev cục bộ · Xác nhận tức thì',
    },
    {
      chainId: 80002,
      name: 'Polygon Amoy',
      icon: '🔷',
      badge: 'TESTNET',
      badgeColor: 'purple',
      description: 'Polygon testnet · Cần MATIC từ faucet',
    },
    {
      chainId: 97,
      name: 'BNB Testnet',
      icon: '🟡',
      badge: 'TESTNET',
      badgeColor: 'yellow',
      description: 'Binance Smart Chain testnet',
    },
    {
      chainId: 421614,
      name: 'Arbitrum Sepolia',
      icon: '⚡',
      badge: 'TESTNET',
      badgeColor: 'emerald',
      description: 'Arbitrum L2 testnet · ETH tốc độ cao',
    },
  ];

/** Tokens available for each chain (by chainId) */
export const CHAIN_TOKENS: Record<number, string[]> = {
  31337: ['ETH', 'USDT', 'USDC'],
  80002: ['MATIC', 'USDT', 'USDC'],
  97: ['BNB', 'USDT', 'USDC'],
  421614: ['ETH', 'USDT', 'USDC', 'ARB'],
  84532: ['ETH', 'USDT', 'USDC'],
  137: ['MATIC', 'USDT', 'USDC'],
  42161: ['ETH', 'USDT', 'USDC', 'ARB'],
  1: ['ETH', 'USDT', 'USDC', 'WBTC'],
};

/** Human-readable name + explorer for each chain */
export const CHAIN_META: Record<number, { name: string; explorer: string }> = {
  31337: { name: 'Hardhat Local', explorer: 'http://localhost:8545' },
  80002: { name: 'Polygon Amoy', explorer: 'https://amoy.polygonscan.com' },
  97: { name: 'BNB Testnet', explorer: 'https://testnet.bscscan.com' },
  421614: { name: 'Arbitrum Sepolia', explorer: 'https://sepolia.arbiscan.io' },
  84532: { name: 'Base Sepolia', explorer: 'https://sepolia.basescan.org' },
  137: { name: 'Polygon', explorer: 'https://polygonscan.com' },
  42161: { name: 'Arbitrum One', explorer: 'https://arbiscan.io' },
  1: { name: 'Ethereum', explorer: 'https://etherscan.io' },
};

