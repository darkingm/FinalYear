-- ============================================================
-- Schema Migrations Tracking Table
-- Tạo bảng này 1 lần duy nhất để track các migration đã chạy
-- File này được chạy TRƯỚC tất cả migrations khác
--
-- NOTE: db-migrate.sh cũng tạo schema_migrations ở step 3.
-- File này chỉ là safety-net (IF NOT EXISTS).
-- Script tự handle tracking — KHÔNG cần INSERT ở đây.
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
