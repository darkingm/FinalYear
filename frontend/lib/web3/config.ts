import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import type { Config } from 'wagmi';
import { polygon, polygonMumbai, arbitrum, arbitrumGoerli } from 'wagmi/chains';
import { defineChain } from 'viem';

// Hardhat / Anvil local node (chainId 31337) – dùng khi chạy `npx hardhat node` hoặc `anvil`
export const localhost = defineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

const allChains = [localhost, polygon, polygonMumbai, arbitrum, arbitrumGoerli] as const;

// Singleton: create config once per context to avoid "WalletConnect Core is already initialized"
let _wagmiConfig: Config | null = null;

function createConfig(): Config {
  return getDefaultConfig({
    appName: 'Crypto Marketplace',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
    chains: allChains as unknown as readonly [typeof localhost, ...typeof allChains],
    ssr: true,
  }) as unknown as Config;
}

export function getWagmiConfig(): Config {
  if (typeof window === 'undefined') return createConfig();
  if (!_wagmiConfig) _wagmiConfig = createConfig();
  return _wagmiConfig;
}

export const chains = allChains;

// Contract addresses by chain
export const ESCROW_CONTRACTS: Record<number, string> = {
  31337: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_LOCALHOST || '0x0000000000000000000000000000000000000000', // Hardhat local
  137: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000',
  42161: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARBITRUM || '0x0000000000000000000000000000000000000000',
  80001: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000', // Mumbai testnet
  80002: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000', // Amoy testnet
  421613: '0x0000000000000000000000000000000000000000', // Arbitrum Goerli testnet
};
