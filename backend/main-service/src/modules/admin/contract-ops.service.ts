import { ethers } from 'ethers';
import { query as defaultQuery } from '../../config/database';

type QueryFn = typeof defaultQuery;

interface ChainConfig {
  chainId: number;
  name: string;
  escrowAddress: string;
  nativeSymbol: string;
  rpcUrl: string;
  operatorAddress?: string | null;
  feeVaultAddress?: string | null;
}

interface ProviderLike {
  getBalance(address: string): Promise<bigint>;
  getBlockNumber(): Promise<number>;
  call(tx: { to: string; data: string }): Promise<string>;
}

type ProviderFactory = (chainId: number, rpcUrl: string) => ProviderLike;

interface ContractOpsServiceOptions {
  queryFn?: QueryFn;
  providerFactory?: ProviderFactory;
  chainConfigs?: ChainConfig[];
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BALANCE_OF_SELECTOR = '0x70a08231';
const PAUSED_SELECTOR = '0x5c975abb';
const FEE_VAULT_SELECTOR = '0xddca3f43';
const PLATFORM_FEE_SELECTOR = '0x4d146cd8';

function isConfiguredAddress(value?: string | null) {
  return !!value && value !== ZERO_ADDRESS;
}

function normalizeHexAddress(hexValue: string, fallback?: string | null) {
  if (!hexValue || hexValue === '0x') return fallback ?? null;
  const normalized = `0x${hexValue.slice(-40)}`;
  return normalized === ZERO_ADDRESS ? fallback ?? null : ethers.getAddress(normalized);
}

function formatFixedAmount(value: bigint, decimals: number) {
  return Number(ethers.formatUnits(value, decimals)).toFixed(6);
}

function decodeUint256(hexValue: string) {
  if (!hexValue || hexValue === '0x') return 0n;
  return BigInt(hexValue);
}

function decodeBool(hexValue: string) {
  return decodeUint256(hexValue) > 0n;
}

function encodeBalanceOf(contractAddress: string) {
  const normalized = contractAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  return `${BALANCE_OF_SELECTOR}${normalized}`;
}

function getDefaultChainConfigs(): ChainConfig[] {
  return [
    {
      chainId: 31337,
      name: 'Hardhat VPS',
      escrowAddress: process.env.ESCROW_CONTRACT_LOCALHOST || process.env.ESCROW_CONTRACT_ADDRESS || '',
      nativeSymbol: 'ETH',
      rpcUrl: process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545',
      operatorAddress: process.env.OPERATOR_ADDRESS || process.env.ADMIN_PUBLIC_KEY || null,
      feeVaultAddress: process.env.FEE_VAULT_ADDRESS || null,
    },
    {
      chainId: 84532,
      name: 'Base Sepolia',
      escrowAddress: process.env.ESCROW_CONTRACT_BASE_SEPOLIA || '',
      nativeSymbol: 'ETH',
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      operatorAddress: process.env.OPERATOR_ADDRESS || process.env.ADMIN_PUBLIC_KEY || null,
      feeVaultAddress: process.env.FEE_VAULT_ADDRESS || null,
    },
    {
      chainId: 80002,
      name: 'Polygon Amoy',
      escrowAddress: process.env.ESCROW_CONTRACT_POLYGON_AMOY || '',
      nativeSymbol: 'MATIC',
      rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      operatorAddress: process.env.OPERATOR_ADDRESS || process.env.ADMIN_PUBLIC_KEY || null,
      feeVaultAddress: process.env.FEE_VAULT_ADDRESS || null,
    },
    {
      chainId: 97,
      name: 'BNB Testnet',
      escrowAddress: process.env.ESCROW_CONTRACT_BSC_TESTNET || '',
      nativeSymbol: 'BNB',
      rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      operatorAddress: process.env.OPERATOR_ADDRESS || process.env.ADMIN_PUBLIC_KEY || null,
      feeVaultAddress: process.env.FEE_VAULT_ADDRESS || null,
    },
    {
      chainId: 421614,
      name: 'Arbitrum Sepolia',
      escrowAddress: process.env.ESCROW_CONTRACT_ARB_SEPOLIA || '',
      nativeSymbol: 'ETH',
      rpcUrl: process.env.ARB_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
      operatorAddress: process.env.OPERATOR_ADDRESS || process.env.ADMIN_PUBLIC_KEY || null,
      feeVaultAddress: process.env.FEE_VAULT_ADDRESS || null,
    },
  ];
}

export class ContractOpsService {
  private readonly queryFn: QueryFn;
  private readonly providerFactory: ProviderFactory;
  private readonly chainConfigs: ChainConfig[];

  constructor(options: ContractOpsServiceOptions = {}) {
    this.queryFn = options.queryFn || defaultQuery;
    this.providerFactory = options.providerFactory || ((_: number, rpcUrl: string) => new ethers.JsonRpcProvider(rpcUrl));
    this.chainConfigs = options.chainConfigs || getDefaultChainConfigs();
  }

  async listSnapshots() {
    const tokenRowsResult = await this.queryFn(
      `SELECT token_id, chain_id, symbol, token_address, decimals
       FROM token_whitelist
       WHERE is_active = true
       ORDER BY chain_id, symbol`
    );

    const tokensByChain = new Map<number, Array<{ token_id: number; chain_id: number; symbol: string; token_address: string; decimals: number }>>();
    for (const row of tokenRowsResult.rows) {
      const chainTokens = tokensByChain.get(row.chain_id) || [];
      chainTokens.push(row);
      tokensByChain.set(row.chain_id, chainTokens);
    }

    return Promise.all(this.chainConfigs.map(async (chain) => {
      if (!isConfiguredAddress(chain.escrowAddress)) {
        return {
          chain_id: chain.chainId,
          chain_name: chain.name,
          escrow_contract: chain.escrowAddress || null,
          availability: 'unavailable' as const,
          native_symbol: chain.nativeSymbol,
          native_balance: null,
          platform_fee_bps: null,
          paused: null,
          operator_address: chain.operatorAddress || null,
          fee_vault_address: chain.feeVaultAddress || null,
          balances: [],
          health: {
            rpc_status: 'not_configured',
            error_summary: null,
          },
        };
      }

      try {
        const provider = this.providerFactory(chain.chainId, chain.rpcUrl);
        const [nativeBalance, blockNumber, pausedHex, feeVaultHex, feeBpsHex] = await Promise.all([
          provider.getBalance(chain.escrowAddress),
          provider.getBlockNumber(),
          provider.call({ to: chain.escrowAddress, data: PAUSED_SELECTOR }),
          provider.call({ to: chain.escrowAddress, data: FEE_VAULT_SELECTOR }),
          provider.call({ to: chain.escrowAddress, data: PLATFORM_FEE_SELECTOR }),
        ]);

        const tokenBalances = await Promise.all(
          (tokensByChain.get(chain.chainId) || []).map(async (token) => {
            const rawBalance = await provider.call({
              to: token.token_address,
              data: encodeBalanceOf(chain.escrowAddress),
            });

            const balance = decodeUint256(rawBalance);
            return {
              token_id: token.token_id,
              symbol: token.symbol,
              token_address: token.token_address,
              decimals: token.decimals,
              amount: formatFixedAmount(balance, token.decimals),
            };
          })
        );

        const feeVaultAddress = normalizeHexAddress(feeVaultHex, chain.feeVaultAddress);

        return {
          chain_id: chain.chainId,
          chain_name: chain.name,
          escrow_contract: chain.escrowAddress,
          availability: 'available' as const,
          native_symbol: chain.nativeSymbol,
          native_balance: formatFixedAmount(nativeBalance, 18),
          block_number: blockNumber,
          platform_fee_bps: Number(decodeUint256(feeBpsHex)),
          paused: decodeBool(pausedHex),
          operator_address: chain.operatorAddress || null,
          fee_vault_address: feeVaultAddress,
          balances: tokenBalances,
          health: {
            rpc_status: 'ok',
            error_summary: null,
          },
        };
      } catch (error: any) {
        return {
          chain_id: chain.chainId,
          chain_name: chain.name,
          escrow_contract: chain.escrowAddress,
          availability: 'degraded' as const,
          native_symbol: chain.nativeSymbol,
          native_balance: null,
          platform_fee_bps: null,
          paused: null,
          operator_address: chain.operatorAddress || null,
          fee_vault_address: chain.feeVaultAddress || null,
          balances: [],
          health: {
            rpc_status: 'degraded',
            error_summary: error?.message || 'RPC error',
          },
        };
      }
    }));
  }
}
