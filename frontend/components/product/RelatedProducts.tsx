'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Product {
    product_id: number;
    name: string;
    description: string;
    base_price_usd: number;
    metadata: {
        images?: string[];
        category?: string;
    };
    stock: number;
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
            params.append('limit', '8');

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
                {products.map((product, index) => (
                    <motion.div
                        key={product.product_id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ y: -5 }}
                        className="flex-shrink-0 w-48"
                    >
                        <Link href={`/products/${product.product_id}`}>
                            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all">
                                <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
                                    <Image
                                        src={getImageSrc(product)}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                        onError={() => setFailedImages(prev => new Set(prev).add(product.product_id))}
                                    />
                                </div>
                                <div className="p-3">
                                    <h3 className="font-semibold text-sm line-clamp-1 mb-1">{product.name}</h3>
                                    <p className="text-primary font-bold">${Number(product.base_price_usd).toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{product.stock} in stock</p>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
