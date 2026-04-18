'use client';

import { CoinImage } from '@/components/ui/CoinImage';
import { buildAcceptedTokenChipState } from '@/lib/products/pricing';
import type { ProductAcceptedTokenView } from '@/lib/products/types';

interface ProductTokenPricingProps {
  acceptedTokens: ProductAcceptedTokenView[];
  basePriceUsd: number;
  selectedTokenId?: number | null;
  onSelect?: (token: ProductAcceptedTokenView) => void;
  variant?: 'card' | 'detail';
  stock?: number;
}

function formatUsd(value: number) {
  return `$${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function renderStockLabel(stock?: number) {
  if (stock === undefined) return null;
  if (stock === 0) return 'Hết hàng';
  if (stock <= 5) return `Còn ${stock}`;
  return `${stock} còn lại`;
}

function resolveCoinImageSymbol(symbol: string) {
  return symbol.toUpperCase() === 'USDT' ? 'USDT_LOCAL' : symbol;
}

export function ProductTokenPricing({
  acceptedTokens,
  basePriceUsd,
  selectedTokenId,
  onSelect,
  variant = 'card',
  stock,
}: ProductTokenPricingProps) {
  const chipState = buildAcceptedTokenChipState(acceptedTokens, {
    selectedTokenId,
    maxVisible: variant === 'detail' ? acceptedTokens.length : 3,
  });

  if (chipState.all.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Chưa cấu hình giá coin cho sản phẩm này
      </div>
    );
  }

  const interactive = typeof onSelect === 'function';
  const isDetail = variant === 'detail';
  const stockLabel = renderStockLabel(stock);
  const ChipWrapper = interactive ? 'button' : 'div';

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {chipState.visible.map((token) => (
          <ChipWrapper
            key={`${token.token_id}-${token.symbol}`}
            {...(interactive ? {
              type: 'button',
              onClick: () => onSelect?.(token),
              'aria-label': `Chọn ${token.symbol} ${token.amountLabel}`,
            } : {})}
            className={[
              'inline-flex items-center gap-2 rounded-full border text-left transition',
              isDetail ? 'min-h-11 px-3.5 py-2' : 'min-h-9 px-3 py-1.5',
              token.isActive
                ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                : 'border-border bg-card/80 text-foreground/90',
              interactive ? 'hover:border-primary/40 hover:bg-primary/5' : '',
            ].join(' ')}
          >
            <span className={`${isDetail ? 'text-sm' : 'text-[13px]'} font-black tabular-nums leading-none`}>
              {token.amountLabel}
            </span>
            <CoinImage
              symbol={resolveCoinImageSymbol(token.logo_symbol || token.symbol)}
              size={isDetail ? 18 : 16}
              className="rounded-full"
              alt={token.symbol}
            />
          </ChipWrapper>
        ))}
        {chipState.hiddenCount > 0 && (
          <span className="inline-flex min-h-9 items-center rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[13px] font-black text-muted-foreground">
            +{chipState.hiddenCount}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true">≈</span>
          <CoinImage symbol="USDT_LOCAL" size={14} className="rounded-full" alt="USDT" />
          <span>{formatUsd(basePriceUsd)}</span>
        </div>
        {stockLabel ? (
          <span
            className={[
              'text-xs font-medium',
              stock === 0 ? 'text-red-500' : 'text-muted-foreground',
            ].join(' ')}
          >
            {stockLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
