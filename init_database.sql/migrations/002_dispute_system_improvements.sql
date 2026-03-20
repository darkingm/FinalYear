-- Migration 002: Dispute System Improvements
-- Version: 002
-- Name: dispute_system_improvements
-- Created: 2026-03-20
-- Safe to re-run: YES (IF NOT EXISTS / DO blocks)
-- Purpose: Add priority field for late disputes (anti-fraud detection),
--          add admin_note for resolution, add resolved_by for audit trail

-- 1. Add priority to disputes (normal | high | fraud_flag)
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2. Add admin_note (admin writes resolution reasoning)
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN admin_note TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. Add resolved_by (which admin resolved it)
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN resolved_by INT REFERENCES users(user_id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 4. Add resolved_at timestamp
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN resolved_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 5. Add resolution_action: 'refund_buyer' | 'release_seller' | 'partial'
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN resolution_action VARCHAR(30);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 6. Add CHECK constraint on priority values
DO $$ BEGIN
  ALTER TABLE disputes ADD CONSTRAINT disputes_priority_check
    CHECK (priority IN ('normal', 'high', 'fraud_flag'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Index for admin dashboard (sort by priority + status)
CREATE INDEX IF NOT EXISTS idx_disputes_priority ON disputes(priority, status);
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes(created_at DESC);

-- 8. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME env if missing (doc comment only)
-- Cloudinary unsigned upload preset 'marketplace_evidence' must be created manually:
-- Dashboard → Settings → Upload → Add unsigned preset → name: marketplace_evidence

SELECT 'Migration 002 applied: dispute_system_improvements' AS result;
