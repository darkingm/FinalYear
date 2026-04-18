'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Package, Save, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { productsApi } from '@/lib/api/products';
import { ProductImageEditor } from '@/components/product/editor/ProductImageEditor';
import { ProductPricingEditor } from '@/components/product/editor/ProductPricingEditor';
import { ProductTokenPricing } from '@/components/product/ProductTokenPricing';
import {
  buildPricingMetadataMap,
  promotePrimaryEditorToken,
  serializeAcceptedTokensForPayload,
  syncAcceptedTokenEditorState,
} from '@/lib/products/pricing';
import type {
  ProductAcceptedTokenView,
  ProductEditorImageDraft,
  ProductEditorSeedToken,
  ProductEditorTokenRow,
  ProductUpsertPayload,
} from '@/lib/products/types';

const CATEGORIES = [
  { value: 'electronics', label: 'Điện tử' },
  { value: 'fashion', label: 'Thời trang' },
  { value: 'home', label: 'Nhà cửa' },
  { value: 'sports', label: 'Thể thao' },
  { value: 'gaming', label: 'Gaming / NFT' },
  { value: 'collectibles', label: 'Đồ sưu tầm' },
  { value: 'books', label: 'Sách' },
  { value: 'other', label: 'Khác' },
];

interface ProductEditorFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  successMessage: string;
  backHref?: string;
  redirectTo?: string;
  defaultCategory?: string;
  defaultSelectedSymbols?: string[];
}

interface ProductEditorState {
  name: string;
  description: string;
  category: string;
  basePriceUsd: number;
  stock: number;
}

function createDraftId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function convertUsdToToken(basePriceUsd: number, usdRate: number) {
  if (!basePriceUsd || basePriceUsd <= 0 || !usdRate || usdRate <= 0) return '';
  if (usdRate === 1) return String(basePriceUsd);
  return (basePriceUsd / usdRate).toFixed(6).replace(/\.?0+$/, '');
}

async function fetchTokenRates(symbols: string[]) {
  const stablecoins = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const upper = symbol.toUpperCase();
      if (stablecoins.has(upper)) {
        return { symbol: upper, usd_rate: 1 };
      }

      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${upper}USDT`, {
        cache: 'no-store',
      });
      const payload = await response.json();
      return {
        symbol: upper,
        usd_rate: Number(payload?.price || 0),
      };
    }),
  );

  return results.reduce<Record<string, number>>((acc, result) => {
    if (result.status === 'fulfilled') {
      acc[result.value.symbol] = result.value.usd_rate;
    }
    return acc;
  }, {});
}

export function ProductEditorForm({
  title,
  subtitle,
  submitLabel,
  successMessage,
  backHref = '/products',
  redirectTo = '/products',
  defaultCategory = 'electronics',
  defaultSelectedSymbols = ['ETH', 'USDT'],
}: ProductEditorFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<ProductEditorState>({
    name: '',
    description: '',
    category: defaultCategory,
    basePriceUsd: 0,
    stock: 1,
  });
  const [images, setImages] = useState<ProductEditorImageDraft[]>([]);
  const [tokenCatalog, setTokenCatalog] = useState<ProductEditorSeedToken[]>([]);
  const [tokenRows, setTokenRows] = useState<ProductEditorTokenRow[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const response = await apiClient.get('/api/products/tokens');
        const tokens = response.data?.data ?? [];
        const rates = await fetchTokenRates(tokens.map((token: any) => token.symbol));
        if (ignore) return;

        const catalog: ProductEditorSeedToken[] = tokens.map((token: any) => ({
          token_id: token.token_id,
          symbol: String(token.symbol || '').toUpperCase(),
          name: token.name,
          usd_rate: rates[String(token.symbol || '').toUpperCase()] ?? 0,
        }));

        setTokenCatalog(catalog);
        setTokenRows(
          syncAcceptedTokenEditorState({
            basePriceUsd: form.basePriceUsd,
            catalog,
            selectedSymbols: defaultSelectedSymbols,
            currentRows: [],
          }),
        );
      } catch (error) {
        toast.error('Không tải được danh sách token');
      } finally {
        if (!ignore) {
          setLoadingCatalog(false);
        }
      }
    };

    loadCatalog();
    return () => {
      ignore = true;
    };
  }, []);

  const previewTokens = useMemo<ProductAcceptedTokenView[]>(
    () => tokenRows.map((row) => ({
      token_id: row.token_id,
      symbol: row.symbol,
      price_in_token: row.amount,
      is_primary: row.is_primary,
      logo_symbol: row.symbol,
      estimated_usdt: form.basePriceUsd ? String(form.basePriceUsd) : null,
    })),
    [form.basePriceUsd, tokenRows],
  );

  const handleToggleToken = (symbol: string) => {
    const selectedSymbols = tokenRows.map((row) => row.symbol.toUpperCase());
    const nextSymbols = selectedSymbols.includes(symbol.toUpperCase())
      ? selectedSymbols.filter((value) => value !== symbol.toUpperCase())
      : [...selectedSymbols, symbol.toUpperCase()];

    const nextRows = syncAcceptedTokenEditorState({
      basePriceUsd: form.basePriceUsd,
      catalog: tokenCatalog,
      selectedSymbols: nextSymbols,
      currentRows: tokenRows,
    });

    if (!nextRows.some((row) => row.is_primary) && nextRows[0]) {
      nextRows[0].is_primary = true;
    }

    setTokenRows(nextRows);
  };

  const handleChangeAmount = (tokenId: number, amount: string) => {
    setTokenRows((current) => current.map((row) => (
      row.token_id === tokenId ? { ...row, amount } : row
    )));
  };

  const handlePromotePrimary = (tokenId: number) => {
    setTokenRows((current) => promotePrimaryEditorToken(current, tokenId));
  };

  const handleRecalculateAll = () => {
    const selectedSymbols = tokenRows.map((row) => row.symbol);
    const primaryTokenId = tokenRows.find((row) => row.is_primary)?.token_id;
    const nextRows = syncAcceptedTokenEditorState({
      basePriceUsd: form.basePriceUsd,
      catalog: tokenCatalog,
      selectedSymbols,
      currentRows: [],
    });

    setTokenRows(primaryTokenId ? promotePrimaryEditorToken(nextRows, primaryTokenId) : nextRows);
  };

  const handleRecalculateRow = (tokenId: number) => {
    setTokenRows((current) => current.map((row) => {
      if (row.token_id !== tokenId) return row;
      return {
        ...row,
        amount: convertUsdToToken(form.basePriceUsd, row.usd_rate),
      };
    }));
  };

  const handleAddFiles = (files: File[]) => {
    const validFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 8 - images.length));
    if (validFiles.length === 0) return;

    setImages((current) => {
      const next = [
        ...current,
        ...validFiles.map((file, index) => ({
          id: createDraftId(),
          file,
          url: URL.createObjectURL(file),
          is_primary: current.length === 0 && index === 0,
          sort_order: current.length + index,
        })),
      ];

      if (!next.some((image) => image.is_primary) && next[0]) {
        next[0].is_primary = true;
      }

      return next.map((image, index) => ({ ...image, sort_order: index }));
    });
  };

  const handleRemoveImage = (imageId: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === imageId);
      if (removed?.file) {
        URL.revokeObjectURL(removed.url);
      }

      const next = current.filter((image) => image.id !== imageId)
        .map((image, index) => ({ ...image, sort_order: index }));

      if (!next.some((image) => image.is_primary) && next[0]) {
        next[0].is_primary = true;
      }

      return next;
    });
  };

  const handleMoveImage = (imageId: string, direction: 'up' | 'down') => {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === imageId);
      if (index === -1) return current;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((image, orderIndex) => ({ ...image, sort_order: orderIndex }));
    });
  };

  const handleSetPrimaryImage = (imageId: string) => {
    setImages((current) => current.map((image) => ({
      ...image,
      is_primary: image.id === imageId,
    })));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (form.name.trim().length < 3) {
      toast.error('Tên sản phẩm phải có ít nhất 3 ký tự');
      return;
    }
    if (form.description.trim().length < 10) {
      toast.error('Mô tả sản phẩm phải có ít nhất 10 ký tự');
      return;
    }
    if (!form.basePriceUsd || form.basePriceUsd <= 0) {
      toast.error('Nhập giá USD hợp lệ');
      return;
    }
    if (form.stock < 0) {
      toast.error('Số lượng tồn kho không hợp lệ');
      return;
    }
    if (images.length === 0) {
      toast.error('Cần ít nhất 1 ảnh sản phẩm');
      return;
    }

    const acceptedTokens = serializeAcceptedTokensForPayload(tokenRows);
    if (acceptedTokens.length === 0) {
      toast.error('Cần ít nhất 1 token có giá hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const uploadData = new FormData();
      images.forEach((image) => {
        if (image.file) {
          uploadData.append('images', image.file);
        }
      });

      const uploadResponse = await apiClient.post('/api/products/upload-images', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const imageUrls: string[] = uploadResponse.data?.urls || uploadResponse.data?.imageUrls || [];
      if (imageUrls.length !== images.length) {
        throw new Error('Upload ảnh chưa hoàn tất đầy đủ');
      }

      const normalizedImages = images.map((image, index) => ({
        url: imageUrls[index],
        sort_order: index,
        is_primary: image.is_primary || index === 0,
      }));

      const payload: ProductUpsertPayload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        base_price_usd: form.basePriceUsd,
        stock: form.stock,
        accepted_tokens: acceptedTokens,
        images: normalizedImages,
        metadata: {
          category: form.category,
          images: normalizedImages.map((image) => image.url),
          pricing: buildPricingMetadataMap(tokenRows),
          accepted_tokens: {
            crypto: acceptedTokens.map((token) => token.symbol),
            fiat: ['paypal'],
          },
        },
      };

      await productsApi.create(payload);
      toast.success(successMessage);
      router.push(redirectTo);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Không thể lưu sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_top_right,rgba(240,185,11,0.12),transparent_42%),radial-gradient(circle_at_top_left,rgba(24,144,255,0.10),transparent_36%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href={backHref} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary md:flex">
            <Package className="h-3.5 w-3.5" />
            Multi-token listing
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-border bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Thông tin cơ bản</h2>
                  <p className="text-sm text-muted-foreground">Tên, mô tả, danh mục và tồn kho của sản phẩm.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tên sản phẩm</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    placeholder="VD: iPhone 16 Pro Max 256GB"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mô tả</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={6}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    placeholder="Mô tả chi tiết sản phẩm, tình trạng, nguồn gốc, bảo hành..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Danh mục</label>
                    <select
                      value={form.category}
                      onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>{category.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Giá cơ sở (USDT)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.basePriceUsd || ''}
                      onChange={(event) => setForm((current) => ({ ...current, basePriceUsd: Number(event.target.value || 0) }))}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      placeholder="999.99"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tồn kho</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.stock}
                      onChange={(event) => setForm((current) => ({ ...current, stock: Number(event.target.value || 0) }))}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-border bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Pricing nhiều token</h2>
                  <p className="text-sm text-muted-foreground">Giữ giá gốc theo USDT, sau đó tự quy đổi và cho phép chỉnh tay từng token.</p>
                </div>
              </div>

              <ProductPricingEditor
                basePriceUsd={form.basePriceUsd}
                catalog={tokenCatalog}
                rows={tokenRows}
                loadingCatalog={loadingCatalog}
                onToggleToken={handleToggleToken}
                onChangeAmount={handleChangeAmount}
                onPromotePrimary={handlePromotePrimary}
                onRecalculateAll={handleRecalculateAll}
                onRecalculateRow={handleRecalculateRow}
              />
            </section>

            <section className="rounded-[2rem] border border-border bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Gallery ảnh sản phẩm</h2>
                  <p className="text-sm text-muted-foreground">Upload nhiều ảnh, sắp thứ tự và chọn ảnh chính để card/detail hiển thị đúng.</p>
                </div>
              </div>

              <ProductImageEditor
                images={images}
                onAddFiles={handleAddFiles}
                onRemove={handleRemoveImage}
                onMove={handleMoveImage}
                onSetPrimary={handleSetPrimaryImage}
              />
            </section>
          </div>

          <div className="space-y-6">
            <section className="sticky top-24 rounded-[2rem] border border-border bg-card/85 p-6 shadow-xl shadow-black/5 backdrop-blur">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0b90b]/10 text-[#f0b90b]">
                  <Save className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Preview niêm yết</h2>
                  <p className="text-sm text-muted-foreground">Đây là cách giá và gallery sẽ được chuẩn hóa khi lưu.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-[1.75rem] border border-border bg-muted">
                  <div className="aspect-[4/3] bg-muted">
                    {images[0] ? (
                      <img src={images.find((image) => image.is_primary)?.url || images[0].url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa có ảnh</div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-black text-foreground">{form.name || 'Tên sản phẩm sẽ hiện ở đây'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{form.description || 'Mô tả ngắn sản phẩm sẽ hiện ở đây.'}</p>
                </div>

                <ProductTokenPricing acceptedTokens={previewTokens} basePriceUsd={form.basePriceUsd} variant="card" />

                <div className="rounded-3xl border border-border bg-background p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Danh mục</span>
                    <span className="font-semibold text-foreground">{CATEGORIES.find((category) => category.value === form.category)?.label || form.category}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Số ảnh</span>
                    <span className="font-semibold text-foreground">{images.length}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Tồn kho</span>
                    <span className="font-semibold text-foreground">{form.stock}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f0b90b] px-4 py-3 text-sm font-black text-black shadow-lg shadow-yellow-500/20 transition hover:bg-[#e6a800] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitLabel}
                </button>
              </div>
            </section>
          </div>
        </form>
      </div>
    </div>
  );
}
