'use client';

import { useEffect } from 'react';
import { CoinImage } from '@/components/ui/CoinImage';
import { buildAcceptedTokenChipState, buildLiveUsdtEstimate, resolveMarketQuoteSymbol } from '@/lib/products/pricing';
import type { ProductAcceptedTokenView } from '@/lib/products/types';
import { usePriceStore } from '@/store';

interface ProductTokenPricingProps {
  acceptedTokens: ProductAcceptedTokenView[];
  basePriceUsd: number;
  selectedTokenId?: number | null;
  onSelect?: (token: ProductAcceptedTokenView) => void;
  variant?: 'card' | 'detail';
  stock?: number;
}

function renderStockLabel(stock?: number) {
  if (stock === undefined) return null;
  if (stock === 0) return 'Hết hàng';
  if (stock <= 5) return `Còn ${stock}`;
  return `${stock} còn lại`;
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
  const interactive = typeof onSelect === 'function';
  const isDetail = variant === 'detail';
  const stockLabel = renderStockLabel(stock);
  const ChipWrapper = interactive ? 'button' : 'div';
  const activeTextTone = isDetail ? 'text-foreground' : 'text-slate-950 dark:text-white';
  const inactiveTextTone = isDetail ? 'text-foreground/80' : 'text-slate-600 dark:text-white/72';
  const activeToken = chipState.activeToken;
  const quoteSymbol = resolveMarketQuoteSymbol(activeToken?.symbol);
  const connectPrices = usePriceStore((state) => state.connect);
  const marketQuote = usePriceStore((state) =>
    quoteSymbol && quoteSymbol !== 'USDT' ? state.displaySnapshotPrices[quoteSymbol] : undefined
  );

  useEffect(() => {
    if (!quoteSymbol || quoteSymbol === 'USDT') return;
    connectPrices([quoteSymbol]);
  }, [connectPrices, quoteSymbol]);

  const liveEstimate = buildLiveUsdtEstimate({
    tokenSymbol: activeToken?.symbol,
    tokenAmount: activeToken?.price_in_token,
    basePriceUsd,
    marketPrices: quoteSymbol && marketQuote ? { [quoteSymbol]: marketQuote } : {},
  });

  if (chipState.all.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Chưa cấu hình giá coin cho sản phẩm này
      </div>
    );
  }

  return (
    <div className={isDetail ? 'space-y-2.5' : 'space-y-1.5'}>
      {/* Token chips */}
      <div className={isDetail ? 'flex flex-wrap gap-2' : 'flex items-center gap-2'}>
        {chipState.visible.map((token) => (
          <ChipWrapper
            key={`${token.token_id}-${token.symbol}`}
            {...(interactive ? {
              type: 'button',
              onClick: () => onSelect?.(token),
              'aria-label': `Chọn ${token.symbol} ${token.amountLabel}`,
              'aria-pressed': token.isActive,
            } : {})}
            className={[
              'text-left transition-all duration-200',
              isDetail
                ? 'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2'
                : 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1',
              isDetail
                ? token.isActive
                  ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                  : 'border-border bg-card/80 text-foreground/90'
                : token.isActive
                  ? 'bg-foreground/[0.06] text-foreground'
                  : 'text-muted-foreground opacity-60',
              interactive
                ? isDetail
                  ? 'hover:border-primary/40 hover:bg-primary/5'
                  : 'hover:opacity-100 hover:bg-foreground/[0.04]'
                : '',
            ].join(' ')}
          >
            <CoinImage
              symbol={token.logo_symbol || token.symbol}
              size={isDetail ? 18 : token.isActive ? 16 : 14}
              className="rounded-full flex-shrink-0"
              alt={token.symbol}
            />
            <span
              className={[
                'font-extrabold tabular-nums leading-none tracking-tight',
                isDetail
                  ? 'text-sm'
                  : token.isActive
                    ? 'text-[1.1rem]'
                    : 'text-[0.8rem]',
              ].join(' ')}
            >
              {token.amountLabel}
            </span>
            <span className={[
              'text-[0.65rem] font-semibold uppercase tracking-wide',
              token.isActive ? 'text-muted-foreground' : 'text-muted-foreground/70',
            ].join(' ')}>
              {token.symbol}
            </span>
          </ChipWrapper>
        ))}
        {chipState.hiddenCount > 0 && (
          <span
            className={[
              'inline-flex items-center border border-border bg-muted/40 font-bold text-muted-foreground',
              isDetail ? 'min-h-9 rounded-full px-3 py-1.5 text-[13px]' : 'rounded-lg px-2 py-1 text-[11px]',
            ].join(' ')}
          >
            +{chipState.hiddenCount}
          </span>
        )}
      </div>

      {/* USDT estimate + stock */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <span className="opacity-60">≈</span>
          <span className="font-bold tabular-nums">{liveEstimate.displayAmount}</span>
          <CoinImage symbol="USDT" size={12} className="rounded-full" alt="USDT" />
        </span>
        {stockLabel ? (
          <span
            className={[
              'text-[11px] font-medium',
              stock === 0 ? 'text-red-500' : 'text-muted-foreground/70',
            ].join(' ')}
          >
            {stockLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
