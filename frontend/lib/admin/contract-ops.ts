export interface ContractOpsChainSnapshot {
  chain_id: number;
  chain_name: string;
  escrow_contract: string | null;
  availability: 'available' | 'unavailable' | 'degraded';
  native_symbol: string;
  native_balance: string | null;
  operator_address?: string | null;
  fee_vault_address?: string | null;
  platform_fee_bps?: number | null;
  paused?: boolean | null;
  balances: Array<{
    symbol: string;
    amount: string;
    token_address?: string;
    decimals?: number;
  }>;
  health: {
    rpc_status: string;
    error_summary: string | null;
  };
}

export interface ContractOpsCardModel {
  chainId: number;
  title: string;
  availability: ContractOpsChainSnapshot['availability'];
  statusLabel: string;
  statusTone: 'emerald' | 'amber' | 'slate';
  contractAddress: string | null;
  nativeBalanceLabel: string;
  operatorAddress: string | null;
  feeVaultAddress: string | null;
  tokenBalanceLabels: string[];
  healthSummary: string | null;
  paused: boolean | null;
  platformFeeLabel: string | null;
}

export function shapeContractOpsChains(chains: ContractOpsChainSnapshot[]): ContractOpsCardModel[] {
  return chains.map((chain) => {
    const statusLabel = chain.availability === 'available'
      ? 'Sẵn sàng'
      : chain.availability === 'degraded'
        ? 'RPC lỗi'
        : 'Chưa deploy escrow';

    const statusTone = chain.availability === 'available'
      ? 'emerald'
      : chain.availability === 'degraded'
        ? 'amber'
        : 'slate';

    return {
      chainId: chain.chain_id,
      title: chain.chain_name,
      availability: chain.availability,
      statusLabel,
      statusTone,
      contractAddress: chain.escrow_contract,
      nativeBalanceLabel: chain.native_balance ? `${chain.native_balance} ${chain.native_symbol}` : '—',
      operatorAddress: chain.operator_address || null,
      feeVaultAddress: chain.fee_vault_address || null,
      tokenBalanceLabels: chain.balances.map((balance) => `${balance.amount} ${balance.symbol}`),
      healthSummary: chain.health.error_summary || (chain.availability === 'available' ? 'RPC OK' : null),
      paused: chain.paused ?? null,
      platformFeeLabel: typeof chain.platform_fee_bps === 'number'
        ? `${(chain.platform_fee_bps / 100).toFixed(2)}%`
        : null,
    };
  });
}
