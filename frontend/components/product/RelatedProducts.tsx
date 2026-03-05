'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Star, Store } from 'lucide-react';

interface Product {
    product_id: number;
    name: string;
    description: string;
    base_price_usd: number;
    category?: string;
    pricing_mode?: string;
    price_token?: string | number;
    token_symbol?: string;
    token_decimals?: number;
    seller_name?: string;
    rating_avg?: number;
    review_count?: number;
    metadata: {
        images?: string[];
        category?: string;
    };
    stock_available?: number;
    stock?: number;
}

interface RelatedProductsProps {
    currentProductId: number;
    category?: string;
}

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

export function RelatedProducts({ currentProductId, category }: RelatedProductsProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchRelatedProducts();
    }, [currentProductId, category]);

    const fetchRelatedProducts = async () => {
        try {
            const params = new URLSearchParams();
            if (category) params.append('category', category);
            params.append('limit', '12');

            const response = await apiClient.get(`/api/products?${params}`);
            const allProducts = response.data.data || [];
            // Filter out current product
            setProducts(allProducts.filter((p: Product) => p.product_id !== currentProductId));
        } catch (error) {
            console.error('Error fetching related products:', error);
        } finally {
            setLoading(false);
        }
    };

    const getImageSrc = (product: Product) => {
        if (failedImages.has(product.product_id)) return PLACEHOLDER_IMAGE;
        return product.metadata?.images?.[0] || PLACEHOLDER_IMAGE;
    };

    const scroll = (direction: 'left' | 'right') => {
        const container = document.getElementById('related-products-container');
        if (container) {
            const scrollAmount = 300;
            const newPosition = direction === 'left'
                ? scrollPosition - scrollAmount
                : scrollPosition + scrollAmount;
            container.scrollTo({ left: newPosition, behavior: 'smooth' });
            setScrollPosition(newPosition);
        }
    };

    if (loading) {
        return (
            <div className="mt-12">
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
                <div className="flex gap-4 overflow-hidden">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-48 flex-shrink-0">
                            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (products.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12"
        >
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Related Products</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => scroll('left')}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div
                id="related-products-container"
                className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
            >
                {products.map((product, index) => {
                    const stockDisplay = product.stock_available ?? product.stock ?? 0;
                    return (
                        <motion.div
                            key={product.product_id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            whileHover={{ y: -5 }}
                            className="flex-shrink-0 w-[240px]"
                        >
                            <Link href={`/products/${product.product_id}`} className="group block h-full">
                                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:ring-1 hover:ring-primary/20 transition-all border border-gray-100 dark:border-gray-700 h-full flex flex-col">
                                    <div className="relative h-48 bg-gray-50 dark:bg-gray-900 group-hover:opacity-90 transition-opacity">
                                        <Image
                                            src={getImageSrc(product)}
                                            alt={product.name}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                            onError={() => setFailedImages(prev => new Set(prev).add(product.product_id))}
                                        />
                                        {stockDisplay === 0 && (
                                            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                                Sold Out
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 flex flex-col flex-grow">
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <div className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-sm line-clamp-1">
                                                {product.metadata?.category || product.category || 'Product'}
                                            </div>
                                            {product.rating_avg !== null && product.rating_avg !== undefined && Number(product.rating_avg) > 0 && (
                                                <div className="flex items-center gap-1 text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                                                    <Star className="w-3 h-3 fill-current" />
                                                    <span>{Number(product.rating_avg).toFixed(1)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-3 group-hover:text-primary transition-colors flex-grow">
                                            {product.name}
                                        </h3>

                                        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-1.5">
                                            {(product.pricing_mode === 'crypto' && product.price_token) ? (
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-lg font-bold">
                                                        {Number(product.price_token).toString()}
                                                    </span>
                                                    <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-1 rounded">
                                                        {product.token_symbol}
                                                    </span>
                                                </div>
                                            ) : (product.pricing_mode === 'both' && product.price_token) ? (
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-bold text-primary">
                                                        ${Number(product.base_price_usd).toFixed(2)}
                                                    </span>
                                                    <div className="flex items-baseline gap-1 text-xs text-muted-foreground">
                                                        <span>or {Number(product.price_token).toString()}</span>
                                                        <span className="font-semibold text-blue-500">{product.token_symbol}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-lg font-bold text-primary">
                                                    ${Number(product.base_price_usd).toFixed(2)}
                                                </span>
                                            )}

                                            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                                                <p className="flex items-center gap-1 line-clamp-1">
                                                    <Store className="w-3.5 h-3.5" />
                                                    <span>{product.seller_name || 'Global Seller'}</span>
                                                </p>
                                                <p className="whitespace-nowrap ml-2 opacity-80">{stockDisplay} in stock</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    )
                })}
            </div>
        </motion.div>
    );
}
