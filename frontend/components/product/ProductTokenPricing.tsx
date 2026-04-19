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
    <div className="space-y-2.5">
      <div className={isDetail ? 'flex flex-wrap gap-2' : 'flex flex-wrap items-end gap-x-3 gap-y-2'}>
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
              'text-left transition',
              isDetail
                ? 'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2'
                : 'inline-flex flex-col items-start rounded-xl px-1 py-0.5',
              isDetail
                ? token.isActive
                  ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                  : 'border-border bg-card/80 text-foreground/90'
                : token.isActive
                  ? `${activeTextTone}`
                  : `${inactiveTextTone}`,
              interactive
                ? isDetail
                  ? 'hover:border-primary/40 hover:bg-primary/5'
                  : 'hover:bg-white/5'
                : '',
            ].join(' ')}
          >
            <span className={isDetail ? 'inline-flex items-center gap-2' : 'inline-flex items-center gap-1.5'}>
              <span
                className={[
                  'font-black tabular-nums leading-none',
                  isDetail
                    ? 'text-sm'
                    : token.isActive
                      ? 'text-[1.6rem] tracking-[-0.03em]'
                      : 'text-[0.95rem]',
                ].join(' ')}
              >
                {token.amountLabel}
              </span>
              <CoinImage
                symbol={token.logo_symbol || token.symbol}
                size={isDetail ? 18 : token.isActive ? 17 : 15}
                className="rounded-full"
                alt={token.symbol}
              />
            </span>
            {!isDetail ? (
              <span
                className={[
                  'mt-1 h-px rounded-full transition-all',
                  token.isActive ? 'w-full bg-[#f0b90b]/70' : 'w-0 bg-transparent',
                ].join(' ')}
              />
            ) : null}
          </ChipWrapper>
        ))}
        {chipState.hiddenCount > 0 && (
          <span
            className={[
              'inline-flex items-center border border-border bg-muted/40 font-black text-muted-foreground',
              isDetail ? 'min-h-9 rounded-full px-3 py-1.5 text-[13px]' : 'min-h-8 rounded-full px-2.5 py-1 text-xs',
            ].join(' ')}
          >
            +{chipState.hiddenCount}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true">≈</span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-background/75 px-3.5 py-1.5 text-[14px] font-black text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
              <span>{liveEstimate.displayAmount}</span>
              <CoinImage symbol="USDT" size={14} className="rounded-full" alt="USDT" />
            </span>
          </div>
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
