import type { ProductGalleryImage } from './types';

type RawImage = string | ProductGalleryImage | { url?: string; image_url?: string; sort_order?: number; is_primary?: boolean };

export function normalizeProductImages(
  rawImages: RawImage[] | null | undefined,
  primaryImage?: string | null,
): ProductGalleryImage[] {
  const images = (rawImages ?? [])
    .map((image, index): ProductGalleryImage | null => {
      if (typeof image === 'string') {
        if (!image) return null;
        return {
          url: image,
          sort_order: index,
          is_primary: image === primaryImage || index === 0,
        };
      }

      const url = image?.url || ('image_url' in image ? image.image_url : undefined);
      if (!url) return null;

      return {
        url,
        sort_order: Number.isFinite(image.sort_order) ? Number(image.sort_order) : index,
        is_primary: Boolean(image.is_primary) || url === primaryImage,
      };
    })
    .filter((image): image is ProductGalleryImage => Boolean(image))
    .sort((a, b) => a.sort_order - b.sort_order);

  if (images.length === 0 && primaryImage) {
    return [{ url: primaryImage, sort_order: 0, is_primary: true }];
  }

  if (images.length > 0 && !images.some((image) => image.is_primary)) {
    images[0].is_primary = true;
  }

  return images;
}

export function getPrimaryProductImage(
  rawImages: RawImage[] | null | undefined,
  primaryImage?: string | null,
): string {
  const normalized = normalizeProductImages(rawImages, primaryImage);
  return primaryImage || normalized.find((image) => image.is_primary)?.url || normalized[0]?.url || '/placeholder-product.svg';
}
