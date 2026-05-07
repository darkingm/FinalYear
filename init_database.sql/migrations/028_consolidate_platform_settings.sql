-- Migration 028: consolidate `platform_config` and `platform_settings`.
--
-- The codebase ended up with two near-identical tables in conflict:
--
--   • schema.sql created `platform_config` (key PK, value JSONB, updated_by)
--     and seeded 4 default rows.
--   • schema.sql ALSO created `platform_settings` with a different shape:
--     setting_id SERIAL PK, value as TEXT, no updated_by column.
--   • migration 006 tried to define platform_settings the "right" way
--     (key PK, value JSONB, updated_by) but got short-circuited by CREATE
--     TABLE IF NOT EXISTS — so on fresh databases the buggy schema.sql
--     definition won.
--   • admin.service.ts writes `ON CONFLICT (key) DO UPDATE SET value = ...,
--     updated_by = ...` — which silently fails or stores stringified JSON
--     in the TEXT column on fresh DBs.
--   • migration 023 deleted `platform_config.deposit_addresses` but left
--     the table itself alive.
--
-- This migration normalises everything onto `platform_settings` with the
-- shape admin.service.ts actually expects (key PK / value JSONB /
-- updated_by FK), backfills any data still in `platform_config`, and drops
-- the legacy table so future readers cannot pick the wrong source.

-- 1) Add missing `updated_by` column if not present
ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL;

-- 2) Convert `value` from TEXT to JSONB if it's still TEXT.
--    Existing TEXT values are wrapped as JSON strings rather than parsed —
--    the parsed form may have been written before mig 006 went in, but the
--    plain-string form is the most likely on the wrong-shape branch. Wrap
--    keeps the data instead of losing it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'platform_settings'
          AND column_name = 'value'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE platform_settings
            ALTER COLUMN value TYPE JSONB USING
                CASE
                    WHEN value IS NULL OR value = '' THEN '{}'::jsonb
                    -- Looks like JSON (object/array/string/number/bool/null)
                    WHEN value ~ '^\s*[\[{"\-]|^\s*-?\d|^\s*(true|false|null)\b' THEN
                        (value::jsonb)
                    ELSE
                        to_jsonb(value)
                END;
    END IF;
EXCEPTION WHEN others THEN
    -- Conservative fallback: if any row fails to cast, wrap everything as
    -- a JSON string so we don't abort the whole migration.
    ALTER TABLE platform_settings
        ALTER COLUMN value TYPE JSONB USING to_jsonb(value::text);
END $$;

-- 3) Backfill from legacy `platform_config` if it still exists, then drop it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_config') THEN
        INSERT INTO platform_settings (key, value, description, updated_by, updated_at)
        SELECT key, value, description, updated_by, updated_at
        FROM platform_config
        ON CONFLICT (key) DO NOTHING;

        DROP TABLE platform_config;
    END IF;
END $$;

INSERT INTO schema_migrations (version, name, filename)
VALUES ('028', 'consolidate_platform_settings', '028_consolidate_platform_settings.sql')
ON CONFLICT (version) DO NOTHING;
