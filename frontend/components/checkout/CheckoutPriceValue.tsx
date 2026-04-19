'use client';

import { CoinImage } from '@/components/ui/CoinImage';

type Size = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<Size, { amount: string; gap: string; icon: number }> = {
  sm: { amount: 'text-xs font-semibold', gap: 'gap-1.5', icon: 14 },
  md: { amount: 'text-sm font-bold', gap: 'gap-2', icon: 16 },
  lg: { amount: 'text-xl font-black', gap: 'gap-2.5', icon: 20 },
};

function formatUsdtAmount(amount: number | string) {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return '0.00';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface TokenAmountInlineProps {
  amount: number | string;
  symbol: string;
  size?: Size;
  className?: string;
  amountClassName?: string;
}

export function TokenAmountInline({
  amount,
  symbol,
  size = 'md',
  className = '',
  amountClassName = '',
}: TokenAmountInlineProps) {
  const styles = SIZE_MAP[size];
  const displayAmount = typeof amount === 'number' ? String(amount) : amount;

  return (
    <span
      className={['inline-flex items-center', styles.gap, className].filter(Boolean).join(' ')}
      aria-label={`${displayAmount} ${symbol}`}
    >
      <span className={[styles.amount, 'leading-none tabular-nums', amountClassName].filter(Boolean).join(' ')}>
        {displayAmount}
      </span>
      <CoinImage symbol={symbol} alt={symbol} size={styles.icon} className="rounded-full flex-shrink-0" />
    </span>
  );
}

interface UsdtAmountInlineProps {
  amount: number | string;
  size?: Size;
  className?: string;
  amountClassName?: string;
}

export function UsdtAmountInline({
  amount,
  size = 'md',
  className = '',
  amountClassName = '',
}: UsdtAmountInlineProps) {
  const styles = SIZE_MAP[size];
  const displayAmount = formatUsdtAmount(amount);

  return (
    <span
      className={['inline-flex items-center', styles.gap, className].filter(Boolean).join(' ')}
      aria-label={`${displayAmount} USDT`}
    >
      <span className={[styles.amount, 'leading-none tabular-nums', amountClassName].filter(Boolean).join(' ')}>
        {displayAmount}
      </span>
      <CoinImage symbol="USDT" alt="USDT" size={styles.icon} className="rounded-full flex-shrink-0" />
    </span>
  );
}
