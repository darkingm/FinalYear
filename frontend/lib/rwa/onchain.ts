export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isConfiguredContractAddress(address?: string | null): address is `0x${string}` {
  return !!address && ADDRESS_RE.test(address) && address.toLowerCase() !== ZERO_ADDRESS;
}

export function getRwaMarketEscrowAddress(): `0x${string}` | null {
  const address = process.env.NEXT_PUBLIC_RWA_MARKET_ESCROW_ADDRESS;
  return isConfiguredContractAddress(address) ? address : null;
}

export function parseRwaWholeTokenAmount(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) {
    throw new Error('Invalid token amount');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}

export function formatRwaTokenBalance(balance: bigint | number | string, decimals = 18): string {
  const raw = BigInt(balance);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}
