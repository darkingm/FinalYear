-- =====================================================
-- FIX PRICES FOR TESTNET TESTING
-- =====================================================
-- Mục đích: Giảm giá sản phẩm xuống rất thấp (~0.001-0.01 USD)
-- để có thể test thanh toán với ít MATIC/ETH testnet
--
-- MATIC Amoy faucet cho ~0.5 MATIC → giá 0.001 USD = ~0.002 MATIC
-- → có thể mua được nhiều sản phẩm để test
--
-- Chạy trên main DB (marketplace_db):
--   psql -U postgres -d marketplace_db -f fix-prices-for-testing.sql
-- =====================================================

BEGIN;

-- ─── Giảm giá tất cả sản phẩm xuống mức rất thấp để test ─────────────────
-- Lấy giá gốc / 100000 → sản phẩm $1999 → $0.02, $29 → $0.00029
-- Nhân thêm hệ số nhỏ để test được ngay với ít token

UPDATE products
SET base_price_usd = ROUND(
    CASE
        WHEN base_price_usd >= 1000 THEN 0.020  -- Laptop/Phone cao cấp → $0.02
        WHEN base_price_usd >= 500  THEN 0.015  -- Middle range → $0.015
        WHEN base_price_usd >= 100  THEN 0.010  -- Normal product → $0.01
        WHEN base_price_usd >= 30   THEN 0.005  -- Cheap product → $0.005
        ELSE                             0.001  -- Very cheap → $0.001
    END,
    6  -- 6 decimal places
)
WHERE status = 'active';

-- ─── Xác nhận kết quả ──────────────────────────────────────────────────────
SELECT
    product_id,
    name,
    base_price_usd,
    ROUND(base_price_usd / 0.62, 6) AS approx_matic_needed  -- MATIC ~$0.62
FROM products
WHERE status = 'active'
ORDER BY base_price_usd DESC
LIMIT 15;

COMMIT;

-- ─── Ghi chú ──────────────────────────────────────────────────────────────
-- Sau khi test xong trên testnet, chạy lệnh restore giá gốc:
-- UPDATE products SET base_price_usd = original_price_usd;
-- (cần backup trước nếu muốn restore)
