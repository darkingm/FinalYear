'use client';

import { RefreshCw, Star } from 'lucide-react';
import { CoinImage } from '@/components/ui/CoinImage';
import type { ProductEditorSeedToken, ProductEditorTokenRow } from '@/lib/products/types';

interface ProductPricingEditorProps {
  basePriceUsd: number;
  catalog: ProductEditorSeedToken[];
  rows: ProductEditorTokenRow[];
  loadingCatalog: boolean;
  onToggleToken: (symbol: string) => void;
  onChangeAmount: (tokenId: number, amount: string) => void;
  onPromotePrimary: (tokenId: number) => void;
  onRecalculateAll: () => void;
  onRecalculateRow: (tokenId: number) => void;
}

function formatUsdRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return 'No live rate';
  if (rate === 1) return '$1.00';
  return `$${rate.toLocaleString('en-US', {
    minimumFractionDigits: rate >= 1 ? 2 : 4,
    maximumFractionDigits: rate >= 1 ? 2 : 6,
  })}`;
}

export function ProductPricingEditor({
  basePriceUsd,
  catalog,
  rows,
  loadingCatalog,
  onToggleToken,
  onChangeAmount,
  onPromotePrimary,
  onRecalculateAll,
  onRecalculateRow,
}: ProductPricingEditorProps) {
  const selectedSymbols = new Set(rows.map((row) => row.symbol.toUpperCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Token chấp nhận thanh toán</p>
          <p className="text-xs text-muted-foreground">Người bán có thể nhập từng giá token hoặc lấy từ quy đổi USD rồi chỉnh tay lại.</p>
        </div>
        <button
          type="button"
          onClick={onRecalculateAll}
          disabled={!basePriceUsd || rows.length === 0}
          className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Quy đổi lại tất cả
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {loadingCatalog ? (
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Đang tải danh sách token...
          </div>
        ) : (
          catalog.map((token) => {
            const active = selectedSymbols.has(token.symbol.toUpperCase());
            return (
              <button
                key={token.token_id}
                type="button"
                onClick={() => onToggleToken(token.symbol)}
                className={[
                  'flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition',
                  active ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-card/70 text-foreground hover:border-primary/30 hover:bg-primary/5',
                ].join(' ')}
              >
                <CoinImage symbol={token.symbol} size={20} className="rounded-full" />
                <span>{token.symbol}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{formatUsdRate(token.usd_rate)}</span>
              </button>
            );
          })
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          Chọn ít nhất một token để định giá sản phẩm.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.token_id} className="rounded-3xl border border-border bg-card/80 p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex min-w-[170px] items-center gap-3">
                  <CoinImage symbol={row.symbol} size={24} className="rounded-full" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-foreground">{row.symbol}</p>
                      {row.is_primary && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatUsdRate(row.usd_rate)} / token</p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={row.amount}
                    onChange={(event) => onChangeAmount(row.token_id, event.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    placeholder={`Nhập số lượng ${row.symbol}`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onRecalculateRow(row.token_id)}
                      disabled={!basePriceUsd}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-border px-3 py-3 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Quy đổi
                    </button>
                    <button
                      type="button"
                      onClick={() => onPromotePrimary(row.token_id)}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-border px-3 py-3 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Đặt chính
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
