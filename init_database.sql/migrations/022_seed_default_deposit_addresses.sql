-- ============================================================================
-- Migration 022: Seed default Hardhat deposit address into platform_config
-- ============================================================================
-- Issue: migration 021 only seeded `deposit_addresses` when the row did not
-- exist. On databases where `platform_config.deposit_addresses` already
-- existed (with value `{}`), the seed was skipped, leaving the deposit
-- indexer with no platform address to scan against on Hardhat.
--
-- This migration fixes that by merging the default Hardhat address into the
-- existing JSONB value when the `31337` key is missing.
--
-- Idempotent: running this multiple times produces the same result.
-- ============================================================================

DO $$
DECLARE
    cfg JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_config') THEN
        RETURN;
    END IF;

    SELECT value INTO cfg FROM platform_config WHERE key = 'deposit_addresses';

    IF cfg IS NULL THEN
        INSERT INTO platform_config (key, value, description)
        VALUES (
            'deposit_addresses',
            '{"31337": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}'::jsonb,
            'Per-chain platform deposit addresses (chain_id -> address)'
        )
        ON CONFLICT (key) DO NOTHING;
    ELSIF NOT (cfg ? '31337') THEN
        UPDATE platform_config
           SET value = value || '{"31337": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}'::jsonb,
               updated_at = NOW()
         WHERE key = 'deposit_addresses';
    END IF;
END $$;

SELECT 'Migration 022 applied: seed_default_deposit_addresses' AS result;
