'use client';

import { CoinImage } from '@/components/ui/CoinImage';
import { normalizeAcceptedTokensForDisplay } from '@/lib/products/pricing';
import type { ProductAcceptedTokenView } from '@/lib/products/types';

interface ProductTokenPricingProps {
  acceptedTokens: ProductAcceptedTokenView[];
  basePriceUsd: number;
  selectedTokenId?: number | null;
  onSelect?: (token: ProductAcceptedTokenView) => void;
  variant?: 'card' | 'detail';
}

export function ProductTokenPricing({
  acceptedTokens,
  basePriceUsd,
  selectedTokenId,
  onSelect,
  variant = 'card',
}: ProductTokenPricingProps) {
  const rows = normalizeAcceptedTokensForDisplay(acceptedTokens);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Chưa cấu hình giá coin cho sản phẩm này
      </div>
    );
  }

  const interactive = typeof onSelect === 'function';
  const isDetail = variant === 'detail';
  const usdLabel = `~ $${Number(basePriceUsd || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDT`;

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${isDetail ? 'grid-cols-1' : 'grid-cols-1'}`}>
        {rows.map((token) => {
          const active = selectedTokenId ? selectedTokenId === token.token_id : token.is_primary;
          const Wrapper = interactive ? 'button' : 'div';

          return (
            <Wrapper
              key={`${token.token_id}-${token.symbol}`}
              {...(interactive ? {
                type: 'button',
                onClick: () => onSelect?.(token),
              } : {})}
              className={[
                'flex w-full items-center justify-between rounded-2xl border text-left transition',
                isDetail ? 'px-3 py-3' : 'px-3 py-2.5',
                active ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-border bg-card/70',
                interactive ? 'hover:border-primary/40 hover:bg-primary/5' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center rounded-full bg-background/80 ring-1 ring-border/60 ${isDetail ? 'h-10 w-10' : 'h-9 w-9'}`}>
                  <CoinImage symbol={token.logo_symbol || token.symbol} size={isDetail ? 24 : 20} className="rounded-full" />
                </div>
                <div className="min-w-0">
                  <div className={`${isDetail ? 'text-sm' : 'text-[13px]'} truncate font-black text-foreground`}>{token.display_amount}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{token.symbol}</div>
                </div>
              </div>
              {token.is_primary && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Primary
                </span>
              )}
            </Wrapper>
          );
        })}
      </div>
      <p className="text-xs font-medium text-muted-foreground">{usdLabel}</p>
    </div>
  );
}
