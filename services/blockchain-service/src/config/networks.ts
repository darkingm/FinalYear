export enum NetworkType {
  BITCOIN = 'BITCOIN',
  EVM = 'EVM',
}

export enum NetworkEnvironment {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

export interface NetworkConfig {
  id: string;
  name: string;
  type: NetworkType;
  environment: NetworkEnvironment;
  chainId?: number;
  rpcUrl: string;
  rpcUrlFallback?: string[];
  explorerUrl: string;
  nativeCurrency: {
    symbol: string;
    name: string;
    decimals: number;
  };
  blockTime: number;
  isTestnet: boolean;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  // Bitcoin
  bitcoin_mainnet: {
    id: 'bitcoin_mainnet',
    name: 'Bitcoin',
    type: NetworkType.BITCOIN,
    environment: NetworkEnvironment.MAINNET,
    rpcUrl: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api',
    explorerUrl: 'https://blockstream.info',
    nativeCurrency: {
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
    },
    blockTime: 600,
    isTestnet: false,
  },
  bitcoin_testnet: {
    id: 'bitcoin_testnet',
    name: 'Bitcoin Testnet',
    type: NetworkType.BITCOIN,
    environment: NetworkEnvironment.TESTNET,
    rpcUrl: process.env.BITCOIN_TESTNET_RPC_URL || 'https://blockstream.info/testnet/api',
    explorerUrl: 'https://blockstream.info/testnet',
    nativeCurrency: {
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
    },
    blockTime: 600,
    isTestnet: true,
  },

  // Ethereum
  ethereum_mainnet: {
    id: 'ethereum_mainnet',
    name: 'Ethereum',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL || 'https://eth.llamarpc.com',
    rpcUrlFallback: [
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
    ],
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 12,
    isTestnet: false,
  },
  ethereum_testnet: {
    id: 'ethereum_testnet',
    name: 'Ethereum Sepolia',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 11155111,
    rpcUrl: process.env.ETHEREUM_TESTNET_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 12,
    isTestnet: true,
  },

  // Binance Smart Chain
  bsc_mainnet: {
    id: 'bsc_mainnet',
    name: 'BNB Smart Chain',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 56,
    rpcUrl: process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed1.binance.org',
    rpcUrlFallback: [
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org',
      'https://bsc-dataseed4.binance.org',
    ],
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
    },
    blockTime: 3,
    isTestnet: false,
  },
  bsc_testnet: {
    id: 'bsc_testnet',
    name: 'BNB Smart Chain Testnet',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 97,
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: {
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
    },
    blockTime: 3,
    isTestnet: true,
  },

  // Polygon
  polygon_mainnet: {
    id: 'polygon_mainnet',
    name: 'Polygon',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 137,
    rpcUrl: process.env.POLYGON_MAINNET_RPC_URL || 'https://polygon-rpc.com',
    rpcUrlFallback: [
      'https://rpc-mainnet.matic.network',
      'https://matic-mainnet.chainstacklabs.com',
    ],
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      symbol: 'MATIC',
      name: 'MATIC',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: false,
  },
  polygon_testnet: {
    id: 'polygon_testnet',
    name: 'Polygon Mumbai',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 80001,
    rpcUrl: process.env.POLYGON_TESTNET_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
    explorerUrl: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      symbol: 'MATIC',
      name: 'MATIC',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: true,
  },

  // Arbitrum
  arbitrum_mainnet: {
    id: 'arbitrum_mainnet',
    name: 'Arbitrum One',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_MAINNET_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    rpcUrlFallback: [
      'https://arbitrum.publicnode.com',
    ],
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 0.25,
    isTestnet: false,
  },
  arbitrum_testnet: {
    id: 'arbitrum_testnet',
    name: 'Arbitrum Sepolia',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 421614,
    rpcUrl: process.env.ARBITRUM_TESTNET_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 0.25,
    isTestnet: true,
  },

  // Optimism
  optimism_mainnet: {
    id: 'optimism_mainnet',
    name: 'Optimism',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 10,
    rpcUrl: process.env.OPTIMISM_MAINNET_RPC_URL || 'https://mainnet.optimism.io',
    rpcUrlFallback: [
      'https://optimism.publicnode.com',
    ],
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: false,
  },
  optimism_testnet: {
    id: 'optimism_testnet',
    name: 'Optimism Sepolia',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 11155420,
    rpcUrl: process.env.OPTIMISM_TESTNET_RPC_URL || 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: true,
  },

  // Avalanche
  avalanche_mainnet: {
    id: 'avalanche_mainnet',
    name: 'Avalanche C-Chain',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 43114,
    rpcUrl: process.env.AVALANCHE_MAINNET_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    rpcUrlFallback: [
      'https://avalanche.publicnode.com',
    ],
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: {
      symbol: 'AVAX',
      name: 'Avalanche',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: false,
  },
  avalanche_testnet: {
    id: 'avalanche_testnet',
    name: 'Avalanche Fuji',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 43113,
    rpcUrl: process.env.AVALANCHE_TESTNET_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    explorerUrl: 'https://testnet.snowtrace.io',
    nativeCurrency: {
      symbol: 'AVAX',
      name: 'Avalanche',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: true,
  },

  // Base
  base_mainnet: {
    id: 'base_mainnet',
    name: 'Base',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 8453,
    rpcUrl: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
    rpcUrlFallback: [
      'https://base.publicnode.com',
    ],
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: false,
  },
  base_testnet: {
    id: 'base_testnet',
    name: 'Base Sepolia',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 84532,
    rpcUrl: process.env.BASE_TESTNET_RPC_URL || 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 2,
    isTestnet: true,
  },

  // zkSync Era
  zksync_mainnet: {
    id: 'zksync_mainnet',
    name: 'zkSync Era',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.MAINNET,
    chainId: 324,
    rpcUrl: process.env.ZKSYNC_MAINNET_RPC_URL || 'https://mainnet.era.zksync.io',
    explorerUrl: 'https://explorer.zksync.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 1,
    isTestnet: false,
  },
  zksync_testnet: {
    id: 'zksync_testnet',
    name: 'zkSync Era Testnet',
    type: NetworkType.EVM,
    environment: NetworkEnvironment.TESTNET,
    chainId: 300,
    rpcUrl: process.env.ZKSYNC_TESTNET_RPC_URL || 'https://sepolia.era.zksync.dev',
    explorerUrl: 'https://sepolia.explorer.zksync.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    },
    blockTime: 1,
    isTestnet: true,
  },
};

export const getNetworkById = (networkId: string): NetworkConfig | undefined => {
  return NETWORKS[networkId];
};

export const getNetworkByChainId = (chainId: number, isTestnet: boolean = false): NetworkConfig | undefined => {
  return Object.values(NETWORKS).find(
    (network) => network.chainId === chainId && network.isTestnet === isTestnet
  );
};

export const getNetworksByType = (type: NetworkType): NetworkConfig[] => {
  return Object.values(NETWORKS).filter((network) => network.type === type);
};

export const getMainnetNetworks = (): NetworkConfig[] => {
  return Object.values(NETWORKS).filter((network) => !network.isTestnet);
};

export const getTestnetNetworks = (): NetworkConfig[] => {
  return Object.values(NETWORKS).filter((network) => network.isTestnet);
};



