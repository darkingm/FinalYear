-- ============================================================================
-- Migration 023: Drop custodial deposit feature
-- ============================================================================
-- Background: migrations 021 + 022 introduced a custodial deposit flow
-- (wallet_deposit_intents, deposit_indexer_state, intent_id on wallet_deposits,
-- platform_config.deposit_addresses) which conflicted with the project's
-- existing non-custodial EscrowCore architecture.
--
-- This migration cleanly removes all of those changes. Idempotent.
-- ============================================================================

-- 1) Drop FK + column on wallet_deposits
ALTER TABLE wallet_deposits DROP CONSTRAINT IF EXISTS fk_wallet_deposits_intent;
DROP INDEX IF EXISTS idx_wallet_deposits_intent;
ALTER TABLE wallet_deposits DROP COLUMN IF EXISTS intent_id;

-- 2) Restore NOT NULL on user_id (only if no NULL rows)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM wallet_deposits WHERE user_id IS NULL) THEN
        BEGIN
            ALTER TABLE wallet_deposits ALTER COLUMN user_id SET NOT NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Already NOT NULL or other safe-to-ignore condition
            NULL;
        END;
    END IF;
END $$;

-- 3) Drop the custodial-specific tables
DROP TABLE IF EXISTS wallet_deposit_intents CASCADE;
DROP TABLE IF EXISTS deposit_indexer_state CASCADE;

-- 4) Remove platform_config.deposit_addresses (only used by custodial flow)
DELETE FROM platform_config WHERE key = 'deposit_addresses';

SELECT 'Migration 023 applied: dropped custodial deposit feature' AS result;
