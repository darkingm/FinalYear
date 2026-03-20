-- ============================================================
-- Schema Migrations Tracking Table
-- Tạo bảng này 1 lần duy nhất để track các migration đã chạy
-- File này được chạy TRƯỚC tất cả migrations khác
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL PRIMARY KEY,
    version     VARCHAR(20)  NOT NULL UNIQUE,  -- e.g. '001', '002'
    name        VARCHAR(200) NOT NULL,          -- e.g. 'payment_fixes'
    filename    VARCHAR(255) NOT NULL,
    checksum    VARCHAR(64),                    -- MD5 of file content
    applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    applied_by  VARCHAR(100) DEFAULT 'auto'
);

-- Mark the initial schema.sql as already applied if tables exist
-- (Safe: ON CONFLICT DO NOTHING = idempotent)
INSERT INTO schema_migrations (version, name, filename, applied_by)
VALUES ('000', 'initial_schema', 'schema.sql', 'bootstrap')
ON CONFLICT (version) DO NOTHING;
