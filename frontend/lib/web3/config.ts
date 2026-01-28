import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonMumbai, arbitrum, arbitrumGoerli } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'Crypto Marketplace',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [polygon, polygonMumbai, arbitrum, arbitrumGoerli],
  ssr: true,
});

export const chains = [polygon, polygonMumbai, arbitrum, arbitrumGoerli];

// Contract addresses by chain
export const ESCROW_CONTRACTS: Record<number, string> = {
  137: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000',
  42161: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ARBITRUM || '0x0000000000000000000000000000000000000000',
  80001: '0x0000000000000000000000000000000000000000', // Mumbai testnet
  421613: '0x0000000000000000000000000000000000000000', // Arbitrum Goerli testnet
};
