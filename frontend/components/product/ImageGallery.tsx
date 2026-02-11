'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react';

interface ImageGalleryProps {
    images: string[];
    productName: string;
}

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

export function ImageGallery({ images, productName }: ImageGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

    const displayImages = images.length > 0 ? images : [PLACEHOLDER_IMAGE];

    const getImageSrc = (index: number) => {
        if (failedImages.has(index)) return PLACEHOLDER_IMAGE;
        return displayImages[index] || PLACEHOLDER_IMAGE;
    };

    const handleImageError = (index: number) => {
        setFailedImages(prev => new Set(prev).add(index));
    };

    const goToNext = () => {
        setSelectedIndex((prev) => (prev + 1) % displayImages.length);
    };

    const goToPrev = () => {
        setSelectedIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
    };

    return (
        <>
            <div className="space-y-4">
                {/* Main Image */}
                <motion.div
                    className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden group cursor-zoom-in"
                    onClick={() => setIsLightboxOpen(true)}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
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
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {/* Image counter */}
                    {displayImages.length > 1 && (
                        <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 text-white text-sm rounded-full">
                            {selectedIndex + 1} / {displayImages.length}
                        </div>
                    )}
                </motion.div>

                {/* Thumbnails */}
                {displayImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {displayImages.map((_, index) => (
                            <motion.button
                                key={index}
                                onClick={() => setSelectedIndex(index)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${selectedIndex === index
                                        ? 'border-primary'
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
                        {/* Close button */}
                        <button
                            onClick={() => setIsLightboxOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        {/* Image */}
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

                        {/* Navigation in lightbox */}
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

                        {/* Thumbnail strip */}
                        {displayImages.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-lg">
                                {displayImages.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={(e) => { e.stopPropagation(); setSelectedIndex(index); }}
                                        className={`w-3 h-3 rounded-full transition-colors ${selectedIndex === index ? 'bg-white' : 'bg-white/50 hover:bg-white/80'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
