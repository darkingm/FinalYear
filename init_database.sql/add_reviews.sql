-- ============================================================
-- Migration: Add reviews and review_votes tables
-- Run once (idempotent)
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
    review_id     SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id    INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    buyer_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    seller_id     INTEGER NOT NULL REFERENCES seller_profiles(seller_id) ON DELETE CASCADE,
    rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title         VARCHAR(100),
    content       TEXT,
    images        JSONB DEFAULT '[]',
    helpful_count INTEGER NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'deleted')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_id)   -- one review per order
);

CREATE TABLE IF NOT EXISTS review_votes (
    review_id  INTEGER NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id)
);

-- credit_score_events — for both review rewards and order points
CREATE TABLE IF NOT EXISTS credit_score_events (
    event_id       SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_type     VARCHAR(50) NOT NULL,
    score_delta    INTEGER NOT NULL,
    reference_id   INTEGER,
    reference_type VARCHAR(50),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_type, reference_id, reference_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id  ON reviews(seller_id)  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_reviews_buyer_id   ON reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_credit_events_user ON credit_score_events(user_id, created_at DESC);

-- Ensure products table has rating columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
