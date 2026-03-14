// ─── Price Formatting ────────────────────────────────────────────────────────
export function formatPrice(
  amount: number | string | null | undefined,
  symbol?: string | null,
  decimals?: number,
): string {
  if (amount === null || amount === undefined) return '—';
  const num = Number(amount);
  if (isNaN(num)) return '—';

  if (symbol) {
    const dec = decimals ?? (['ETH', 'WBTC'].includes(symbol) ? 6 : 4);
    return `${num.toFixed(dec)} ${symbol}`;
  }
  // USD default
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPriceCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

// ─── Date / Time ──────────────────────────────────────────────────────────────
export function formatDate(iso: string | null | undefined, options?: {
  showTime?: boolean;
  locale?: string;
}): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  const locale = options?.locale ?? 'vi-VN';
  const fmt: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(options?.showTime && { hour: '2-digit', minute: '2-digit' }),
  };
  return date.toLocaleDateString(locale, fmt);
}

export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Vừa xong';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return formatDate(iso);
}

export function formatCountdown(targetIso: string): string {
  const remaining = new Date(targetIso).getTime() - Date.now();
  if (remaining <= 0) return 'Đã hết hạn';
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m còn lại`;
  if (m > 0) return `${m}m ${s}s còn lại`;
  return `${s}s còn lại`;
}

// ─── Blockchain ───────────────────────────────────────────────────────────────
export function shortenAddress(address: string | null | undefined, chars = 4): string {
  if (!address) return '—';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function getTxUrl(txHash: string, network: 'polygon' | 'amoy' = 'amoy'): string {
  const base = network === 'polygon'
    ? 'https://polygonscan.com'
    : 'https://amoy.polygonscan.com';
  return `${base}/tx/${txHash}`;
}

export function getAddressUrl(address: string, network: 'polygon' | 'amoy' = 'amoy'): string {
  const base = network === 'polygon'
    ? 'https://polygonscan.com'
    : 'https://amoy.polygonscan.com';
  return `${base}/address/${address}`;
}

// ─── Score / Tier ─────────────────────────────────────────────────────────────
export function formatScore(score: number): string {
  return `${score.toLocaleString('en-US')} PTS`;
}

export type SBTTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';

export const TIER_CONFIG: Record<SBTTier, {
  label: string; emoji: string; color: string; minScore: number; nextScore: number | null;
  feeDiscount: number; canInstallment: boolean;
}> = {
  BRONZE:  { label: 'Đồng',       emoji: '🥉', color: '#b45309', minScore: 0,   nextScore: 100,  feeDiscount: 0,   canInstallment: false },
  SILVER:  { label: 'Bạc',        emoji: '🥈', color: '#9ca3af', minScore: 100,  nextScore: 300,  feeDiscount: 0.5, canInstallment: false },
  GOLD:    { label: 'Vàng',       emoji: '🥇', color: '#f0b90b', minScore: 300,  nextScore: 600,  feeDiscount: 1.0, canInstallment: true },
  DIAMOND: { label: 'Kim Cương',  emoji: '💎', color: '#818cf8', minScore: 600,  nextScore: null, feeDiscount: 1.5, canInstallment: true },
};

export function scoreToTier(score: number): SBTTier {
  if (score >= 600) return 'DIAMOND';
  if (score >= 300) return 'GOLD';
  if (score >= 100) return 'SILVER';
  return 'BRONZE';
}

export function tierProgress(score: number): number {
  const tier = scoreToTier(score);
  const cfg = TIER_CONFIG[tier];
  if (!cfg.nextScore) return 100;
  return Math.min(((score - cfg.minScore) / (cfg.nextScore - cfg.minScore)) * 100, 100);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}
