-- Migration 020: Chuẩn hoá user_wallets EVM về lowercase + uniqueness toàn cục
-- Applies to: marketplace_db
-- Mục tiêu:
--   1. Lowercase mọi địa chỉ EVM hiện có để truy vấn case-insensitive nhất quán.
--   2. De-dup các bản ghi trùng (xuất hiện trước khi có ràng buộc) — giữ ví primary > verified > tạo sớm nhất.
--   3. Ép EVM address chỉ có thể thuộc 1 user duy nhất trong toàn hệ thống.
--   4. Giữ ràng buộc per-user cho các chain non-EVM (Solana/Bitcoin/... case-sensitive).

-- 1) Lowercase địa chỉ EVM (idempotent)
UPDATE user_wallets
SET address = LOWER(address),
    updated_at = NOW()
WHERE chain_type = 'evm'
  AND address <> LOWER(address);

-- 2) De-duplicate các ví EVM đã trùng nhau (giữ row tốt nhất)
--    Ranking: is_primary DESC, is_verified DESC, created_at ASC, wallet_db_id ASC
DELETE FROM user_wallets w
USING (
    SELECT wallet_db_id,
           ROW_NUMBER() OVER (
               PARTITION BY chain_type, LOWER(address)
               ORDER BY is_primary DESC, is_verified DESC, created_at ASC, wallet_db_id ASC
           ) AS rn
    FROM user_wallets
    WHERE chain_type = 'evm'
) ranked
WHERE w.wallet_db_id = ranked.wallet_db_id
  AND ranked.rn > 1;

-- 3) Bỏ ràng buộc case-sensitive cũ nếu còn
DO $$
BEGIN
    ALTER TABLE user_wallets DROP CONSTRAINT user_wallets_user_id_chain_type_address_key;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- 4) Per-user uniqueness cho chain non-EVM (giữ behaviour cũ — case-sensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_wallets_user_chain_address_nonevm
    ON user_wallets (user_id, chain_type, address)
    WHERE chain_type <> 'evm';

-- 5) EVM: 1 địa chỉ chỉ thuộc về 1 user duy nhất (toàn cục, không phụ thuộc chain_id vì EVM
--    address giống nhau trên mọi mạng EVM)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_wallets_evm_address_lower
    ON user_wallets (LOWER(address))
    WHERE chain_type = 'evm';

-- 6) Hỗ trợ truy vấn case-insensitive nhanh
CREATE INDEX IF NOT EXISTS idx_user_wallets_address_lower
    ON user_wallets (LOWER(address));

SELECT 'Migration 020 applied: user_wallets EVM lowercase + cross-user uniqueness' AS result;
