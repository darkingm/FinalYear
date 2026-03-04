/**
 * Maps product categories/names to gallery images
 * Used as fallback when products don't have uploaded images
 */

const GALLERY_BASE = '/products/gallery';

const GALLERY_MAP: Record<string, string[]> = {
    headphones: [
        `${GALLERY_BASE}/headphones-1.png`,
        `${GALLERY_BASE}/headphones-2.png`,
        `${GALLERY_BASE}/headphones-3.png`,
    ],
    speaker: [
        `${GALLERY_BASE}/speaker-1.png`,
        `${GALLERY_BASE}/speaker-2.png`,
        `${GALLERY_BASE}/speaker-3.png`,
    ],
    smartwatch: [
        `${GALLERY_BASE}/smartwatch-1.png`,
        `${GALLERY_BASE}/smartwatch-2.png`,
        `${GALLERY_BASE}/smartwatch-3.png`,
    ],
    watch: [
        `${GALLERY_BASE}/smartwatch-1.png`,
        `${GALLERY_BASE}/smartwatch-2.png`,
        `${GALLERY_BASE}/smartwatch-3.png`,
    ],
    laptop: [
        `${GALLERY_BASE}/laptop-1.png`,
        `${GALLERY_BASE}/laptop-2.png`,
        `${GALLERY_BASE}/laptop-3.png`,
    ],
    camera: [
        `${GALLERY_BASE}/camera-1.png`,
        `${GALLERY_BASE}/camera-2.png`,
        `${GALLERY_BASE}/camera-3.png`,
    ],
    sneakers: [
        `${GALLERY_BASE}/sneakers-1.png`,
        `${GALLERY_BASE}/sneakers-2.png`,
        `${GALLERY_BASE}/speaker-3.png`, // reuse as lifestyle
    ],
    shoes: [
        `${GALLERY_BASE}/sneakers-1.png`,
        `${GALLERY_BASE}/sneakers-2.png`,
        `${GALLERY_BASE}/speaker-3.png`,
    ],
    // Category fallbacks
    electronics: [
        `${GALLERY_BASE}/laptop-1.png`,
        `${GALLERY_BASE}/headphones-1.png`,
        `${GALLERY_BASE}/smartwatch-1.png`,
    ],
    fashion: [
        `${GALLERY_BASE}/sneakers-1.png`,
        `${GALLERY_BASE}/sneakers-2.png`,
        `${GALLERY_BASE}/smartwatch-1.png`,
    ],
    sports: [
        `${GALLERY_BASE}/sneakers-1.png`,
        `${GALLERY_BASE}/sneakers-2.png`,
        `${GALLERY_BASE}/speaker-3.png`,
    ],
    home: [
        `${GALLERY_BASE}/speaker-1.png`,
        `${GALLERY_BASE}/speaker-2.png`,
        `${GALLERY_BASE}/laptop-3.png`,
    ],
    default: [
        `${GALLERY_BASE}/headphones-1.png`,
        `${GALLERY_BASE}/laptop-1.png`,
        `${GALLERY_BASE}/smartwatch-1.png`,
    ],
};

/**
 * Get gallery images for a product based on its name and category.
 * Returns 3 images for horizontal scroll carousel.
 */
export function getProductGallery(
    productName: string,
    category?: string,
    existingImages?: string[]
): string[] {
    // If product already has valid images (not placeholders), use them
    if (existingImages && existingImages.length > 0) {
        const real = existingImages.filter(
            (img) => img && img !== '/placeholder-product.svg' && !img.includes('placeholder')
        );
        if (real.length >= 2) return real;
    }

    const nameLower = (productName || '').toLowerCase();

    // Check product name keywords
    for (const [keyword, images] of Object.entries(GALLERY_MAP)) {
        if (keyword === 'default' || keyword === 'electronics' || keyword === 'fashion' || keyword === 'sports' || keyword === 'home') continue;
        if (nameLower.includes(keyword)) return images;
    }

    // Check by category
    const catLower = (category || '').toLowerCase();
    if (catLower && GALLERY_MAP[catLower]) {
        return GALLERY_MAP[catLower];
    }

    // Return default set based on product_id hash for variety
    const hash = nameLower.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const sets = [
        GALLERY_MAP.headphones,
        GALLERY_MAP.speaker,
        GALLERY_MAP.smartwatch,
        GALLERY_MAP.laptop,
        GALLERY_MAP.camera,
        GALLERY_MAP.sneakers,
    ];
    return sets[hash % sets.length];
}
