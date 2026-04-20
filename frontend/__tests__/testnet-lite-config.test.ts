import { describe, expect, it } from '@jest/globals';
import {
  getDeprecatedChainIds,
  getPrimaryTestnetChainId,
  getSecondaryTestnetChainIds,
  getTestnetLiteChainMeta,
} from '@/lib/web3/testnet-lite';

describe('testnet lite config', () => {
  it('marks Base Sepolia as the primary public testnet', () => {
    expect(getPrimaryTestnetChainId()).toBe(84532);
  });

  it('keeps Polygon Amoy as a secondary testnet and retires Mumbai', () => {
    expect(getSecondaryTestnetChainIds()).toContain(80002);
    expect(getDeprecatedChainIds()).toContain(80001);
  });

  it('exposes faucet and explorer metadata for the primary path', () => {
    const baseSepolia = getTestnetLiteChainMeta(84532);

    expect(baseSepolia?.name).toBe('Base Sepolia');
    expect(baseSepolia?.explorerUrl).toBe('https://sepolia.basescan.org');
    expect(baseSepolia?.faucetUrl).toContain('base.org');
  });
});
