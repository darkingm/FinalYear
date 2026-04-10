/**
 * Shared price formatting utilities for Web3Market.
 * All pages MUST use these instead of inline .toFixed() calls
 * to guarantee consistent display across the platform.
 */

// ── Platform Fee ─────────────────────────────────────────────
/** Platform fee rate: 0.5% */
export const PLATFORM_FEE_RATE = 0.005;

/** Display string for fee rate */
export const PLATFORM_FEE_LABEL = '0.5%';

/** Calculate platform fee from USD amount */
export function calcPlatformFee(usd: number): number {
  return Math.round(usd * PLATFORM_FEE_RATE * 100) / 100; // round to 2 decimal places
}

/** Calculate total with fee included */
export function calcTotalWithFee(usd: number): number {
  return Math.round((usd + calcPlatformFee(usd)) * 100) / 100;
}

// ── USD Formatting ───────────────────────────────────────────
/**
 * Format a number as USD price.
 * Always 2 decimal places with comma separator.
 * @example formatUSD(1999.5) => "$1,999.50"
 * @example formatUSD(0.99)   => "$0.99"
 */
export function formatUSD(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '$0.00';
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Crypto Formatting ────────────────────────────────────────
const HIGH_PRECISION_TOKENS = new Set(['ETH', 'WETH', 'BTC', 'WBTC']);
const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);

/**
 * Format a crypto amount with appropriate decimals based on token type.
 * - ETH/BTC: 6 decimals
 * - Stablecoins: 2 decimals
 * - Others (MATIC, SOL, etc.): 4 decimals
 * @example formatCrypto(0.001234567, 'ETH')  => "0.001235"
 * @example formatCrypto(100.123, 'USDT')     => "100.12"
 * @example formatCrypto(3331.6667, 'MATIC')  => "3331.6667"
 */
export function formatCrypto(amount: number | string, symbol: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';

  const sym = symbol.toUpperCase();

  if (STABLECOINS.has(sym)) return num.toFixed(2);
  if (HIGH_PRECISION_TOKENS.has(sym)) return num.toFixed(6);
  return num.toFixed(4);
}

/**
 * Format crypto with symbol appended.
 * @example formatCryptoWithSymbol(0.0012, 'ETH') => "0.001200 ETH"
 */
export function formatCryptoWithSymbol(amount: number | string, symbol: string): string {
  return `${formatCrypto(amount, symbol)} ${symbol}`;
}
