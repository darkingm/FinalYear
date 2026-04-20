import { describe, expect, it } from '@jest/globals';
import { shapeContractOpsChains } from '@/lib/admin/contract-ops';

describe('contract ops shaping', () => {
  it('keeps available chains readable with address and balances', () => {
    const cards = shapeContractOpsChains([
      {
        chain_id: 84532,
        chain_name: 'Base Sepolia',
        escrow_contract: '0x00000000000000000000000000000000000000be',
        availability: 'available',
        native_symbol: 'ETH',
        native_balance: '2.000000',
        operator_address: '0x00000000000000000000000000000000000000cc',
        fee_vault_address: '0x00000000000000000000000000000000000000dd',
        balances: [{ symbol: 'USDT', amount: '10.000000' }],
        health: { rpc_status: 'ok', error_summary: null },
      },
    ]);

    expect(cards[0]).toMatchObject({
      chainId: 84532,
      availability: 'available',
      title: 'Base Sepolia',
      statusLabel: 'Sẵn sàng',
      nativeBalanceLabel: '2.000000 ETH',
    });
    expect(cards[0].tokenBalanceLabels).toContain('10.000000 USDT');
  });

  it('shows explicit unavailable state when no escrow is deployed', () => {
    const cards = shapeContractOpsChains([
      {
        chain_id: 31337,
        chain_name: 'Hardhat VPS',
        escrow_contract: null,
        availability: 'unavailable',
        native_symbol: 'ETH',
        native_balance: null,
        balances: [],
        health: { rpc_status: 'not_configured', error_summary: null },
      },
    ]);

    expect(cards[0]).toMatchObject({
      chainId: 31337,
      availability: 'unavailable',
      statusLabel: 'Chưa deploy escrow',
    });
  });

  it('marks degraded RPC state without breaking rendering', () => {
    const cards = shapeContractOpsChains([
      {
        chain_id: 80002,
        chain_name: 'Polygon Amoy',
        escrow_contract: '0x00000000000000000000000000000000000000aa',
        availability: 'degraded',
        native_symbol: 'MATIC',
        native_balance: null,
        balances: [],
        health: { rpc_status: 'degraded', error_summary: 'rpc down' },
      },
    ]);

    expect(cards[0]).toMatchObject({
      chainId: 80002,
      availability: 'degraded',
      statusLabel: 'RPC lỗi',
      statusTone: 'amber',
      healthSummary: 'rpc down',
    });
  });
});
