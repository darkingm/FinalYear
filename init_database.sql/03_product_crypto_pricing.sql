-- =====================================================
-- SECTION 12: PRODUCT CRYPTO PRICING EXTENSION
-- =====================================================

-- Add columns to products table to allow listing items in specific crypto tokens (e.g. 0.1 BNB, 10 SOL)
ALTER TABLE products ADD COLUMN IF NOT EXISTS token_id INT REFERENCES token_whitelist(token_id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_token DECIMAL(36,18);
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) DEFAULT 'usd' CHECK (pricing_mode IN ('usd', 'crypto', 'both'));

-- Add column to product_variants as well internally for variants
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price_override_token DECIMAL(36,18);

-- Update existing active products view
CREATE OR REPLACE VIEW v_active_products AS
SELECT 
    p.*,
    sp.display_name as seller_name,
    sp.rating_avg as seller_rating,
    tw.symbol as token_symbol,
    tw.chain_id as token_chain_id,
    tw.decimals as token_decimals,
    (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) as primary_image
FROM products p
JOIN seller_profiles sp ON p.seller_id = sp.seller_id
LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
WHERE p.status = 'active';
