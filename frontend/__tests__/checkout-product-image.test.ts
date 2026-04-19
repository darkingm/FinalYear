import { describe, expect, it } from '@jest/globals';
import { resolveCheckoutProductImage } from '@/lib/checkout/images';

describe('resolveCheckoutProductImage', () => {
  it('uses the order primary image when available', () => {
    const image = resolveCheckoutProductImage({
      primary_image: 'https://cdn.example.com/order-primary.jpg',
      product_metadata: {},
    });

    expect(image).toBe('https://cdn.example.com/order-primary.jpg');
  });

  it('falls back to fetched product gallery objects when the order payload has no image', () => {
    const image = resolveCheckoutProductImage(
      {
        primary_image: null,
        product_metadata: {},
      },
      {
        images: [
          { url: 'https://cdn.example.com/gallery-1.jpg', sort_order: 0, is_primary: true },
        ],
        primary_image: null,
      },
    );

    expect(image).toBe('https://cdn.example.com/gallery-1.jpg');
  });
});
