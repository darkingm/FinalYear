'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Star, Store } from 'lucide-react';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';

interface Product {
    product_id: number;
    name: string;
    description: string;
    base_price_usd: number;
    price_in_token: number | null;
    token_symbol: string | null;
    category?: string;
    seller_name?: string;
    rating_avg?: number;
    primary_image?: string | null;
    images?: string[] | null;
    metadata?: Record<string, any>;
    stock?: number;
}

interface RelatedProductsProps {
    currentProductId: number;
    category?: string;
}

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

export function RelatedProducts({ currentProductId, category }: RelatedProductsProps) {
    const { t } = useClientTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

    useEffect(() => { fetchRelatedProducts(); }, [currentProductId, category]);

    const fetchRelatedProducts = async () => {
        try {
            const params = new URLSearchParams();
            if (category) params.append('category', category);
            params.append('limit', '12');
            const response = await apiClient.get(`/api/products?${params}`);
            const allProducts = response.data.data ?? [];
            setProducts(allProducts.filter((p: Product) => p.product_id !== currentProductId));
        } catch (error) {
            console.error('Error fetching related products:', error);
        } finally {
            setLoading(false);
        }
    };

    const getImageSrc = (product: Product) => {
        if (failedImages.has(product.product_id)) return PLACEHOLDER_IMAGE;
        if (product.primary_image) return product.primary_image;
        if (product.images?.[0]) return product.images[0];
        if (product.metadata?.images?.[0]) return product.metadata.images[0];
        return PLACEHOLDER_IMAGE;
    };

    const scroll = (direction: 'left' | 'right') => {
        const container = document.getElementById('related-products-container');
        if (container) {
            const newPosition = direction === 'left' ? scrollPosition - 300 : scrollPosition + 300;
            container.scrollTo({ left: newPosition, behavior: 'smooth' });
            setScrollPosition(newPosition);
        }
    };

    if (loading) {
        return (
            <div className="mt-12">
                <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
                <div className="flex gap-4 overflow-hidden">
                    {[1,2,3,4].map(i => <div key={i} className="w-48 flex-shrink-0"><div className="h-48 bg-muted rounded-lg animate-pulse mb-2" /><div className="h-4 bg-muted rounded animate-pulse mb-1" /></div>)}
                </div>
            </div>
        );
    }

    if (products.length === 0) return null;

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="mt-12">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{t('product.relatedProducts')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => scroll('left')} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => scroll('right')} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                </div>
            </div>
            <div id="related-products-container" className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth" onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}>
                {products.map((product, index) => (
                    <motion.div key={product.product_id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} whileHover={{ y: -5 }} className="flex-shrink-0 w-[240px]">
                        <Link href={`/products/${product.product_id}`} className="group block h-full">
                            <div className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:ring-1 hover:ring-primary/20 transition-all border border-border h-full flex flex-col">
                                <div className="relative h-48 bg-muted">
                                    <Image src={getImageSrc(product)} alt={product.name} fill className="object-cover group-hover:opacity-90 transition-opacity" unoptimized onError={() => setFailedImages(prev => new Set(prev).add(product.product_id))} />
                                    {product.token_symbol && (
                                        <span className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{product.token_symbol}</span>
                                    )}
                                    {(product.stock ?? 0) === 0 && (
                                        <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">{t('product.outOfStock')}</div>
                                    )}
                                </div>
                                <div className="p-4 flex flex-col flex-grow">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-sm line-clamp-1">
                                            {product.category || product.metadata?.category || 'Product'}
                                        </div>
                                        {Number(product.rating_avg) > 0 && (
                                            <div className="flex items-center gap-1 text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                                                <Star className="w-3 h-3 fill-current" /><span>{Number(product.rating_avg).toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-3 group-hover:text-primary transition-colors flex-grow">{product.name}</h3>
                                    <div className="mt-auto pt-3 border-t border-border flex flex-col gap-1.5">
                                        <span className="text-lg font-bold text-primary">
                                            {product.price_in_token && product.token_symbol
                                                ? `${Number(product.price_in_token).toFixed(2)} ${product.token_symbol}`
                                                : `$${Number(product.base_price_usd).toFixed(2)}`}
                                        </span>
                                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                                            <p className="flex items-center gap-1 line-clamp-1"><Store className="w-3.5 h-3.5" /><span>{product.seller_name || 'Seller'}</span></p>
                                            <p className="whitespace-nowrap ml-2 opacity-80">{product.stock ?? 0} in stock</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
