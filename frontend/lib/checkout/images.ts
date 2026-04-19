import { getPrimaryProductImage } from '@/lib/products/images';
import type { ProductGalleryImage } from '@/lib/products/types';

type RawImage = string | ProductGalleryImage | { url?: string; image_url?: string; sort_order?: number; is_primary?: boolean };

interface CheckoutOrderImageSource {
  primary_image?: string | null;
  product_metadata?: {
    images?: RawImage[] | null;
  } | null;
}

interface CheckoutProductImageSource {
  primary_image?: string | null;
  images?: RawImage[] | null;
  product_metadata?: {
    images?: RawImage[] | null;
  } | null;
}

export function resolveCheckoutProductImage(
  order?: CheckoutOrderImageSource | null,
  product?: CheckoutProductImageSource | null,
): string | null {
  const rawImages =
    order?.product_metadata?.images ??
    product?.images ??
    product?.product_metadata?.images ??
    null;

  const primaryImage = order?.primary_image ?? product?.primary_image ?? null;
  const resolved = getPrimaryProductImage(rawImages, primaryImage);

  return resolved === '/placeholder-product.svg' ? null : resolved;
}
