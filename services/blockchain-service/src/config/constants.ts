import { NetworkConfig } from './networks';

// Popular token addresses on different networks
export const POPULAR_TOKENS: Record<string, Record<string, { address: string; decimals: number; symbol: string; name: string }>> = {
  ethereum_mainnet: {
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
      symbol: 'DAI',
      name: 'Dai Stablecoin',
    },
    WETH: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
    },
  },
  bsc_mainnet: {
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    BUSD: {
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      decimals: 18,
      symbol: 'BUSD',
      name: 'Binance USD',
    },
    WBNB: {
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      decimals: 18,
      symbol: 'WBNB',
      name: 'Wrapped BNB',
    },
  },
  polygon_mainnet: {
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    WMATIC: {
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      decimals: 18,
      symbol: 'WMATIC',
      name: 'Wrapped MATIC',
    },
  },
  arbitrum_mainnet: {
    USDT: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    WETH: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
    },
  },
  optimism_mainnet: {
    USDT: {
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
    },
  },
  avalanche_mainnet: {
    USDT: {
      address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    WAVAX: {
      address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      decimals: 18,
      symbol: 'WAVAX',
      name: 'Wrapped AVAX',
    },
  },
  base_mainnet: {
    USDC: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
    },
  },
};

// DEX Router Addresses
export const DEX_ROUTERS: Record<string, Record<string, string>> = {
  ethereum_mainnet: {
    uniswap_v2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswap_v3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  },
  bsc_mainnet: {
    pancakeswap_v2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    pancakeswap_v3: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  },
  polygon_mainnet: {
    quickswap: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
  },
  arbitrum_mainnet: {
    uniswap_v3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
  },
  optimism_mainnet: {
    uniswap_v3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  },
  avalanche_mainnet: {
    traderjoe: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
    pangolin: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
  },
  base_mainnet: {
    uniswap_v3: '0x2626664c2603336E57B271c5C0b26F421741e481',
  },
};

// Transaction status
export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

// Transaction types
export enum TransactionType {
  TRANSFER_NATIVE = 'TRANSFER_NATIVE',
  TRANSFER_TOKEN = 'TRANSFER_TOKEN',
  SWAP = 'SWAP',
  MINT = 'MINT',
  BURN = 'BURN',
  APPROVAL = 'APPROVAL',
}

// Gas limits (in units)
export const GAS_LIMITS = {
  TRANSFER_NATIVE: 21000,
  TRANSFER_TOKEN: 65000,
  SWAP: 300000,
  APPROVAL: 46000,
};

// Minimum confirmations required
export const MIN_CONFIRMATIONS: Record<string, number> = {
  bitcoin_mainnet: 6,
  bitcoin_testnet: 1,
  ethereum_mainnet: 12,
  ethereum_testnet: 1,
  bsc_mainnet: 3,
  bsc_testnet: 1,
  polygon_mainnet: 1,
  polygon_testnet: 1,
  arbitrum_mainnet: 1,
  arbitrum_testnet: 1,
  optimism_mainnet: 1,
  optimism_testnet: 1,
  avalanche_mainnet: 1,
  avalanche_testnet: 1,
  base_mainnet: 1,
  base_testnet: 1,
  zksync_mainnet: 1,
  zksync_testnet: 1,
};

// Default gas price multipliers
export const GAS_PRICE_MULTIPLIERS = {
  SLOW: 1.0,
  STANDARD: 1.1,
  FAST: 1.2,
  URGENT: 1.5,
};

// API endpoints for DEX aggregators
export const DEX_AGGREGATORS = {
  ONEINCH: {
    mainnet: 'https://api.1inch.io/v5.0',
    testnet: 'https://api.1inch.io/v5.0',
  },
  ZEROX: {
    mainnet: 'https://api.0x.org',
    testnet: 'https://goerli.api.0x.org',
  },
};

// Rate limiting
export const RATE_LIMITS = {
  RPC_CALLS_PER_SECOND: 10,
  API_CALLS_PER_MINUTE: 60,
  TRANSACTION_RETRY_DELAY: 5000, // 5 seconds
  MAX_RETRIES: 3,
};

// Cache TTL (in seconds)
export const CACHE_TTL = {
  BALANCE: 30,
  GAS_PRICE: 60,
  TOKEN_INFO: 3600,
  NETWORK_INFO: 86400,
};



