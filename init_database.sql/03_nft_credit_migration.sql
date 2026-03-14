-- ========================================================
-- NFT & Credit Score Schema Migration
-- Web3Market RWA (Real World Asset) Extension
-- ========================================================

-- Table to track minted NFTs for products
CREATE TABLE IF NOT EXISTS product_nfts (
    nft_id          SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL UNIQUE REFERENCES products(product_id) ON DELETE CASCADE,
    token_uri       TEXT NOT NULL,             -- ipfs://Qm... metadata URI
    physical_hash   VARCHAR(66),               -- keccak256 of NFC tag UID / QR serial
    tx_hash         VARCHAR(66),               -- minting transaction hash
    token_id        BIGINT,                    -- on-chain token ID (filled after mint)
    contract_addr   VARCHAR(42),               -- ProductNFT contract address
    has_nfc         BOOLEAN DEFAULT FALSE,     -- whether product has NFC tag
    nfc_verified    BOOLEAN DEFAULT FALSE,     -- buyer scanned NFC
    delivered_at    TIMESTAMPTZ,               -- when NFT was transferred to buyer
    minted_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_nfts_product ON product_nfts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_nfts_tx ON product_nfts(tx_hash);

-- Table to cache credit score data (synced from chain)
CREATE TABLE IF NOT EXISTS user_credit_scores (
    credit_id       SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    wallet_address  VARCHAR(42) NOT NULL,
    score           INTEGER DEFAULT 0,
    tier            VARCHAR(10) DEFAULT 'BRONZE',  -- BRONZE | SILVER | GOLD | DIAMOND
    sbt_token_id    BIGINT,
    completed_orders INTEGER DEFAULT 0,
    dispute_count   INTEGER DEFAULT 0,
    last_updated    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_scores_user ON user_credit_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_wallet ON user_credit_scores(wallet_address);

-- Add NFT-related columns to orders for tracking NFT delivery state
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nft_pending_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nft_delivered         BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_updated        BOOLEAN DEFAULT FALSE;

-- View: enriched product list with NFT info
CREATE OR REPLACE VIEW products_with_nft AS
SELECT
    p.*,
    n.token_uri,
    n.physical_hash,
    n.tx_hash         AS nft_tx_hash,
    n.token_id        AS nft_token_id,
    n.contract_addr   AS nft_contract,
    n.has_nfc,
    n.nfc_verified,
    n.minted_at       AS nft_minted_at,
    CASE WHEN n.nft_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_nft
FROM products p
LEFT JOIN product_nfts n ON n.product_id = p.product_id;

-- View: user credit summary
CREATE OR REPLACE VIEW user_credit_summary AS
SELECT
    u.user_id,
    u.username,
    u.email,
    u.wallet_address,
    COALESCE(cs.score, 0)             AS credit_score,
    COALESCE(cs.tier, 'BRONZE')       AS credit_tier,
    COALESCE(cs.completed_orders, 0)  AS completed_orders,
    COALESCE(cs.dispute_count, 0)     AS dispute_count,
    cs.sbt_token_id,
    cs.last_updated                   AS credit_last_updated
FROM users u
LEFT JOIN user_credit_scores cs ON cs.user_id = u.user_id;
