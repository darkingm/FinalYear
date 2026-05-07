-- Migration 027: extend `coupons` to support seller-scoped vouchers + the
-- richer fields the frontend already sends (description, per-user limit,
-- max discount cap). Pre-existing columns (min_purchase, max_uses, valid_from,
-- valid_until) remain — service maps the FE field names to them. We also
-- broaden the discount_type CHECK so 'fixed_amount' (frontend alias for
-- 'fixed') is accepted natively without a service-layer rewrite later.

ALTER TABLE coupons
    ADD COLUMN IF NOT EXISTS seller_id        BIGINT REFERENCES seller_profiles(seller_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS description      TEXT,
    ADD COLUMN IF NOT EXISTS per_user_limit   INT,
    ADD COLUMN IF NOT EXISTS max_discount_usd DECIMAL(18,2);

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_discount_type_check;
ALTER TABLE coupons
    ADD CONSTRAINT coupons_discount_type_check
        CHECK (discount_type IN ('percentage','fixed','fixed_amount','free_shipping'));

CREATE INDEX IF NOT EXISTS idx_coupons_seller ON coupons(seller_id);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status, valid_until);

-- Track per-coupon, per-user usage for `per_user_limit` enforcement and
-- `used_count` increments at order time.
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    redemption_id BIGSERIAL PRIMARY KEY,
    coupon_id     BIGINT NOT NULL REFERENCES coupons(coupon_id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(user_id)     ON DELETE CASCADE,
    order_id      BIGINT REFERENCES orders(order_id) ON DELETE SET NULL,
    redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_user
    ON coupon_redemptions(coupon_id, user_id);

INSERT INTO schema_migrations (version, name, filename)
VALUES ('027', 'coupons_seller_scope', '027_coupons_seller_scope.sql')
ON CONFLICT (version) DO NOTHING;
