export type TestnetLiteBadgeColor = 'emerald' | 'purple' | 'yellow';

export interface TestnetLiteChainMeta {
  chainId: number;
  name: string;
  shortName: string;
  icon: string;
  nativeSymbol: string;
  explorerUrl: string;
  faucetUrl: string | null;
  rpcUrl?: string;
  description: string;
  badge: string;
  badgeColor: TestnetLiteBadgeColor;
  mode: 'demo' | 'primary' | 'secondary' | 'optional' | 'deprecated';
}

const PRIMARY_TESTNET_CHAIN_ID = 84532;
const SECONDARY_TESTNET_CHAIN_IDS = [80002];
const OPTIONAL_TESTNET_CHAIN_IDS = [97, 421614];
const DEPRECATED_CHAIN_IDS = [80001];

const TESTNET_LITE_CHAIN_META: Record<number, TestnetLiteChainMeta> = {
  31337: {
    chainId: 31337,
    name: 'Hardhat VPS',
    shortName: 'Hardhat',
    icon: '🖥️',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://kienai.id.vn/rpc/hardhat',
    faucetUrl: null,
    rpcUrl: process.env.NEXT_PUBLIC_HARDHAT_RPC_URL || 'https://kienai.id.vn/rpc/hardhat',
    description: 'Chain ảo trên VPS — demo nhanh, xác nhận gần như tức thì',
    badge: 'MIỄN PHÍ',
    badgeColor: 'emerald',
    mode: 'demo',
  },
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    shortName: 'Base',
    icon: '🔵',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://sepolia.basescan.org',
    faucetUrl: 'https://docs.base.org/tools/network-faucets',
    rpcUrl: 'https://sepolia.base.org',
    description: 'Public testnet chính cho demo thật 1-2 giao dịch bằng MetaMask',
    badge: 'TESTNET',
    badgeColor: 'emerald',
    mode: 'primary',
  },
  80002: {
    chainId: 80002,
    name: 'Polygon Amoy',
    shortName: 'Amoy',
    icon: '🔷',
    nativeSymbol: 'MATIC',
    explorerUrl: 'https://amoy.polygonscan.com',
    faucetUrl: 'https://docs.polygon.technology/tools/gas/matic-faucet/',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    description: 'Secondary Polygon testnet path. Dùng khi bạn đã có MATIC testnet.',
    badge: 'TESTNET',
    badgeColor: 'purple',
    mode: 'secondary',
  },
  97: {
    chainId: 97,
    name: 'BNB Testnet',
    shortName: 'BNB',
    icon: '🟡',
    nativeSymbol: 'BNB',
    explorerUrl: 'https://testnet.bscscan.com',
    faucetUrl: 'https://www.bnbchain.org/en/testnet-faucet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    description: 'Optional BNB testnet path. Faucet thực tế khó hơn nên không ưu tiên.',
    badge: 'TESTNET',
    badgeColor: 'yellow',
    mode: 'optional',
  },
  421614: {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'Arbitrum',
    icon: '⚡',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://sepolia.arbiscan.io',
    faucetUrl: 'https://www.alchemy.com/faucets/arbitrum-sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    description: 'Optional L2 testnet path. Không dùng làm primary demo chain.',
    badge: 'TESTNET',
    badgeColor: 'purple',
    mode: 'optional',
  },
  80001: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    shortName: 'Mumbai',
    icon: '🟣',
    nativeSymbol: 'MATIC',
    explorerUrl: 'https://mumbai.polygonscan.com',
    faucetUrl: null,
    description: 'Deprecated Polygon testnet path. Chỉ giữ để đọc dữ liệu cũ.',
    badge: 'DEPRECATED',
    badgeColor: 'yellow',
    mode: 'deprecated',
  },
};

export function getPrimaryTestnetChainId(): number {
  return PRIMARY_TESTNET_CHAIN_ID;
}

export function getSecondaryTestnetChainIds(): number[] {
  return [...SECONDARY_TESTNET_CHAIN_IDS];
}

export function getOptionalTestnetChainIds(): number[] {
  return [...OPTIONAL_TESTNET_CHAIN_IDS];
}

export function getDeprecatedChainIds(): number[] {
  return [...DEPRECATED_CHAIN_IDS];
}

export function getTestnetLiteChainMeta(chainId: number): TestnetLiteChainMeta | undefined {
  return TESTNET_LITE_CHAIN_META[chainId];
}

export function getDemoChainMeta(): TestnetLiteChainMeta {
  return TESTNET_LITE_CHAIN_META[31337];
}

export function getPublicTestnetMetas(): TestnetLiteChainMeta[] {
  return [
    TESTNET_LITE_CHAIN_META[PRIMARY_TESTNET_CHAIN_ID],
    ...SECONDARY_TESTNET_CHAIN_IDS.map((chainId) => TESTNET_LITE_CHAIN_META[chainId]),
    ...OPTIONAL_TESTNET_CHAIN_IDS.map((chainId) => TESTNET_LITE_CHAIN_META[chainId]),
  ];
}

export function getRecommendedCheckoutChainMetas(): TestnetLiteChainMeta[] {
  return [getDemoChainMeta(), ...getPublicTestnetMetas()];
}

export function getActiveRuntimeChainIds(): number[] {
  return [31337, PRIMARY_TESTNET_CHAIN_ID, ...SECONDARY_TESTNET_CHAIN_IDS, ...OPTIONAL_TESTNET_CHAIN_IDS];
}

export const TESTNET_LITE_CHAIN_LABELS: Record<number, string> = Object.fromEntries(
  Object.values(TESTNET_LITE_CHAIN_META).map((chain) => [chain.chainId, chain.name])
);
