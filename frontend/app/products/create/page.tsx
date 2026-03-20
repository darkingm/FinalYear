'use client';
export const dynamic = 'force-dynamic';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CoinImage } from '@/components/ui/CoinImage';
import {
  Package, Upload, X, Plus, Minus, RefreshCw, ChevronRight,
  DollarSign, Tag, Layers, ImageIcon, Coins, Loader2, CheckCircle,
  Info, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Schema ─────────────────────────────────────────────────────────────── */
const schema = z.object({
  name: z.string().min(3, 'Tên sản phẩm tối thiểu 3 ký tự'),
  description: z.string().min(10, 'Mô tả tối thiểu 10 ký tự'),
  base_price_usd: z.number({ invalid_type_error: 'Nhập giá USD hợp lệ' }).positive('Giá phải lớn hơn 0'),
  stock: z.number({ invalid_type_error: 'Nhập số lượng hợp lệ' }).int().nonnegative('Số lượng ≥ 0'),
  category: z.string().min(1, 'Chọn danh mục'),
});
type FormData = z.infer<typeof schema>;

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { value: 'electronics', label: 'Điện tử', icon: '💻' },
  { value: 'fashion', label: 'Thời trang', icon: '👗' },
  { value: 'home', label: 'Nhà & Vườn', icon: '🏡' },
  { value: 'sports', label: 'Thể thao', icon: '⚽' },
  { value: 'gaming', label: 'Gaming / NFT', icon: '🎮' },
  { value: 'collectibles', label: 'Đồ sưu tầm', icon: '🏆' },
  { value: 'other', label: 'Khác', icon: '📦' },
];

const ALL_TOKENS = [
  { symbol: 'ETH', color: '#627eea', name: 'Ethereum' },
  { symbol: 'MATIC', color: '#8247e5', name: 'Polygon' },
  { symbol: 'BNB', color: '#f0b90b', name: 'BNB Chain' },
  { symbol: 'USDT', color: '#26a17b', name: 'Tether' },
  { symbol: 'USDC', color: '#2775ca', name: 'USD Coin' },
  { symbol: 'ARB', color: '#12aaff', name: 'Arbitrum' },
];

/* ─── Sub-components ────────────────────────────────────────────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><Info className="w-3 h-3" />{msg}</p>;
}

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4.5 h-4.5 text-[#f0b90b]" />
      </div>
      <div>
        <h2 className="font-bold text-sm text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function CreateProductPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<string[]>(['ETH', 'MATIC']);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [converting, setConverting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { stock: 1 },
  });
  const basePrice = watch('base_price_usd');

  /* ── Image handling ─────────────────────────────────────────────────── */
  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, 5 - images.length);
    if (!valid.length) return;
    setImages(p => [...p, ...valid]);
    valid.forEach(f => {
      const r = new FileReader();
      r.onloadend = () => setPreviews(p => [...p, r.result as string]);
      r.readAsDataURL(f);
    });
  }, [images.length]);

  const removeImage = (i: number) => {
    setImages(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  /* ── Token management ───────────────────────────────────────────────── */
  const toggleToken = (sym: string) => {
    setSelectedTokens(prev => {
      const next = prev.includes(sym) ? prev.filter(t => t !== sym) : [...prev, sym];
      if (!next.includes(sym)) setTokenPrices(p => { const c = { ...p }; delete c[sym]; return c; });
      return next;
    });
  };

  const autoConvert = async (sym: string) => {
    if (!basePrice || basePrice <= 0) { toast.error('Nhập giá USD trước'); return; }
    setConverting(sym);
    try {
      if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(sym)) {
        setTokenPrices(p => ({ ...p, [sym]: String(basePrice) }));
      } else {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`);
        const { price } = await res.json();
        const amt = (basePrice / parseFloat(price)).toFixed(6);
        setTokenPrices(p => ({ ...p, [sym]: amt }));
        toast.success(`${amt} ${sym} ≈ $${basePrice}`);
      }
    } catch { toast.error(`Lỗi quy đổi ${sym}`); }
    finally { setConverting(null); }
  };

  /* ── Submit ─────────────────────────────────────────────────────────── */
  const onSubmit = async (data: FormData) => {
    if (images.length === 0) { toast.error('Cần ít nhất 1 ảnh sản phẩm'); return; }
    const missingPrices = selectedTokens.filter(t => !tokenPrices[t] || isNaN(Number(tokenPrices[t])));
    if (missingPrices.length > 0) { toast.error(`Chưa nhập giá cho: ${missingPrices.join(', ')}`); return; }

    setSubmitting(true);
    try {
      // 1. Upload images
      const fd = new FormData();
      images.forEach(img => fd.append('images', img));
      let imageUrls: string[] = [];
      try {
        const imgRes = await apiClient.post('/api/products/upload-images', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrls = imgRes.data?.urls || imgRes.data?.imageUrls || [];
      } catch {
        // Images optional if upload endpoint not available; proceed with empty
        toast.info('Ảnh chưa upload được — sẽ dùng ảnh placeholder');
      }

      // 2. Build pricing map: { ETH: 0.05, MATIC: 20, ... }
      const pricing: Record<string, number> = {};
      selectedTokens.forEach(sym => { pricing[sym] = Number(tokenPrices[sym]); });

      // 3. Create product (metadata.pricing is the canonical field used by payment-service)
      await apiClient.post('/api/products', {
        name: data.name,
        description: data.description,
        base_price_usd: data.base_price_usd,
        stock: data.stock,
        category: data.category,
        metadata: {
          pricing,               // ← used by payment-service & ProductCard
          images: imageUrls,
          accepted_tokens: selectedTokens,
        },
      });

      setDone(true);
      toast.success('Đăng sản phẩm thành công! 🎉');
      setTimeout(() => router.push('/products'), 1800);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Đăng sản phẩm thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Success screen ─────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black">Đăng sản phẩm thành công!</h2>
            <p className="text-muted-foreground text-sm">Đang chuyển về trang sản phẩm...</p>
            <Loader2 className="w-5 h-5 animate-spin text-[#f0b90b] mx-auto" />
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  /* ─── Main render ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Ambient glow */}
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#f0b90b]/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[35%] h-[35%] bg-purple-500/5 blur-[80px] rounded-full pointer-events-none" />

      <Header />

      <main className="flex-1 py-8 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/products">
              <button className="p-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-black">Đăng sản phẩm mới</h1>
              <p className="text-sm text-muted-foreground">Điền thông tin và cài giá coin để bắt đầu bán</p>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#f0b90b]/10 border border-[#f0b90b]/20 rounded-full">
              <Package className="w-3.5 h-3.5 text-[#f0b90b]" />
              <span className="text-xs font-bold text-[#f0b90b]">Crypto-native</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

              {/* ─── LEFT COLUMN ─── */}
              <div className="space-y-5">

                {/* Basic Info */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <SectionTitle icon={Tag} title="Thông tin cơ bản" sub="Tên, mô tả và danh mục sản phẩm" />

                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Tên sản phẩm <span className="text-red-400">*</span>
                      </label>
                      <input
                        {...register('name')}
                        placeholder="VD: iPhone 15 Pro Max 256GB"
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#f0b90b]/50 focus:ring-2 focus:ring-[#f0b90b]/10 transition-all placeholder:text-muted-foreground/50"
                      />
                      <FieldError msg={errors.name?.message} />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Mô tả <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        {...register('description')}
                        rows={5}
                        placeholder="Mô tả chi tiết sản phẩm, tình trạng, bảo hành..."
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#f0b90b]/50 focus:ring-2 focus:ring-[#f0b90b]/10 transition-all placeholder:text-muted-foreground/50 resize-none"
                      />
                      <FieldError msg={errors.description?.message} />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Danh mục <span className="text-red-400">*</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {CATEGORIES.map(cat => {
                          const selected = watch('category') === cat.value;
                          return (
                            <label
                              key={cat.value}
                              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${selected
                                ? 'border-[#f0b90b]/60 bg-[#f0b90b]/8'
                                : 'border-border hover:border-[#f0b90b]/30 hover:bg-muted/40'
                                }`}
                            >
                              <input type="radio" value={cat.value} {...register('category')} className="sr-only" />
                              <span className="text-lg">{cat.icon}</span>
                              <span className="text-xs font-semibold">{cat.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <FieldError msg={errors.category?.message} />
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <SectionTitle icon={DollarSign} title="Định giá" sub="Giá USD cơ sở + giá từng loại coin" />

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Giá USD <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">$</span>
                        <input
                          type="number" step="0.01" min="0"
                          {...register('base_price_usd', { valueAsNumber: true })}
                          placeholder="999.99"
                          className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-3 text-sm outline-none focus:border-[#f0b90b]/50 focus:ring-2 focus:ring-[#f0b90b]/10 transition-all"
                        />
                      </div>
                      <FieldError msg={errors.base_price_usd?.message} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Số lượng tồn kho <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number" min="0"
                        {...register('stock', { valueAsNumber: true })}
                        placeholder="10"
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#f0b90b]/50 focus:ring-2 focus:ring-[#f0b90b]/10 transition-all"
                      />
                      <FieldError msg={errors.stock?.message} />
                    </div>
                  </div>

                  {/* Token selector */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Chấp nhận thanh toán bằng coin nào?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_TOKENS.map(t => {
                        const sel = selectedTokens.includes(t.symbol);
                        return (
                          <button
                            key={t.symbol} type="button"
                            onClick={() => toggleToken(t.symbol)}
                            style={sel ? { borderColor: `${t.color}60`, background: `${t.color}12` } : {}}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all ${sel ? '' : 'border-border hover:border-border/80 bg-transparent'}`}
                          >
                            <CoinImage symbol={t.symbol} size={20} className="flex-shrink-0" />
                            <span style={sel ? { color: t.color } : {}}>{t.symbol}</span>
                            {sel
                              ? <Minus className="w-3 h-3 opacity-50" />
                              : <Plus className="w-3 h-3 opacity-40" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-token price inputs */}
                  <AnimatePresence>
                    {selectedTokens.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Giá theo coin</p>
                            <p className="text-[10px] text-muted-foreground">Bấm ≈ để tự tính từ Binance</p>
                          </div>
                          {selectedTokens.map(sym => {
                            const token = ALL_TOKENS.find(t => t.symbol === sym)!;
                            return (
                              <div key={sym} className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-24 flex-shrink-0">
                                  <CoinImage symbol={sym} size={20} className="flex-shrink-0" />
                                  <span className="text-sm font-bold" style={{ color: token?.color }}>{sym}</span>
                                </div>
                                <input
                                  type="number" step="any" min="0"
                                  placeholder={`VD: ${sym === 'USDT' ? '999' : sym === 'ETH' ? '0.05' : '20'}`}
                                  value={tokenPrices[sym] ?? ''}
                                  onChange={e => setTokenPrices(p => ({ ...p, [sym]: e.target.value }))}
                                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f0b90b]/50 transition-all"
                                />
                                <button
                                  type="button" onClick={() => autoConvert(sym)}
                                  disabled={converting === sym}
                                  className="px-3 py-2.5 bg-[#f0b90b] text-black font-black rounded-xl text-xs hover:bg-[#e6a800] transition-colors disabled:opacity-60 flex items-center gap-1 whitespace-nowrap"
                                  title="Tự tính từ giá USD via Binance"
                                >
                                  {converting === sym
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <><RefreshCw className="w-3 h-3" /> ≈</>}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              {/* ─── RIGHT COLUMN ─── */}
              <div className="space-y-5">

                {/* Image Upload */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <SectionTitle icon={ImageIcon} title="Ảnh sản phẩm" sub="Tối đa 5 ảnh, kéo thả hoặc click" />

                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragging
                      ? 'border-[#f0b90b] bg-[#f0b90b]/8'
                      : 'border-border hover:border-[#f0b90b]/40 hover:bg-muted/30'
                      }`}
                  >
                    <input
                      ref={fileRef} type="file" accept="image/*" multiple className="sr-only"
                      onChange={e => addFiles(Array.from(e.target.files || []))}
                    />
                    <Upload className={`w-8 h-8 mx-auto mb-2 transition-colors ${dragging ? 'text-[#f0b90b]' : 'text-muted-foreground'}`} />
                    <p className="text-xs font-semibold text-muted-foreground">
                      {dragging ? 'Thả ảnh vào đây' : 'Kéo thả hoặc click để tải ảnh'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG, WEBP · Tối đa 5MB/ảnh</p>
                  </div>

                  {/* Previews */}
                  {previews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {previews.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button" onClick={() => removeImage(i)}
                            className="absolute inset-0 bg-black/50 text-white hidden group-hover:flex items-center justify-center rounded-xl"
                          >
                            <X className="w-5 h-5" />
                          </button>
                          {i === 0 && (
                            <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#f0b90b] text-black px-1.5 py-0.5 rounded-full">
                              MAIN
                            </span>
                          )}
                        </div>
                      ))}
                      {previews.length < 5 && (
                        <button type="button" onClick={() => fileRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-[#f0b90b]/40 flex items-center justify-center text-muted-foreground hover:text-[#f0b90b] transition-all">
                          <Plus className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Summary & Submit */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4 sticky top-24">
                  <SectionTitle icon={Coins} title="Tóm tắt" />

                  <div className="space-y-2 text-sm">
                    {selectedTokens.length > 0 ? (
                      selectedTokens.map(sym => (
                        <div key={sym} className="flex items-center justify-between p-2.5 bg-background rounded-xl border border-border">
                          <div className="flex items-center gap-2">
                            <CoinImage symbol={sym} size={16} className="flex-shrink-0" />
                            <span className="font-semibold">{sym}</span>
                          </div>
                          <span className="font-mono font-bold text-[#f0b90b]">
                            {tokenPrices[sym] ? `${tokenPrices[sym]} ${sym}` : <span className="text-muted-foreground text-xs">chưa nhập</span>}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">Chọn ít nhất 1 token ở trên</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ảnh đã chọn</span>
                    <span className="font-bold">{images.length}/5</span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-[#f0b90b] text-black font-black rounded-xl text-base hover:bg-[#e6a800] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#f0b90b]/20"
                  >
                    {submitting
                      ? <><Loader2 className="w-5 h-5 animate-spin" />Đang đăng...</>
                      : <><Package className="w-5 h-5" />Đăng sản phẩm<ChevronRight className="w-4 h-4" /></>}
                  </button>

                  <p className="text-[10px] text-muted-foreground text-center">
                    Bằng cách đăng sản phẩm, bạn đồng ý với điều khoản của nền tảng
                  </p>
                </div>

              </div>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
