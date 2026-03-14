import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import type { Config } from 'wagmi';
import {
  polygon,
  polygonMumbai,
  arbitrum,
  arbitrumGoerli,
  polygonAmoy as baseAmoy,
  baseSepolia,
  bscTestnet,
  optimismSepolia,
  arbitrumSepolia
} from 'wagmi/chains';
import { defineChain } from 'viem';

// Polygon Amoy testnet
export const polygonAmoy = defineChain({
  ...baseAmoy,
  rpcUrls: {
    ...baseAmoy.rpcUrls,
    default: {
      http: [
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
        'https://rpc-amoy.polygon.technology'
      ]
    },
    public: {
      http: [
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
        'https://rpc-amoy.polygon.technology'
      ]
    },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/amoy' },
  },
});

// Hardhat / Anvil local node (chainId 31337)
export const localhost = defineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

const allChains = [
  polygonMumbai,
  polygonAmoy,
  polygon,
  localhost,
  arbitrum,
  arbitrumGoerli,
  baseSepolia,
  bscTestnet,
  optimismSepolia,
  arbitrumSepolia
] as const;

/**
 * Wagmi v2 config with SSR support.
 * 
 * IMPORTANT: Use a module-level singleton so the config is created ONCE
 * per process (server) or once per page load (browser).
 * This prevents "WalletConnect Core is already initialized" errors.
 * 
 * The `ssr: true` flag tells wagmi to:
 * - Serialize state to cookies for hydration
 * - NOT require browser APIs during initial render
 * - Allow hooks to be called during SSR without throwing
 */
const wagmiConfig: Config = getDefaultConfig({
  appName: 'Web3Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'cea17a07a0cb8c74b022c41e21294643',
  chains: allChains as unknown as readonly [typeof localhost, ...typeof allChains],
  ssr: true, // Critical: enables SSR-safe wagmi hooks
}) as unknown as Config;

export function getWagmiConfig(): Config {
  return wagmiConfig;
}

export { allChains as chains };

// Contract addresses by chain
export const ESCROW_CONTRACTS: Record<number, string> = {
  31337: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_LOCALHOST || '0x0000000000000000000000000000000000000000',
  137: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000',
  42161: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARBITRUM || '0x0000000000000000000000000000000000000000',
  80001: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000',
  80002: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON_AMOY || process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON_AMOY || '0xCDE08Be0190482691b3288C27240378497d74E79',
  421613: '0x0000000000000000000000000000000000000000',
  84532: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000',
  97: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_BSC_TESTNET || '0x0000000000000000000000000000000000000000',
  11155420: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_OP_SEPOLIA || '0x0000000000000000000000000000000000000000',
  421614: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARB_SEPOLIA || '0x0000000000000000000000000000000000000000',
};
