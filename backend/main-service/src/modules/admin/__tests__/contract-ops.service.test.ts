import { ContractOpsService } from '../contract-ops.service';

describe('ContractOpsService', () => {
  it('returns a row per configured chain and marks missing escrow as unavailable', async () => {
    const queryFn = jest.fn().mockResolvedValue({
      rows: [
        {
          chain_id: 84532,
          symbol: 'USDT',
          token_address: '0x00000000000000000000000000000000000000aa',
          decimals: 6,
          is_active: true,
        },
      ],
    });

    const providerFactory = jest.fn((chainId: number) => {
      if (chainId === 84532) {
        return {
          getBalance: jest.fn().mockResolvedValue(2000000000000000000n),
          getBlockNumber: jest.fn().mockResolvedValue(123456),
          call: jest.fn().mockImplementation(async ({ data }: { data: string }) => {
            if (data === '0x5c975abb') return '0x' + '0'.repeat(63) + '1';
            if (data === '0xddca3f43') return '0x00000000000000000000000000000000000000000000000000000000000000dd';
            if (data === '0x4d146cd8') return '0x0000000000000000000000000000000000000000000000000000000000000032';
            if (data.startsWith('0x70a08231')) return '0x0000000000000000000000000000000000000000000000000000000000989680';
            return '0x';
          }),
        };
      }

      return {
        getBalance: jest.fn().mockResolvedValue(0n),
        getBlockNumber: jest.fn().mockResolvedValue(1),
        call: jest.fn().mockResolvedValue('0x'),
      };
    });

    const service = new ContractOpsService({
      queryFn,
      providerFactory,
      chainConfigs: [
        {
          chainId: 31337,
          name: 'Hardhat VPS',
          escrowAddress: '',
          nativeSymbol: 'ETH',
          rpcUrl: 'http://127.0.0.1:8545',
        },
        {
          chainId: 84532,
          name: 'Base Sepolia',
          escrowAddress: '0x00000000000000000000000000000000000000be',
          nativeSymbol: 'ETH',
          rpcUrl: 'https://sepolia.base.org',
          operatorAddress: '0x00000000000000000000000000000000000000cc',
          feeVaultAddress: '0x00000000000000000000000000000000000000dd',
        },
      ],
    });

    const rows = await service.listSnapshots();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      chain_id: 31337,
      availability: 'unavailable',
      balances: [],
    });
    expect(rows[1]).toMatchObject({
      chain_id: 84532,
      availability: 'available',
      native_balance: '2.000000',
      operator_address: '0x00000000000000000000000000000000000000cc',
      fee_vault_address: '0x00000000000000000000000000000000000000dd',
      paused: true,
      platform_fee_bps: 50,
    });
    expect(rows[1].balances[0]).toMatchObject({
      symbol: 'USDT',
      amount: '10.000000',
    });
  });

  it('degrades health instead of throwing when RPC fails', async () => {
    const service = new ContractOpsService({
      queryFn: jest.fn().mockResolvedValue({ rows: [] }),
      providerFactory: jest.fn(() => {
        throw new Error('rpc down');
      }),
      chainConfigs: [
        {
          chainId: 84532,
          name: 'Base Sepolia',
          escrowAddress: '0x00000000000000000000000000000000000000be',
          nativeSymbol: 'ETH',
          rpcUrl: 'https://sepolia.base.org',
        },
      ],
    });

    const rows = await service.listSnapshots();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      chain_id: 84532,
      availability: 'degraded',
    });
    expect(rows[0].health.error_summary).toBe('rpc down');
  });
});
