import { describe, expect, it } from '@jest/globals';
import {
  formatRwaTokenBalance,
  isConfiguredContractAddress,
  parseRwaWholeTokenAmount,
} from '@/lib/rwa/onchain';

describe('rwa on-chain helpers', () => {
  it('treats empty, zero, and malformed contract addresses as unconfigured', () => {
    expect(isConfiguredContractAddress(undefined)).toBe(false);
    expect(isConfiguredContractAddress('')).toBe(false);
    expect(isConfiguredContractAddress('0x0000000000000000000000000000000000000000')).toBe(false);
    expect(isConfiguredContractAddress('not-an-address')).toBe(false);
  });

  it('accepts a valid non-zero contract address', () => {
    expect(isConfiguredContractAddress('0x5FbDB2315678afecb367f032d93F642f64180aa3')).toBe(true);
  });

  it('parses whole-token RWA amounts using 18 decimals', () => {
    expect(parseRwaWholeTokenAmount('3').toString()).toBe('3000000000000000000');
  });

  it('formats 18-decimal RWA token balances for humans', () => {
    expect(formatRwaTokenBalance(1000000000000000000n)).toBe('1');
    expect(formatRwaTokenBalance(2500000000000000000n)).toBe('2.5');
  });
});
