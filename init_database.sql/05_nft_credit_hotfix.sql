-- ================================================================
-- HOTFIX: Tạo các bảng NFT/Credit còn thiếu
-- Chạy: psql -U postgres -d marketplace_db -f this_file.sql
-- Safe to run multiple times (idempotent)
-- ================================================================

-- product_nfts: Token hóa tài sản vật lý (RWA)
CREATE TABLE IF NOT EXISTS product_nfts (
    nft_id        SERIAL      PRIMARY KEY,
    product_id    INTEGER     NOT NULL UNIQUE,
    token_uri     TEXT,
    physical_hash VARCHAR(66),
    tx_hash       VARCHAR(66),
    token_id      BIGINT,
    contract_addr VARCHAR(42),
    has_nfc       BOOLEAN     DEFAULT FALSE,
    nfc_verified  BOOLEAN     DEFAULT FALSE,
    delivered_at  TIMESTAMPTZ,
    minted_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_nfts_product ON product_nfts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_nfts_tx      ON product_nfts(tx_hash);

-- user_credit_scores: Điểm tín dụng Web3 (nếu chưa có)
CREATE TABLE IF NOT EXISTS user_credit_scores (
    credit_id        SERIAL      PRIMARY KEY,
    user_id          INTEGER     NOT NULL UNIQUE,
    wallet_address   VARCHAR(42),
    score            INTEGER     NOT NULL DEFAULT 0,
    tier             VARCHAR(20) NOT NULL DEFAULT 'BRONZE',
    total_orders     INTEGER     DEFAULT 0,
    on_time_count    INTEGER     DEFAULT 0,
    dispute_count    INTEGER     DEFAULT 0,
    has_sbt          BOOLEAN     DEFAULT FALSE,
    token_id         BIGINT,
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_credit_score_wallet ON user_credit_scores(wallet_address);
CREATE INDEX IF NOT EXISTS idx_credit_score_user   ON user_credit_scores(user_id);

-- Seed mock credit scores cho accounts hiện tại
INSERT INTO user_credit_scores (user_id, score, tier, total_orders, on_time_count, has_sbt)
SELECT u.user_id, 
       CASE 
           WHEN u.email LIKE '%admin%' THEN 520 
           WHEN u.role = 'seller' THEN 180
           ELSE 45 
       END,
       CASE 
           WHEN u.email LIKE '%admin%' THEN 'GOLD'
           WHEN u.role = 'seller' THEN 'SILVER'
           ELSE 'BRONZE'
       END,
       FLOOR(RANDOM() * 20)::INT,
       FLOOR(RANDOM() * 15)::INT,
       (u.email LIKE '%admin%')
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_credit_scores cs WHERE cs.user_id = u.user_id
);

-- Seed mock product_nfts cho các sản phẩm đầu tiên (demo data)
INSERT INTO product_nfts (product_id, token_uri, token_id, contract_addr, has_nfc, tx_hash)
SELECT p.product_id,
       'https://ipfs.io/ipfs/Qm' || ENCODE(GEN_RANDOM_BYTES(20), 'hex'),
       (ROW_NUMBER() OVER () + 100)::BIGINT,
       '0x1234567890123456789012345678901234567890',
       (RANDOM() > 0.5),
       '0x' || ENCODE(GEN_RANDOM_BYTES(32), 'hex')
FROM products p
WHERE p.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM product_nfts n WHERE n.product_id = p.product_id
  )
LIMIT 10;

SELECT 'Hotfix applied: product_nfts + user_credit_scores created and seeded' AS status;
