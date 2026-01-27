-- ========================================
-- PARTITIONING SETUP (OPTIONAL)
-- For high-volume production environments
-- Run this AFTER your system has significant data
-- ========================================

\c ecommerce_db;

-- ========================================
-- 1. Partition Orders Table by Month
-- ========================================

-- This is an OPTIONAL optimization for systems with millions of orders
-- Only implement when you have 100K+ orders per month

/*
-- Step 1: Create partitioned table
CREATE TABLE orders_partitioned (
    LIKE orders INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Step 2: Create partitions for each month (example for 2025)
CREATE TABLE orders_2025_01 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE orders_2025_02 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE orders_2025_03 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Continue for all months...

-- Step 3: Migrate data from old table to partitioned table
INSERT INTO orders_partitioned SELECT * FROM orders;

-- Step 4: Rename tables (CAREFUL!)
ALTER TABLE orders RENAME TO orders_old;
ALTER TABLE orders_partitioned RENAME TO orders;

-- Step 5: Update sequences
SELECT setval('orders_order_id_seq', (SELECT MAX(order_id) FROM orders));
*/

-- ========================================
-- 2. Auto-create Monthly Partitions
-- ========================================

-- Function to automatically create next month's partition
CREATE OR REPLACE FUNCTION create_monthly_order_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    -- Calculate next month
    partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name := 'orders_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := partition_date::TEXT;
    end_date := (partition_date + INTERVAL '1 month')::TEXT;
    
    -- Create partition if it doesn't exist
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF orders
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
    
    RAISE NOTICE 'Created partition % for period % to %', partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

-- Schedule this function to run monthly via pg_cron or external scheduler
-- Example: SELECT cron.schedule('create-monthly-partition', '0 0 1 * *', 'SELECT create_monthly_order_partition()');

-- ========================================
-- 3. Partition Inventory Log (High Write Volume)
-- ========================================

/*
-- Only if inventory_log grows beyond 10M rows

CREATE TABLE inventory_log_partitioned (
    LIKE inventory_log INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE inventory_log_2025_01 PARTITION OF inventory_log_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Continue for other months...

-- Migrate data
INSERT INTO inventory_log_partitioned SELECT * FROM inventory_log;

-- Swap tables
ALTER TABLE inventory_log RENAME TO inventory_log_old;
ALTER TABLE inventory_log_partitioned RENAME TO inventory_log;
*/

-- ========================================
-- 4. Partition Crypto Transactions
-- ========================================

/*
CREATE TABLE crypto_transactions_partitioned (
    LIKE crypto_transactions INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE crypto_transactions_2025_01 PARTITION OF crypto_transactions_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Continue...
*/

-- ========================================
-- 5. Archive Old Data
-- ========================================

-- Create archive tables for old data
CREATE TABLE IF NOT EXISTS orders_archive (
    LIKE orders INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS order_items_archive (
    LIKE order_items INCLUDING ALL
);

-- Function to archive old orders (older than 2 years)
CREATE OR REPLACE FUNCTION archive_old_orders()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Archive orders
    WITH archived AS (
        DELETE FROM orders
        WHERE created_at < CURRENT_DATE - INTERVAL '2 years'
        AND status IN ('delivered', 'cancelled')
        RETURNING *
    )
    INSERT INTO orders_archive SELECT * FROM archived;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Archive order items
    INSERT INTO order_items_archive 
    SELECT oi.* FROM order_items oi
    WHERE NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.order_id = oi.order_id
    );
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Run archival: SELECT archive_old_orders();

-- ========================================
-- 6. Cleanup Old Notifications
-- ========================================

-- Function to delete old read notifications (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE is_read = TRUE
    AND read_at < CURRENT_DATE - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Run cleanup: SELECT cleanup_old_notifications();

-- ========================================
-- 7. Cleanup Expired Crypto Payments
-- ========================================

CREATE OR REPLACE FUNCTION cleanup_expired_crypto_payments()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE crypto_payments
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Run cleanup: SELECT cleanup_expired_crypto_payments();

-- ========================================
-- 8. Maintenance Jobs (Setup with pg_cron)
-- ========================================

/*
-- Install pg_cron extension first
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule monthly partition creation (1st day of month at midnight)
SELECT cron.schedule(
    'create-monthly-partitions',
    '0 0 1 * *',
    'SELECT create_monthly_order_partition()'
);

-- Schedule daily notification cleanup (every day at 2 AM)
SELECT cron.schedule(
    'cleanup-notifications',
    '0 2 * * *',
    'SELECT cleanup_old_notifications()'
);

-- Schedule hourly crypto payment expiry check
SELECT cron.schedule(
    'expire-crypto-payments',
    '0 * * * *',
    'SELECT cleanup_expired_crypto_payments()'
);

-- Schedule quarterly order archival (1st day of quarter at 3 AM)
SELECT cron.schedule(
    'archive-old-orders',
    '0 3 1 1,4,7,10 *',
    'SELECT archive_old_orders()'
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Remove a job
-- SELECT cron.unschedule('job-name');
*/

\echo '✅ Partitioning Setup Complete (Optional)'
\echo '📊 Available Functions:'
\echo '  - create_monthly_order_partition() - Create next month partition'
\echo '  - archive_old_orders() - Archive orders older than 2 years'
\echo '  - cleanup_old_notifications() - Delete old read notifications'
\echo '  - cleanup_expired_crypto_payments() - Expire old pending payments'
\echo ''
\echo '⚠️  IMPORTANT:'
\echo '  - Only implement partitioning when you have 100K+ orders/month'
\echo '  - Test partition migration on staging first'
\echo '  - Schedule maintenance jobs with pg_cron or external scheduler'
\echo '  - Monitor partition sizes and adjust retention policies'
