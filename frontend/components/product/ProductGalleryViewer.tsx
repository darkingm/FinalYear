'use client';

import { useMemo, useState } from 'react';
import type { ProductGalleryImage } from '@/lib/products/types';

const PLACEHOLDER = '/placeholder-product.svg';

interface ProductGalleryViewerProps {
  images: ProductGalleryImage[];
  productName: string;
}

function normalizeImages(images: ProductGalleryImage[]): ProductGalleryImage[] {
  return [...images]
    .filter((image) => Boolean(image?.url))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image, index) => ({
      ...image,
      is_primary: image.is_primary || index === 0,
    }));
}

export function ProductGalleryViewer({ images, productName }: ProductGalleryViewerProps) {
  const normalizedImages = useMemo(() => normalizeImages(images), [images]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (normalizedImages.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
        Chưa có ảnh cho sản phẩm này
      </div>
    );
  }

  const currentImage = normalizedImages[currentIndex] ?? normalizedImages[0];
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + normalizedImages.length) % normalizedImages.length);
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % normalizedImages.length);

  return (
    <>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card/80 shadow-lg">
          <img
            src={currentImage?.url || PLACEHOLDER}
            alt={`${productName} - ảnh ${currentIndex + 1}`}
            className="aspect-square w-full object-cover"
          />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
              {currentIndex + 1} / {normalizedImages.length}
            </span>
            <button
              type="button"
              aria-label="Phóng to ảnh hiện tại"
              onClick={() => setIsLightboxOpen(true)}
              className="rounded-full bg-background/80 p-2 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
            >
              <span className="block text-sm font-semibold">+</span>
            </button>
          </div>

          {normalizedImages.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Xem ảnh trước đó"
                onClick={goPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-md backdrop-blur transition hover:bg-background"
              >
                <span className="block text-base font-semibold">&lt;</span>
              </button>
              <button
                type="button"
                aria-label="Xem ảnh tiếp theo"
                onClick={goNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-md backdrop-blur transition hover:bg-background"
              >
                <span className="block text-base font-semibold">&gt;</span>
              </button>
            </>
          )}
        </div>

        {normalizedImages.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {normalizedImages.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition ${
                  currentIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                }`}
              >
                <img
                  src={image.url || PLACEHOLDER}
                  alt={`${productName} thumbnail ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-6"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Đóng xem ảnh"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute right-6 top-6 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <span className="block text-base font-semibold">x</span>
          </button>

          {normalizedImages.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Xem ảnh trước đó"
                onClick={goPrev}
                className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
              >
                <span className="block text-lg font-semibold">&lt;</span>
              </button>
              <button
                type="button"
                aria-label="Xem ảnh tiếp theo"
                onClick={goNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
              >
                <span className="block text-lg font-semibold">&gt;</span>
              </button>
            </>
          )}

          <img
            src={currentImage?.url || PLACEHOLDER}
            alt={`${productName} - ảnh ${currentIndex + 1}`}
            className="max-h-[88vh] max-w-[88vw] rounded-3xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
