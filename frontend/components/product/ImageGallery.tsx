'use client';

import { ProductGalleryViewer } from '@/components/product/ProductGalleryViewer';
import { normalizeProductImages } from '@/lib/products/images';
import type { ProductGalleryImage } from '@/lib/products/types';

interface ImageGalleryProps {
  images: ProductGalleryImage[] | string[];
  productName: string;
  category?: string;
}

export function ImageGallery({ images, productName, category }: ImageGalleryProps) {
  void category;
  return (
    <ProductGalleryViewer
      images={normalizeProductImages(images, null)}
      productName={productName}
    />
  );
}
