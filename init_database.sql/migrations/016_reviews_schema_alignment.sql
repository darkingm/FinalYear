-- Align older production review tables with the current reviews module.
-- Some deployed databases were created before reviews.seller_id/title/content/helpful_count
-- and review_votes existed. Keep this migration additive and backfill from
-- existing order/product/comment data.

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS seller_id BIGINT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS title VARCHAR(100);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0;

UPDATE reviews r
SET seller_id = COALESCE(r.seller_id, p.seller_id)
FROM products p
WHERE r.product_id = p.product_id
  AND r.seller_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'comment'
  ) THEN
    EXECUTE 'UPDATE reviews SET content = COALESCE(content, comment) WHERE content IS NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_seller_id_fkey'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_seller_id_fkey
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(seller_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS review_votes (
  review_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  is_helpful BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_id, user_id),
  FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_seller
  ON reviews(seller_id)
  WHERE status = 'published';

