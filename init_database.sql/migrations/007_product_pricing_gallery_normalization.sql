-- 007_product_pricing_gallery_normalization.sql
-- Backfill normalized accepted-token pricing rows and product image rows from legacy product columns / metadata.

INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
SELECT
  p.product_id,
  p.token_id,
  p.price_in_token,
  TRUE
FROM products p
WHERE p.token_id IS NOT NULL
  AND p.price_in_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM product_accepted_tokens pat
    WHERE pat.product_id = p.product_id
      AND pat.token_id = p.token_id
  );

DO $$
DECLARE
  product_row RECORD;
  image_value JSONB;
  image_url TEXT;
  image_index INT;
BEGIN
  FOR product_row IN
    SELECT
      p.product_id,
      p.metadata->'images' AS metadata_images
    FROM products p
    WHERE jsonb_typeof(p.metadata->'images') = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM product_images pi
        WHERE pi.product_id = p.product_id
      )
  LOOP
    image_index := 0;

    FOR image_value IN
      SELECT value
      FROM jsonb_array_elements(product_row.metadata_images)
    LOOP
      image_url := NULL;

      IF jsonb_typeof(image_value) = 'string' THEN
        image_url := trim(both '"' FROM image_value::text);
      ELSIF jsonb_typeof(image_value) = 'object' THEN
        image_url := COALESCE(image_value->>'url', image_value->>'image_url');
      END IF;

      IF image_url IS NOT NULL AND image_url <> '' THEN
        INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
        VALUES (product_row.product_id, image_url, image_index, image_index = 0);

        image_index := image_index + 1;
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_images_product_sort
  ON product_images(product_id, sort_order);

SELECT 'Migration 007 applied: product pricing and gallery normalization' AS result;
