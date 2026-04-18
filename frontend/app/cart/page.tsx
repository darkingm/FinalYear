'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trash2, Plus, Minus, ArrowRight, ShoppingBag,
    ShieldCheck, AlertCircle, Zap, CreditCard
} from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { CoinImage } from '@/components/ui/CoinImage';
import { formatTokenAmountOnly } from '@/lib/products/pricing';

export default function CartPage() {
    const router = useRouter();
    const { items, removeItem, updateQuantity, getTotal, getTotalItems } = useCartStore();
    const { isAuthenticated } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const total = getTotal();
    const totalItems = getTotalItems();

    const handleCheckout = () => {
        if (!isAuthenticated) {
            router.push('/login?callbackUrl=/checkout/cart');
        } else {
            router.push('/checkout/cart');
        }
    };

    return (
        <div className="min-h-screen bg-background py-10">
            <div className="container mx-auto px-4 max-w-6xl">
                <div className="mb-8">
                    <h1 className="text-3xl lg:text-4xl font-extrabold text-foreground flex items-center gap-3">
                        <ShoppingBag className="w-8 h-8 text-[#8247e5]" />
                        Giỏ Hàng Của Bạn
                        <span className="text-xl font-medium text-muted-foreground ml-2">
                            ({totalItems} sản phẩm)
                        </span>
                    </h1>
                </div>

                {items.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card border border-border rounded-3xl shadow-sm"
                    >
                        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-3">Giỏ hàng của bạn đang trống</h2>
                        <p className="text-muted-foreground mb-8 max-w-md">
                            Có vẻ như bạn chưa thêm sản phẩm nào vào giỏ hàng. Hãy khám phá các sản phẩm Web3 hấp dẫn đang chờ bạn!
                        </p>
                        <Link href="/products">
                            <Button size="lg" className="h-12 px-8 rounded-xl text-base font-semibold btn-purple-rainbow shadow-lg shadow-purple-500/20">
                                Khám Phá Cửa Hàng
                            </Button>
                        </Link>
                    </motion.div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        {/* Cart Items List */}
                        <div className="w-full lg:w-[65%] order-2 lg:order-1 space-y-4">
                            <AnimatePresence>
                                {items.map((item) => (
                                    <motion.div
                                        key={item.cart_item_id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                        className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center relative group shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        {/* Item Image */}
                                        <Link href={`/products/${item.product_id}`} className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 bg-muted rounded-xl bg-center bg-cover overflow-hidden" style={{ backgroundImage: `url(${item.image_url || item.metadata?.images?.[0] || 'https://via.placeholder.com/300'})` }} />


                                        {/* Item Details */}
                                        <div className="flex-1 min-w-0 pr-10 sm:pr-0">
                                            <Link href={`/products/${item.product_id}`} className="block hover:underline">
                                                <h3 className="text-lg font-bold text-foreground line-clamp-2 leading-tight mb-1">
                                                    {item.name}
                                                </h3>
                                            </Link>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xl font-bold text-[#8247e5]">
                                                    ${item.base_price_usd.toLocaleString()}
                                                </span>
                                                {item.price_in_token && item.token_symbol && (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/20 px-2.5 py-1 text-xs font-black text-foreground">
                                                        <span>{formatTokenAmountOnly(item.price_in_token)}</span>
                                                        <CoinImage symbol={item.token_symbol} size={14} className="rounded-full" alt={item.token_symbol} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Controls Container */}
                                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-4 sm:mt-0 gap-4 sm:gap-2">
                                            {/* Quantity Control */}
                                            <div className="flex items-center bg-muted/50 rounded-lg border border-border p-1 shrink-0">
                                                <button
                                                    onClick={() => updateQuantity(item.cart_item_id, item.quantity - 1)}
                                                    className="w-8 h-8 rounded-md flex items-center justify-center text-foreground hover:bg-background hover:shadow-sm transition-all"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <span className="w-10 text-center text-sm font-semibold">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1)}
                                                    className="w-8 h-8 rounded-md flex items-center justify-center text-foreground hover:bg-background hover:shadow-sm transition-all"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Subtotal */}
                                            <div className="text-sm font-bold text-foreground block sm:hidden">
                                                Tổng: ${(item.base_price_usd * item.quantity).toLocaleString()}
                                            </div>
                                        </div>

                                        {/* Delete button absolutely positioned on mobile, flex on desktop */}
                                        <button
                                            onClick={() => removeItem(item.cart_item_id)}
                                            className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 sm:ml-4 w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white flex items-center justify-center transition-colors shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Security Badges */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-6 mt-6">
                                <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Web3 Escrow Protection</div>
                                <div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-blue-500" /> Hỗ trợ hoàn tiền 100%</div>
                            </div>
                        </div>

                        {/* Order Summary Sticky Sidebar */}
                        <div className="w-full lg:w-[35%] order-1 lg:order-2 sticky top-24">
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-card border border-border rounded-3xl p-6 shadow-xl shadow-black/5"
                            >
                                <h3 className="text-xl font-bold text-foreground mb-6">Tóm tắt đơn hàng</h3>

                                <div className="space-y-4 mb-6">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Tổng phụ ({totalItems} món)</span>
                                        <span className="font-medium text-foreground">${total.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Phí nền tảng (Ước tính)</span>
                                        <span className="text-emerald-500 font-medium font-mono">2.5%</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Phí vận chuyển</span>
                                        <span className="font-medium text-foreground">Miễn phí</span>
                                    </div>
                                </div>

                                <div className="border-t border-border pt-4 mb-8">
                                    <div className="flex justify-between items-end">
                                        <span className="text-foreground font-semibold">Thành tiền</span>
                                        <div className="text-right">
                                            <span className="text-3xl font-extrabold text-[#8247e5] block leading-none">
                                                ${total.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-muted-foreground block mt-1">
                                                (Chưa bao gồm phí Gas)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleCheckout}
                                    size="lg"
                                    className="w-full h-14 rounded-xl text-lg font-bold btn-purple-rainbow shadow-xl shadow-purple-500/25 flex items-center justify-center gap-2 group"
                                >
                                    Thanh Toán Ngay
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Button>

                                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                                    <div className="px-3 py-1.5 bg-accent/20 border border-border rounded-md flex items-center gap-1 text-xs font-medium"><Zap className="w-3.5 h-3.5 text-yellow-500" /> Nhanh chóng</div>
                                    <div className="px-3 py-1.5 bg-accent/20 border border-border rounded-md flex items-center gap-1 text-xs font-medium"><CreditCard className="w-3.5 h-3.5" /> Crypto & Fiat</div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
