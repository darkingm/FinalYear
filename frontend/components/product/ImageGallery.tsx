'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react';
import { getProductGallery } from '@/lib/utils/product-images';

interface ImageGalleryProps {
    images: string[];
    productName: string;
    category?: string;
}

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

export function ImageGallery({ images, productName, category }: ImageGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);
    const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Use gallery mapping for fallback images
    const galleryImages = getProductGallery(productName, category, images);
    const displayImages = galleryImages.length > 0 ? galleryImages : [PLACEHOLDER_IMAGE];

    const getImageSrc = (index: number) => {
        if (failedImages.has(index)) return PLACEHOLDER_IMAGE;
        return displayImages[index] || PLACEHOLDER_IMAGE;
    };

    const handleImageError = (index: number) => {
        setFailedImages(prev => new Set(prev).add(index));
    };

    const goToIndex = useCallback((index: number) => {
        setSelectedIndex(index);
        // Scroll thumbnail strip
        if (scrollRef.current) {
            const thumb = scrollRef.current.children[index] as HTMLElement;
            if (thumb) {
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, []);

    const goToNext = useCallback(() => {
        goToIndex((selectedIndex + 1) % displayImages.length);
    }, [selectedIndex, displayImages.length, goToIndex]);

    const goToPrev = useCallback(() => {
        goToIndex((selectedIndex - 1 + displayImages.length) % displayImages.length);
    }, [selectedIndex, displayImages.length, goToIndex]);

    // Auto-scroll carousel effect
    useEffect(() => {
        if (!isAutoScrolling || displayImages.length <= 1) return;
        autoScrollTimerRef.current = setInterval(() => {
            setSelectedIndex(prev => (prev + 1) % displayImages.length);
        }, 3500);
        return () => {
            if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
        };
    }, [isAutoScrolling, displayImages.length]);

    // Pause auto-scroll on hover
    const pauseAutoScroll = () => setIsAutoScrolling(false);
    const resumeAutoScroll = () => setIsAutoScrolling(true);

    return (
        <>
            <div className="space-y-4">
                {/* Main Image with slide animation */}
                <motion.div
                    className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden group cursor-zoom-in"
                    onClick={() => setIsLightboxOpen(true)}
                    onMouseEnter={pauseAutoScroll}
                    onMouseLeave={resumeAutoScroll}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedIndex}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.35, ease: 'easeInOut' }}
                            className="absolute inset-0"
                        >
                            <Image
                                src={getImageSrc(selectedIndex)}
                                alt={`${productName} - Image ${selectedIndex + 1}`}
                                fill
                                className="object-contain"
                                unoptimized
                                onError={() => handleImageError(selectedIndex)}
                            />
                        </motion.div>
                    </AnimatePresence>

                    {/* Zoom indicator */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>

                    {/* Navigation arrows */}
                    {displayImages.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800 text-foreground"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800 text-foreground"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {/* Image counter badge */}
                    {displayImages.length > 1 && (
                        <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 text-white text-sm rounded-full">
                            {selectedIndex + 1} / {displayImages.length}
                        </div>
                    )}

                    {/* Dot indicators */}
                    {displayImages.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {displayImages.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={(e) => { e.stopPropagation(); goToIndex(index); }}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${selectedIndex === index
                                            ? 'bg-white w-6 shadow-lg'
                                            : 'bg-white/50 hover:bg-white/80'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Horizontal Scrolling Thumbnails with animation */}
                {displayImages.length > 1 && (
                    <div className="relative">
                        <div
                            ref={scrollRef}
                            className="flex gap-2 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {displayImages.map((_, index) => (
                                <motion.button
                                    key={index}
                                    onClick={() => goToIndex(index)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.08 }}
                                    className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-300 snap-center ${selectedIndex === index
                                            ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                                            : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                >
                                    <Image
                                        src={getImageSrc(index)}
                                        alt={`${productName} thumbnail ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                        onError={() => handleImageError(index)}
                                    />
                                    {selectedIndex === index && (
                                        <motion.div
                                            layoutId="thumbnail-indicator"
                                            className="absolute inset-0 bg-primary/10"
                                        />
                                    )}
                                </motion.button>
                            ))}
                        </div>

                        {/* Auto-scroll progress bar */}
                        {isAutoScrolling && displayImages.length > 1 && (
                            <div className="mt-2 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <motion.div
                                    key={selectedIndex}
                                    initial={{ width: '0%' }}
                                    animate={{ width: '100%' }}
                                    transition={{ duration: 3.5, ease: 'linear' }}
                                    className="h-full bg-primary rounded-full"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {isLightboxOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                        onClick={() => setIsLightboxOpen(false)}
                    >
                        <button
                            onClick={() => setIsLightboxOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative w-full h-full max-w-5xl max-h-[90vh] m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src={getImageSrc(selectedIndex)}
                                alt={productName}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </motion.div>

                        {displayImages.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                                >
                                    <ChevronLeft className="w-8 h-8 text-white" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                                >
                                    <ChevronRight className="w-8 h-8 text-white" />
                                </button>
                            </>
                        )}

                        {/* Bottom thumbnail strip in lightbox */}
                        {displayImages.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 p-3 bg-black/60 backdrop-blur-sm rounded-xl">
                                {displayImages.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={(e) => { e.stopPropagation(); goToIndex(index); }}
                                        className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${selectedIndex === index ? 'border-white scale-110' : 'border-white/30 hover:border-white/60'
                                            }`}
                                    >
                                        <Image
                                            src={getImageSrc(index)}
                                            alt={`Thumbnail ${index + 1}`}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
