import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import type { Config } from 'wagmi';
import {
  polygon,
  arbitrum,
  polygonAmoy as wagmiPolygonAmoy,
  baseSepolia,
  bscTestnet,
  arbitrumSepolia,
  mainnet,
} from 'wagmi/chains';
import { defineChain } from 'viem';
import {
  getActiveRuntimeChainIds,
  getRecommendedCheckoutChainMetas,
  getTestnetLiteChainMeta,
} from './testnet-lite';

export const TESTNET_MODE = process.env.NEXT_PUBLIC_TESTNET_MODE === 'true';
export const DEFAULT_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '31337',
  10
);

export const polygonAmoy = defineChain({
  ...wagmiPolygonAmoy,
  rpcUrls: {
    ...wagmiPolygonAmoy.rpcUrls,
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

const HARDHAT_RPC_URL = process.env.NEXT_PUBLIC_HARDHAT_RPC_URL || 'http://127.0.0.1:8545';
export const localhost = defineChain({
  id: 31337,
  name: 'Hardhat (VPS Local)',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: [HARDHAT_RPC_URL] },
    public: { http: [HARDHAT_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Hardhat Local', url: 'http://103.20.96.79:8545' },
  },
  testnet: true,
});

const testnets = [
  localhost,
  baseSepolia,
  polygonAmoy,
  bscTestnet,
  arbitrumSepolia,
] as const;

const mainnets = [
  polygon,
  arbitrum,
  mainnet,
] as const;

const allChains = [...testnets, ...mainnets] as const;

const wagmiConfig: Config = getDefaultConfig({
  appName: 'Web3Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'cea17a07a0cb8c74b022c41e21294643',
  chains: allChains as unknown as readonly [typeof localhost, ...typeof allChains],
  ssr: true,
  wallets: [{
    groupName: 'Ví',
    wallets: [metaMaskWallet, walletConnectWallet],
  }],
}) as unknown as Config;

export function getWagmiConfig(): Config {
  return wagmiConfig;
}

export { allChains as chains };

export const ESCROW_CONTRACTS: Record<number, string> = {
  31337: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_LOCALHOST || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  84532: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000',
  80002: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON_AMOY || '0xCDE08Be0190482691b3288C27240378497d74E79',
  97: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_BSC_TESTNET || '0x0000000000000000000000000000000000000000',
  421614: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARB_SEPOLIA || '0x0000000000000000000000000000000000000000',
  137: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000',
  42161: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARBITRUM || '0x0000000000000000000000000000000000000000',
  1: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ETH || '0x0000000000000000000000000000000000000000',
};

export function hasEscrow(chainId: number): boolean {
  const addr = ESCROW_CONTRACTS[chainId];
  return !!addr && addr !== '0x0000000000000000000000000000000000000000';
}

export const PAYMENT_NETWORKS = getRecommendedCheckoutChainMetas()
  .filter((chain) => getActiveRuntimeChainIds().includes(chain.chainId))
  .map((chain) => ({
    chainId: chain.chainId,
    name: chain.name,
    icon: chain.icon,
    badge: chain.badge,
    badgeColor: chain.badgeColor,
    description: chain.description,
  }));

export const CHAIN_TOKENS: Record<number, string[]> = {
  31337: ['ETH', 'USDT', 'USDC'],
  84532: ['ETH', 'USDT', 'USDC'],
  80002: ['MATIC', 'USDT', 'USDC'],
  97: ['BNB', 'USDT', 'USDC'],
  421614: ['ETH', 'USDT', 'USDC', 'ARB'],
  137: ['MATIC', 'USDT', 'USDC'],
  42161: ['ETH', 'USDT', 'USDC', 'ARB'],
  1: ['ETH', 'USDT', 'USDC', 'WBTC'],
};

export const CHAIN_META: Record<number, { name: string; explorer: string }> = {
  31337: { name: 'Hardhat Local', explorer: 'http://localhost:8545' },
  84532: { name: 'Base Sepolia', explorer: 'https://sepolia.basescan.org' },
  80002: { name: 'Polygon Amoy', explorer: 'https://amoy.polygonscan.com' },
  97: { name: 'BNB Testnet', explorer: 'https://testnet.bscscan.com' },
  421614: { name: 'Arbitrum Sepolia', explorer: 'https://sepolia.arbiscan.io' },
  137: { name: 'Polygon', explorer: 'https://polygonscan.com' },
  42161: { name: 'Arbitrum One', explorer: 'https://arbiscan.io' },
  1: { name: 'Ethereum', explorer: 'https://etherscan.io' },
};

export function getChainMetaOrFallback(chainId: number) {
  return getTestnetLiteChainMeta(chainId) || {
    chainId,
    name: CHAIN_META[chainId]?.name || `Chain ${chainId}`,
    shortName: CHAIN_META[chainId]?.name || `Chain ${chainId}`,
    icon: '⛓️',
    nativeSymbol: CHAIN_TOKENS[chainId]?.[0] || 'ETH',
    explorerUrl: CHAIN_META[chainId]?.explorer || '',
    faucetUrl: null,
    description: 'Chain metadata unavailable',
    badge: 'CHAIN',
    badgeColor: 'yellow' as const,
    mode: 'optional' as const,
  };
}
