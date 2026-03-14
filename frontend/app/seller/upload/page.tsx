'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, X, Plus, Image as ImageIcon, Package, DollarSign,
    Tag, ChevronDown, Check, Loader2, Store, AlertCircle,
    Sparkles, ArrowLeft, Info, Coins, TrendingUp, ShoppingBag,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import Image from 'next/image';

const CATEGORIES = [
    { value: 'electronics', label: '📱 Điện tử', icon: '📱' },
    { value: 'fashion', label: '👗 Thời trang', icon: '👗' },
    { value: 'home', label: '🏠 Nhà cửa & Vườn', icon: '🏠' },
    { value: 'sports', label: '⚽ Thể thao', icon: '⚽' },
    { value: 'books', label: '📚 Sách', icon: '📚' },
    { value: 'toys', label: '🧸 Đồ chơi', icon: '🧸' },
    { value: 'beauty', label: '💄 Làm đẹp', icon: '💄' },
    { value: 'food', label: '🍜 Thực phẩm', icon: '🍜' },
    { value: 'other', label: '📦 Khác', icon: '📦' },
];

// Map token symbol to CoinGecko ID for price fetching
const COINGECKO_IDS: Record<string, string> = {
    ETH: 'ethereum',
    WETH: 'weth',
    BTC: 'bitcoin',
    USDT: 'tether',
    USDC: 'usd-coin',
    DAI: 'dai',
    MATIC: 'matic-network',
    POL: 'matic-network',
    BNB: 'binancecoin',
};

interface ImagePreview { file: File; url: string; }
interface DbToken { token_id: number; symbol: string; name?: string; }

const inputClass = "w-full px-4 py-3 bg-[#13151f] border border-white/10 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#f0b90b]/60 focus:ring-2 focus:ring-[#f0b90b]/10 transition-all text-sm";
const labelClass = "block text-sm font-semibold text-gray-300 mb-2";

export default function SellerUploadPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragRef = useRef<HTMLDivElement>(null);

    const [images, setImages] = useState<ImagePreview[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [dbTokens, setDbTokens] = useState<DbToken[]>([]);
    const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
    const [loadingPrices, setLoadingPrices] = useState(false);

    const [form, setForm] = useState({
        name: '',
        description: '',
        price_usd: '',
        pricing_mode: 'usd' as 'usd' | 'crypto' | 'both',
        price_token: '',
        token_id: '',
        quantity: '1',
        category: 'electronics',
        sku: '',
    });

    // Fetch tokens from DB
    useEffect(() => {
        apiClient.get('/api/products/tokens')
            .then(res => {
                if (res.data?.data) {
                    setDbTokens(res.data.data);
                    if (res.data.data.length > 0) {
                        setForm(prev => ({ ...prev, token_id: String(res.data.data[0].token_id) }));
                    }
                    // Fetch prices for all tokens
                    fetchTokenPrices(res.data.data);
                }
            })
            .catch(console.error);
    }, []);

    // Fetch prices from CoinGecko (or Binance as fallback)
    const fetchTokenPrices = async (tokens: DbToken[]) => {
        setLoadingPrices(true);
        const prices: Record<string, number> = {};
        try {
            const symbols = tokens.map(t => t.symbol.toUpperCase());
            // Use Binance API for price (fast, no key needed)
            const pricePromises = symbols.map(async (symbol) => {
                if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI') {
                    prices[symbol] = 1;
                    return;
                }
                const pair = `${symbol}USDT`;
                try {
                    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, { cache: 'no-store' });
                    if (res.ok) {
                        const data = await res.json();
                        prices[symbol] = parseFloat(data.price);
                    }
                } catch {
                    // fallback: try WETH -> ETH mapping
                    if (symbol === 'WETH') {
                        try {
                            const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
                            if (r.ok) { const d = await r.json(); prices[symbol] = parseFloat(d.price); }
                        } catch { }
                    }
                }
            });
            await Promise.allSettled(pricePromises);
        } catch { }
        setTokenPrices(prices);
        setLoadingPrices(false);
    };

    /* ─── Image Handling ─────────────────── */
    const addImages = useCallback((files: FileList | File[]) => {
        const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (images.length + arr.length > 8) { toast.error('Tối đa 8 ảnh'); return; }
        const previews: ImagePreview[] = arr.map(file => ({ file, url: URL.createObjectURL(file) }));
        setImages(prev => [...prev, ...previews]);
    }, [images]);

    const removeImage = (idx: number) => {
        setImages(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx); });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDragActive(false);
        if (e.dataTransfer.files.length) addImages(e.dataTransfer.files);
    };

    /* ─── Submit ─────────────────────────── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Nhập tên sản phẩm'); return; }
        if (form.pricing_mode !== 'crypto') {
            if (!form.price_usd || isNaN(Number(form.price_usd)) || Number(form.price_usd) <= 0) {
                toast.error('Nhập giá USD hợp lệ'); return;
            }
        }
        if (form.pricing_mode !== 'usd') {
            if (!form.price_token || isNaN(Number(form.price_token)) || Number(form.price_token) <= 0) {
                toast.error('Nhập giá Crypto hợp lệ'); return;
            }
            if (!form.token_id) { toast.error('Vui lòng chọn token'); return; }
        }
        if (images.length === 0) { toast.error('Thêm ít nhất 1 ảnh sản phẩm'); return; }

        setSubmitting(true);
        try {
            // Step 1: Upload images first
            const imgFd = new FormData();
            images.forEach(img => imgFd.append('images', img.file));
            const imgRes = await apiClient.post('/api/products/upload-images', imgFd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const imageUrls: string[] = imgRes.data?.urls || [];

            // Step 2: Create product with JSON body
            const payload: any = {
                name: form.name.trim(),
                description: form.description.trim() || form.name,
                category: form.category,
                stock: parseInt(form.quantity) || 1,
                metadata: {
                    images: imageUrls,
                    category: form.category,
                    sku: form.sku || undefined,
                    pricing_mode: form.pricing_mode,
                },
            };

            if (form.pricing_mode !== 'crypto') {
                payload.price = parseFloat(form.price_usd);
                payload.base_price_usd = parseFloat(form.price_usd);
            } else {
                payload.price = 0;
                payload.base_price_usd = 0;
            }

            if (form.pricing_mode !== 'usd') {
                payload.token_id = parseInt(form.token_id);
                payload.price_in_token = parseFloat(form.price_token);
            }

            await apiClient.post('/api/products', payload);

            toast.success('🎉 Sản phẩm đã được đăng thành công!');
            router.push('/products');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Đăng sản phẩm thất bại';
            toast.error(msg);
            console.error('Create product error:', err.response?.data);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedToken = dbTokens.find(t => String(t.token_id) === form.token_id);
    const selectedTokenPrice = selectedToken ? tokenPrices[selectedToken.symbol] : undefined;
    const selectedCategory = CATEGORIES.find(c => c.value === form.category);

    // Compute estimated USD from crypto
    const estimatedUsd = form.price_token && selectedTokenPrice
        ? (parseFloat(form.price_token) * selectedTokenPrice).toFixed(2)
        : null;

    return (
        <div className="min-h-screen bg-[#0a0c14] flex flex-col">
            <Header />

            {/* Hero Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#f0b90b]/10 via-[#1a1d2e] to-purple-900/20 border-b border-white/5">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                <div className="absolute top-0 left-1/4 w-96 h-32 bg-[#f0b90b]/5 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto px-4 py-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f0b90b]/30 to-[#f0b90b]/10 border border-[#f0b90b]/30 flex items-center justify-center shadow-lg shadow-[#f0b90b]/10">
                                <Store className="w-6 h-6 text-[#f0b90b]" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                    Đăng sản phẩm mới
                                    <Sparkles className="w-4 h-4 text-[#f0b90b]" />
                                </h1>
                                <p className="text-gray-500 text-xs">Điền đầy đủ thông tin để tiếp cận nhiều khách hàng hơn</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* ── LEFT COLUMN ── */}
                            <div className="lg:col-span-1 space-y-5">

                                {/* Image Upload Card */}
                                <div className="bg-[#13151f] border border-white/8 rounded-2xl p-5 shadow-xl">
                                    <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-[#f0b90b]" />
                                        Ảnh sản phẩm
                                        <span className="ml-auto text-gray-600 font-normal text-xs">{images.length}/8</span>
                                    </h2>

                                    <div
                                        ref={dragRef}
                                        onDragEnter={() => setDragActive(true)}
                                        onDragLeave={() => setDragActive(false)}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 group ${dragActive
                                            ? 'border-[#f0b90b] bg-[#f0b90b]/8 scale-[1.02]'
                                            : 'border-white/10 hover:border-[#f0b90b]/50 hover:bg-[#f0b90b]/3'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${dragActive ? 'bg-[#f0b90b]/20' : 'bg-white/5 group-hover:bg-[#f0b90b]/10'}`}>
                                                <Upload className={`w-5 h-5 transition-colors ${dragActive ? 'text-[#f0b90b]' : 'text-gray-600 group-hover:text-[#f0b90b]'}`} />
                                            </div>
                                            <p className="text-sm text-gray-400 font-medium group-hover:text-gray-300 transition-colors">
                                                {dragActive ? 'Thả ảnh vào đây' : 'Kéo thả hoặc click để chọn'}
                                            </p>
                                            <p className="text-xs text-gray-600">PNG, JPG, WEBP • Tối đa 8 ảnh</p>
                                        </div>
                                        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                                            onChange={e => e.target.files && addImages(e.target.files)} />
                                    </div>

                                    <AnimatePresence>
                                        {images.length > 0 && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-3 gap-2 mt-3 overflow-hidden">
                                                {images.map((img, idx) => (
                                                    <motion.div key={img.url} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                                        className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                                        <Image src={img.url} alt="" fill className="object-cover" />
                                                        {idx === 0 && (
                                                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#f0b90b] text-black text-[9px] font-bold rounded-md shadow">
                                                                CHÍNH
                                                            </div>
                                                        )}
                                                        <button type="button" onClick={() => removeImage(idx)}
                                                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow">
                                                            <X className="w-3 h-3 text-white" />
                                                        </button>
                                                    </motion.div>
                                                ))}
                                                {images.length < 8 && (
                                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                                        className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-[#f0b90b]/50 hover:bg-[#f0b90b]/5 flex items-center justify-center text-gray-600 hover:text-[#f0b90b] transition-all">
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Payment Mode Card */}
                                <div className="bg-[#13151f] border border-white/8 rounded-2xl p-5 shadow-xl">
                                    <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-[#f0b90b]" />
                                        Hình thức thanh toán
                                    </h2>
                                    <div className="flex flex-col gap-2">
                                        {([
                                            { value: 'usd', label: '💵 Chỉ bán bằng USD', desc: 'PayPal, thẻ tín dụng' },
                                            { value: 'crypto', label: '🪙 Chỉ bán bằng Crypto', desc: 'ETH, USDT, ...' },
                                            { value: 'both', label: '✨ Cả hai hình thức', desc: 'USD + Crypto' },
                                        ] as const).map(mode => (
                                            <button key={mode.value} type="button"
                                                onClick={() => setForm(f => ({ ...f, pricing_mode: mode.value }))}
                                                className={`px-4 py-3 rounded-xl text-sm border transition-all text-left ${form.pricing_mode === mode.value
                                                    ? 'bg-[#f0b90b]/15 border-[#f0b90b]/50 text-[#f0b90b] shadow-lg shadow-[#f0b90b]/5'
                                                    : 'bg-white/3 border-white/8 text-gray-400 hover:border-white/20 hover:text-gray-300 hover:bg-white/5'
                                                    }`}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-semibold">{mode.label}</p>
                                                        <p className="text-xs opacity-60 mt-0.5">{mode.desc}</p>
                                                    </div>
                                                    {form.pricing_mode === mode.value && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tips */}
                                <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4">
                                    <div className="flex gap-2">
                                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p className="text-blue-400 font-semibold mb-1">Mẹo đăng bài hiệu quả</p>
                                            <p>• Ảnh rõ nét, nhiều góc độ sẽ tăng 80% tỷ lệ bán</p>
                                            <p>• Mô tả chi tiết giúp người mua tin tưởng hơn</p>
                                            <p>• Chấp nhận Crypto giúp tiếp cận thị trường quốc tế</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── RIGHT COLUMN ── */}
                            <div className="lg:col-span-2 space-y-5">

                                {/* Basic Info Card */}
                                <div className="bg-[#13151f] border border-white/8 rounded-2xl p-6 shadow-xl space-y-5">
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Package className="w-4 h-4 text-[#f0b90b]" />
                                        Thông tin sản phẩm
                                    </h2>

                                    {/* Name */}
                                    <div>
                                        <label className={labelClass}>Tên sản phẩm <span className="text-red-400">*</span></label>
                                        <input value={form.name}
                                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="VD: iPhone 16 Pro Max 256GB Natural Titanium"
                                            className={inputClass} maxLength={200} />
                                        <p className="text-xs text-gray-600 mt-1">{form.name.length}/200 ký tự</p>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className={labelClass}>Mô tả sản phẩm</label>
                                        <textarea value={form.description}
                                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                            placeholder="Mô tả tình trạng, thông số kỹ thuật, xuất xứ, bảo hành..."
                                            rows={4} className={`${inputClass} resize-none`} />
                                    </div>

                                    {/* Category + SKU */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative">
                                            <label className={labelClass}>
                                                <Tag className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                                                Danh mục <span className="text-red-400">*</span>
                                            </label>
                                            <button type="button" onClick={() => setCategoryOpen(!categoryOpen)}
                                                className={`${inputClass} flex items-center justify-between`}>
                                                <span>{selectedCategory?.label || 'Chọn danh mục'}</span>
                                                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${categoryOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {categoryOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setCategoryOpen(false)} />
                                                    <div className="absolute z-40 w-full mt-1 bg-[#1a1d2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                                                        {CATEGORIES.map(cat => (
                                                            <button key={cat.value} type="button"
                                                                onClick={() => { setForm(f => ({ ...f, category: cat.value })); setCategoryOpen(false); }}
                                                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${form.category === cat.value
                                                                    ? 'text-[#f0b90b] bg-[#f0b90b]/10'
                                                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                                                                {form.category === cat.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                                                                {cat.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div>
                                            <label className={labelClass}>SKU (tùy chọn)</label>
                                            <input value={form.sku}
                                                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                                                placeholder="VD: IP16-256-NAT" className={inputClass} />
                                        </div>
                                    </div>
                                </div>

                                {/* Pricing Card */}
                                <div className="bg-[#13151f] border border-white/8 rounded-2xl p-6 shadow-xl space-y-5">
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-[#f0b90b]" />
                                        Giá bán & Số lượng
                                    </h2>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* USD Price */}
                                        {form.pricing_mode !== 'crypto' && (
                                            <div>
                                                <label className={labelClass}>Giá bán (USD) <span className="text-red-400">*</span></label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                                                    <input type="number" value={form.price_usd}
                                                        onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))}
                                                        placeholder="0.00" min="0" step="0.01"
                                                        className={`${inputClass} pl-10`} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Quantity */}
                                        <div>
                                            <label className={labelClass}>Số lượng <span className="text-red-400">*</span></label>
                                            <input type="number" value={form.quantity}
                                                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                                min="1" className={inputClass} />
                                        </div>
                                    </div>

                                    {/* Crypto Pricing */}
                                    {form.pricing_mode !== 'usd' && (
                                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                            className="p-5 bg-gradient-to-br from-[#f0b90b]/5 to-purple-900/5 rounded-xl border border-[#f0b90b]/15 space-y-4">
                                            <h3 className="text-xs font-bold text-[#f0b90b] flex items-center gap-2">
                                                <Coins className="w-3.5 h-3.5" /> Thiết lập giá Crypto
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={labelClass}>Giá Crypto <span className="text-red-400">*</span></label>
                                                    <input type="number" value={form.price_token}
                                                        onChange={e => setForm(f => ({ ...f, price_token: e.target.value }))}
                                                        placeholder="0.00" min="0" step="0.000001"
                                                        className={inputClass} />
                                                    {estimatedUsd && (
                                                        <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                                                            <TrendingUp className="w-3 h-3" />
                                                            ≈ ${estimatedUsd} USD
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Chọn đồng coin <span className="text-red-400">*</span></label>
                                                    <div className="relative">
                                                        <select value={form.token_id}
                                                            onChange={e => setForm(f => ({ ...f, token_id: e.target.value }))}
                                                            className={`${inputClass} appearance-none cursor-pointer pr-8`}>
                                                            {dbTokens.map(t => {
                                                                const price = tokenPrices[t.symbol];
                                                                const priceStr = price
                                                                    ? price >= 1 ? `$${price.toLocaleString('en', { maximumFractionDigits: 2 })}` : `$${price.toFixed(6)}`
                                                                    : '';
                                                                return (
                                                                    <option key={t.token_id} value={t.token_id} className="bg-[#13151f] text-white">
                                                                        {t.symbol}{priceStr ? ` — ${priceStr}` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Token Price Grid */}
                                            <div>
                                                <p className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3" /> Giá thị trường so với USDT
                                                    {loadingPrices && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {dbTokens.map(t => {
                                                        const price = tokenPrices[t.symbol];
                                                        const isSelected = String(t.token_id) === form.token_id;
                                                        return (
                                                            <button key={t.token_id} type="button"
                                                                onClick={() => setForm(f => ({ ...f, token_id: String(t.token_id) }))}
                                                                className={`p-2.5 rounded-xl border text-left transition-all ${isSelected
                                                                    ? 'border-[#f0b90b]/60 bg-[#f0b90b]/10'
                                                                    : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
                                                                    }`}>
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <img
                                                                        src={`https://cryptologos.cc/logos/${t.symbol.toLowerCase() === 'usdc' ? 'usd-coin' : t.symbol.toLowerCase() === 'matic' ? 'polygon' : t.symbol.toLowerCase()}-${t.symbol.toLowerCase()}-logo.png`}
                                                                        alt={t.symbol}
                                                                        className="w-4 h-4 rounded-full"
                                                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                    />
                                                                    <span className={`text-xs font-bold ${isSelected ? 'text-[#f0b90b]' : 'text-gray-300'}`}>{t.symbol}</span>
                                                                    {isSelected && <Check className="w-3 h-3 text-[#f0b90b] ml-auto" />}
                                                                </div>
                                                                <p className="text-xs font-semibold text-white">
                                                                    {price != null
                                                                        ? (price >= 1
                                                                            ? `$${price.toLocaleString('en', { maximumFractionDigits: 2 })}`
                                                                            : `$${price.toFixed(4)}`)
                                                                        : <span className="text-gray-600 font-normal">—</span>
                                                                    }
                                                                </p>
                                                                <p className="text-[10px] text-gray-600">/ USDT</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Live Preview */}
                                <AnimatePresence>
                                    {(form.name || form.price_usd || form.price_token) && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                            className="bg-gradient-to-br from-[#f0b90b]/8 to-purple-900/8 border border-[#f0b90b]/20 rounded-2xl p-5">
                                            <h3 className="text-xs font-bold text-[#f0b90b] mb-4 flex items-center gap-2">
                                                <ShoppingBag className="w-3.5 h-3.5" /> Xem trước bài đăng
                                            </h3>
                                            <div className="flex gap-4">
                                                {images.length > 0 ? (
                                                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                                        <Image src={images[0].url} alt="" width={64} height={64} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                        <ImageIcon className="w-5 h-5 text-gray-600" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-white text-sm truncate">{form.name || 'Tên sản phẩm...'}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{selectedCategory?.label} • SL: {form.quantity}</p>
                                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                        {form.pricing_mode !== 'crypto' && form.price_usd && (
                                                            <span className="text-sm font-bold text-green-400">${parseFloat(form.price_usd).toLocaleString()} USD</span>
                                                        )}
                                                        {form.pricing_mode !== 'usd' && form.price_token && selectedToken && (
                                                            <span className="text-sm font-bold text-[#f0b90b]">
                                                                {parseFloat(form.price_token).toLocaleString()} {selectedToken.symbol}
                                                                {estimatedUsd && <span className="text-xs text-gray-500 font-normal ml-1">≈${estimatedUsd}</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* ── SUBMIT BUTTON ── */}
                                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                    <button type="submit" disabled={submitting}
                                        className="w-full relative overflow-hidden rounded-2xl py-5 px-8 font-bold text-lg text-black transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
                                        style={{ background: 'linear-gradient(135deg, #f0b90b 0%, #ffd45e 50%, #e6a800 100%)' }}>
                                        {/* Shine effect */}
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)', backgroundSize: '200% 100%' }} />

                                        <div className="relative flex items-center justify-center gap-3">
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Đang đăng sản phẩm...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Store className="w-5 h-5" />
                                                    <span>🚀 Đăng sản phẩm ngay</span>
                                                    <Sparkles className="w-4 h-4" />
                                                </>
                                            )}
                                        </div>
                                        {!submitting && (
                                            <p className="text-xs text-black/60 text-center mt-1 relative">
                                                Sản phẩm sẽ hiển thị ngay sau khi đăng
                                            </p>
                                        )}
                                    </button>
                                </motion.div>

                                {/* Cancel */}
                                <button type="button" onClick={() => router.back()}
                                    className="w-full py-3 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:border-white/20 text-sm transition-all hover:bg-white/3">
                                    ← Hủy và quay lại
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </main>
            <Footer />
        </div>
    );
}
