'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, X, Plus, Image as ImageIcon, Package, DollarSign,
    Tag, FileText, ChevronDown, Check, Loader2, Store, AlertCircle, Trash2,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import Image from 'next/image';

const CATEGORIES = ['Điện tử', 'Thời trang', 'Nhà cửa', 'Thể thao', 'Sách', 'Đồ chơi', 'Làm đẹp', 'Thực phẩm', 'Khác'];
const TOKENS = ['USDT', 'USDC', 'ETH', 'BNB', 'BTC', 'SOL', 'DAI', 'MATIC'];

interface ImagePreview { file: File; url: string; }

export default function SellerUploadPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragRef = useRef<HTMLDivElement>(null);

    const [images, setImages] = useState<ImagePreview[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedTokens, setSelectedTokens] = useState<string[]>(['USDT', 'ETH']);
    const [categoryOpen, setCategoryOpen] = useState(false);

    const [form, setForm] = useState({
        name: '',
        description: '',
        price_usd: '',
        quantity: '1',
        category: 'Điện tử',
        sku: '',
    });

    /* ─── Image Handling ─────────────────── */
    const addImages = useCallback((files: FileList | File[]) => {
        const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (images.length + arr.length > 8) {
            toast.error('Tối đa 8 ảnh');
            return;
        }
        const previews: ImagePreview[] = arr.map(file => ({
            file,
            url: URL.createObjectURL(file),
        }));
        setImages(prev => [...prev, ...previews]);
    }, [images]);

    const removeImage = (idx: number) => {
        setImages(prev => {
            URL.revokeObjectURL(prev[idx].url);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files.length) addImages(e.dataTransfer.files);
    };

    const toggleToken = (token: string) => {
        setSelectedTokens(prev =>
            prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token]
        );
    };

    /* ─── Submit ────────────────────────── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Nhập tên sản phẩm'); return; }
        if (!form.price_usd || isNaN(Number(form.price_usd))) { toast.error('Nhập giá hợp lệ'); return; }
        if (images.length === 0) { toast.error('Thêm ít nhất 1 ảnh sản phẩm'); return; }
        if (selectedTokens.length === 0) { toast.error('Chọn ít nhất 1 token thanh toán'); return; }

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('name', form.name);
            fd.append('description', form.description);
            fd.append('price_usd', form.price_usd);
            fd.append('quantity', form.quantity);
            fd.append('category', form.category);
            if (form.sku) fd.append('sku', form.sku);
            fd.append('accepted_tokens', JSON.stringify(selectedTokens));
            images.forEach(img => fd.append('images', img.file));

            await apiClient.post('/api/products', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            toast.success('Sản phẩm đã được đăng thành công!');
            router.push('/seller/dashboard');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Đăng sản phẩm thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#f0b90b]/50 focus:ring-1 focus:ring-[#f0b90b]/20 transition-all text-sm";
    const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

    return (
        <div className="min-h-screen bg-[#0c0e14] flex flex-col">
            <Header />
            <main className="flex-1 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-xl bg-[#f0b90b]/15 border border-[#f0b90b]/30 flex items-center justify-center">
                                <Store className="w-5 h-5 text-[#f0b90b]" />
                            </div>
                            <h1 className="text-2xl font-bold text-white">Đăng sản phẩm</h1>
                        </div>
                        <p className="text-gray-500 text-sm">Điền thông tin và upload ảnh để đăng bán sản phẩm của bạn</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Images */}
                            <div className="lg:col-span-1 space-y-4">
                                <div className="bg-[#1a1d26] border border-white/10 rounded-2xl p-5">
                                    <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-[#f0b90b]" />
                                        Ảnh sản phẩm
                                        <span className="text-gray-600 font-normal">({images.length}/8)</span>
                                    </h2>

                                    {/* Drop Zone */}
                                    <div
                                        ref={dragRef}
                                        onDragEnter={() => setDragActive(true)}
                                        onDragLeave={() => setDragActive(false)}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${dragActive
                                                ? 'border-[#f0b90b] bg-[#f0b90b]/5'
                                                : 'border-white/15 hover:border-[#f0b90b]/40 hover:bg-white/3'
                                            }`}
                                    >
                                        <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-400 font-medium">Kéo thả hoặc click để chọn ảnh</p>
                                        <p className="text-xs text-gray-600 mt-1">PNG, JPG, WEBP • Tối đa 8 ảnh</p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={e => e.target.files && addImages(e.target.files)}
                                        />
                                    </div>

                                    {/* Previews */}
                                    <AnimatePresence>
                                        {images.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                {images.map((img, idx) => (
                                                    <motion.div key={img.url} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                                        className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                                        <Image src={img.url} alt="" fill className="object-cover" />
                                                        {idx === 0 && (
                                                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#f0b90b] text-black text-[9px] font-bold rounded">
                                                                ẢNH CHÍNH
                                                            </div>
                                                        )}
                                                        <button type="button" onClick={() => removeImage(idx)}
                                                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X className="w-3 h-3 text-white" />
                                                        </button>
                                                    </motion.div>
                                                ))}
                                                {images.length < 8 && (
                                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                                        className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-[#f0b90b]/40 flex items-center justify-center text-gray-600 hover:text-[#f0b90b] transition-colors">
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Accepted Tokens */}
                                <div className="bg-[#1a1d26] border border-white/10 rounded-2xl p-5">
                                    <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-[#f0b90b]" />
                                        Token chấp nhận
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {TOKENS.map(token => (
                                            <button
                                                key={token}
                                                type="button"
                                                onClick={() => toggleToken(token)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedTokens.includes(token)
                                                        ? 'bg-[#f0b90b]/15 border-[#f0b90b]/50 text-[#f0b90b]'
                                                        : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                                                    }`}
                                            >
                                                {selectedTokens.includes(token) && <Check className="w-3 h-3 inline mr-1" />}
                                                {token}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedTokens.length === 0 && (
                                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Chọn ít nhất 1 token
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Right: Details */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="bg-[#1a1d26] border border-white/10 rounded-2xl p-5 space-y-4">
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Package className="w-4 h-4 text-[#f0b90b]" />
                                        Thông tin sản phẩm
                                    </h2>

                                    {/* Name */}
                                    <div>
                                        <label className={labelClass}>Tên sản phẩm *</label>
                                        <input
                                            value={form.name}
                                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="VD: iPhone 16 Pro Max 256GB"
                                            className={inputClass}
                                            maxLength={200}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className={labelClass}>Mô tả sản phẩm</label>
                                        <textarea
                                            value={form.description}
                                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                            placeholder="Mô tả chi tiết, tình trạng, thông số kỹ thuật..."
                                            rows={5}
                                            className={`${inputClass} resize-none`}
                                        />
                                    </div>

                                    {/* Price + Qty */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelClass}>Giá bán (USD) *</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                <input
                                                    type="number"
                                                    value={form.price_usd}
                                                    onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))}
                                                    placeholder="0.00"
                                                    min="0"
                                                    step="0.01"
                                                    className={`${inputClass} pl-9`}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Số lượng *</label>
                                            <input
                                                type="number"
                                                value={form.quantity}
                                                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                                min="1"
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>

                                    {/* Category + SKU */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <label className={labelClass}>Danh mục *</label>
                                            <button
                                                type="button"
                                                onClick={() => setCategoryOpen(!categoryOpen)}
                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm hover:border-[#f0b90b]/40 transition-colors"
                                            >
                                                <span>{form.category}</span>
                                                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {categoryOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setCategoryOpen(false)} />
                                                    <div className="absolute z-40 w-full mt-1 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                                                        {CATEGORIES.map(cat => (
                                                            <button key={cat} type="button"
                                                                onClick={() => { setForm(f => ({ ...f, category: cat })); setCategoryOpen(false); }}
                                                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${form.category === cat ? 'text-[#f0b90b] bg-[#f0b90b]/8' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                                                                {form.category === cat && <Check className="w-3 h-3 inline mr-2" />}
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div>
                                            <label className={labelClass}>SKU (tùy chọn)</label>
                                            <input
                                                value={form.sku}
                                                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                                                placeholder="VD: IP16-256-BLK"
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Summary preview */}
                                {form.price_usd && (
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        className="bg-[#f0b90b]/8 border border-[#f0b90b]/20 rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-[#f0b90b] mb-3">Xem trước thông tin</h3>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <p className="text-xl font-bold text-white">${parseFloat(form.price_usd || '0').toLocaleString()}</p>
                                                <p className="text-xs text-gray-500">Giá USD</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-bold text-white">{form.quantity}</p>
                                                <p className="text-xs text-gray-500">Số lượng</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-bold text-white">{selectedTokens.length}</p>
                                                <p className="text-xs text-gray-500">Token chấp nhận</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <Button type="button" variant="outline"
                                        className="flex-1 border-white/10 text-gray-400 hover:text-white bg-transparent"
                                        onClick={() => router.back()}>
                                        Hủy
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold h-auto py-3"
                                    >
                                        {submitting ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Đang đăng...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Upload className="w-4 h-4" />
                                                Đăng sản phẩm
                                            </div>
                                        )}
                                    </Button>
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
