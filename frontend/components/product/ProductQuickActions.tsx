'use client';

import { ShoppingCart, Zap } from 'lucide-react';
import { paymentPageTheme } from '@/lib/payments/payment-page-theme';

interface ProductQuickActionsProps {
  onAddToCart?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onBuyNow: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  size?: 'card' | 'detail';
}

export function ProductQuickActions({
  onAddToCart,
  onBuyNow,
  disabled = false,
  size = 'card',
}: ProductQuickActionsProps) {
  const compact = size === 'card';

  return (
    <div className="flex items-center gap-2">
      {onAddToCart ? (
        <button
          type="button"
          onClick={onAddToCart}
          disabled={disabled}
          aria-label="Thêm vào giỏ hàng"
          title="Thêm vào giỏ hàng"
          className={[
            `inline-flex items-center justify-center rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-50 ${paymentPageTheme.ghostButton} dark:border-violet-500/30 dark:hover:border-violet-400/60`,
            compact ? 'h-10 w-10' : 'h-12 w-12',
          ].join(' ')}
        >
          <ShoppingCart className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onBuyNow}
        disabled={disabled}
        className={[
          'inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f0b90b] font-black text-black shadow-lg shadow-yellow-500/20 transition-all hover:bg-[#e6a800] disabled:cursor-not-allowed disabled:opacity-50',
          compact ? 'h-10 px-4 text-sm' : 'h-12 px-5 text-base',
        ].join(' ')}
      >
        <Zap className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        Mua ngay
      </button>
    </div>
  );
}
