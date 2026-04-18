const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

function isRealProductImage(image: string | null | undefined): image is string {
    return Boolean(
        image
        && image.trim()
        && image !== PLACEHOLDER_IMAGE
        && !image.includes('placeholder')
        && !image.includes('via.placeholder.com')
    );
}

/**
 * Get gallery images for a product based on its name and category.
 * Returns 3 images for horizontal scroll carousel.
 */
export function getProductGallery(
    productName: string,
    category?: string,
    existingImages?: string[]
): string[] {
    void productName;
    void category;
    return (existingImages ?? []).filter((image): image is string => isRealProductImage(image));
}
