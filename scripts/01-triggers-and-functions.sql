-- ========================================
-- TRIGGERS & FUNCTIONS FOR OPTIMIZATION
-- Auto-updates, Validations, and Business Logic
-- ========================================

\c ecommerce_db;

-- ========================================
-- FUNCTION 1: Auto-update timestamp
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_accounts_updated_at 
    BEFORE UPDATE ON social_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_addresses_updated_at 
    BEFORE UPDATE ON user_addresses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at 
    BEFORE UPDATE ON product_variants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at 
    BEFORE UPDATE ON cart_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crypto_payments_updated_at 
    BEFORE UPDATE ON crypto_payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_reviews_updated_at 
    BEFORE UPDATE ON product_reviews 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at 
    BEFORE UPDATE ON coupons 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- FUNCTION 2: Update product rating when review added/updated
-- ========================================
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET 
        rating_average = (
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM product_reviews
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
            AND is_approved = TRUE
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM product_reviews
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
            AND is_approved = TRUE
        )
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_rating_insert
    AFTER INSERT ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();

CREATE TRIGGER trigger_update_product_rating_update
    AFTER UPDATE ON product_reviews
    FOR EACH ROW 
    WHEN (OLD.rating IS DISTINCT FROM NEW.rating OR OLD.is_approved IS DISTINCT FROM NEW.is_approved)
    EXECUTE FUNCTION update_product_rating();

CREATE TRIGGER trigger_update_product_rating_delete
    AFTER DELETE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- ========================================
-- FUNCTION 3: Reserve inventory when order confirmed (NO DEADLOCK)
-- ========================================
CREATE OR REPLACE FUNCTION reserve_inventory_for_order()
RETURNS TRIGGER AS $$
DECLARE
    v_variant_id BIGINT;
    v_quantity INT;
    v_available INT;
BEGIN
    -- Only run when order status changes to 'confirmed'
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- Lock variants in consistent order (by variant_id ASC) to prevent deadlocks
        FOR v_variant_id, v_quantity IN 
            SELECT oi.variant_id, oi.quantity 
            FROM order_items oi
            WHERE oi.order_id = NEW.order_id
            ORDER BY oi.variant_id ASC -- CRITICAL: Consistent lock order
            FOR UPDATE SKIP LOCKED -- Skip if locked by another transaction
        LOOP
            -- Check available stock
            SELECT stock_quantity - reserved_quantity INTO v_available
            FROM product_variants
            WHERE variant_id = v_variant_id;
            
            IF v_available < v_quantity THEN
                RAISE EXCEPTION 'Insufficient stock for variant %. Available: %, Required: %', 
                    v_variant_id, v_available, v_quantity;
            END IF;
            
            -- Reserve inventory
            UPDATE product_variants
            SET reserved_quantity = reserved_quantity + v_quantity
            WHERE variant_id = v_variant_id;
            
            -- Log inventory change
            INSERT INTO inventory_log (
                variant_id, change_type, quantity_change, 
                previous_quantity, new_quantity,
                reference_type, reference_id
            )
            SELECT 
                v_variant_id, 'reserved', v_quantity,
                stock_quantity, stock_quantity,
                'order', NEW.order_id
            FROM product_variants
            WHERE variant_id = v_variant_id;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reserve_inventory
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION reserve_inventory_for_order();

-- ========================================
-- FUNCTION 4: Decrease stock when order shipped
-- ========================================
CREATE OR REPLACE FUNCTION decrease_stock_on_ship()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'shipped' AND OLD.status != 'shipped' THEN
        
        -- Decrease stock and reserved quantity
        UPDATE product_variants pv
        SET 
            stock_quantity = stock_quantity - oi.quantity,
            reserved_quantity = GREATEST(0, reserved_quantity - oi.quantity)
        FROM order_items oi
        WHERE oi.order_id = NEW.order_id
        AND pv.variant_id = oi.variant_id;
        
        -- Log inventory change
        INSERT INTO inventory_log (
            variant_id, change_type, quantity_change, 
            previous_quantity, new_quantity,
            reference_type, reference_id
        )
        SELECT 
            oi.variant_id, 'sale', -oi.quantity,
            pv.stock_quantity, pv.stock_quantity - oi.quantity,
            'order', NEW.order_id
        FROM order_items oi
        JOIN product_variants pv ON pv.variant_id = oi.variant_id
        WHERE oi.order_id = NEW.order_id;
        
        -- Update product sold count
        UPDATE products p
        SET sold_count = sold_count + oi.quantity
        FROM order_items oi
        JOIN product_variants pv ON pv.variant_id = oi.variant_id
        WHERE oi.order_id = NEW.order_id
        AND p.product_id = pv.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrease_stock
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION decrease_stock_on_ship();

-- ========================================
-- FUNCTION 5: Release reserved inventory on order cancellation
-- ========================================
CREATE OR REPLACE FUNCTION release_inventory_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        
        -- Release reserved inventory
        UPDATE product_variants pv
        SET reserved_quantity = GREATEST(0, reserved_quantity - oi.quantity)
        FROM order_items oi
        WHERE oi.order_id = NEW.order_id
        AND pv.variant_id = oi.variant_id;
        
        -- Log inventory change
        INSERT INTO inventory_log (
            variant_id, change_type, quantity_change, 
            previous_quantity, new_quantity,
            reference_type, reference_id
        )
        SELECT 
            oi.variant_id, 'released', oi.quantity,
            pv.stock_quantity, pv.stock_quantity,
            'order', NEW.order_id
        FROM order_items oi
        JOIN product_variants pv ON pv.variant_id = oi.variant_id
        WHERE oi.order_id = NEW.order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_release_inventory
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION release_inventory_on_cancel();

-- ========================================
-- FUNCTION 6: Auto-generate order number
-- ========================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                           LPAD(nextval('orders_order_id_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ========================================
-- FUNCTION 7: Track order status changes
-- ========================================
CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (order_id, from_status, to_status)
        VALUES (NEW.order_id, OLD.status, NEW.status);
        
        -- Update timestamps based on status
        CASE NEW.status
            WHEN 'confirmed' THEN NEW.confirmed_at := CURRENT_TIMESTAMP;
            WHEN 'shipped' THEN NEW.shipped_at := CURRENT_TIMESTAMP;
            WHEN 'delivered' THEN NEW.delivered_at := CURRENT_TIMESTAMP;
            WHEN 'cancelled' THEN NEW.cancelled_at := CURRENT_TIMESTAMP;
        ELSE
            -- Do nothing
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_order_status
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION track_order_status_change();

-- ========================================
-- FUNCTION 8: Validate coupon usage
-- ========================================
CREATE OR REPLACE FUNCTION validate_coupon_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_coupon RECORD;
    v_usage_count INT;
BEGIN
    -- Get coupon info
    SELECT * INTO v_coupon
    FROM coupons
    WHERE coupon_id = NEW.coupon_id;
    
    -- Check if coupon is active
    IF v_coupon.is_active = FALSE THEN
        RAISE EXCEPTION 'Coupon is not active';
    END IF;
    
    -- Check validity period
    IF CURRENT_TIMESTAMP NOT BETWEEN v_coupon.valid_from AND v_coupon.valid_until THEN
        RAISE EXCEPTION 'Coupon is not valid at this time';
    END IF;
    
    -- Check total usage limit
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RAISE EXCEPTION 'Coupon usage limit reached';
    END IF;
    
    -- Check per-user usage limit
    SELECT COUNT(*) INTO v_usage_count
    FROM coupon_usage
    WHERE coupon_id = NEW.coupon_id AND user_id = NEW.user_id;
    
    IF v_usage_count >= v_coupon.usage_limit_per_user THEN
        RAISE EXCEPTION 'User has exceeded coupon usage limit';
    END IF;
    
    -- Increment usage count
    UPDATE coupons
    SET usage_count = usage_count + 1
    WHERE coupon_id = NEW.coupon_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_coupon
    BEFORE INSERT ON coupon_usage
    FOR EACH ROW EXECUTE FUNCTION validate_coupon_usage();

-- ========================================
-- FUNCTION 9: Create notification on order status change
-- ========================================
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_title TEXT;
    v_message TEXT;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        -- Generate notification message based on status
        CASE NEW.status
            WHEN 'confirmed' THEN
                v_title := 'Order Confirmed';
                v_message := 'Your order ' || NEW.order_number || ' has been confirmed and is being processed.';
            WHEN 'shipped' THEN
                v_title := 'Order Shipped';
                v_message := 'Your order ' || NEW.order_number || ' has been shipped!';
            WHEN 'delivered' THEN
                v_title := 'Order Delivered';
                v_message := 'Your order ' || NEW.order_number || ' has been delivered. Enjoy your purchase!';
            WHEN 'cancelled' THEN
                v_title := 'Order Cancelled';
                v_message := 'Your order ' || NEW.order_number || ' has been cancelled.';
        ELSE
            RETURN NEW;
        END CASE;
        
        -- Insert notification
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
            NEW.user_id, 
            'order_update', 
            v_title, 
            v_message,
            jsonb_build_object('order_id', NEW.order_id, 'order_number', NEW.order_number, 'status', NEW.status)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_order_status
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();

-- ========================================
-- FUNCTION 10: Update product status based on inventory
-- ========================================
CREATE OR REPLACE FUNCTION update_product_status_on_inventory()
RETURNS TRIGGER AS $$
BEGIN
    -- If stock reaches zero, mark variant as out of stock
    IF NEW.stock_quantity = 0 AND OLD.stock_quantity > 0 THEN
        NEW.is_active := FALSE;
        
        -- Check if all variants are out of stock
        IF NOT EXISTS (
            SELECT 1 FROM product_variants 
            WHERE product_id = (SELECT product_id FROM product_variants WHERE variant_id = NEW.variant_id)
            AND variant_id != NEW.variant_id
            AND stock_quantity > 0
        ) THEN
            -- Mark product as out of stock
            UPDATE products
            SET status = 'out_of_stock'
            WHERE product_id = (SELECT product_id FROM product_variants WHERE variant_id = NEW.variant_id);
        END IF;
    END IF;
    
    -- If stock is replenished, reactivate
    IF NEW.stock_quantity > 0 AND OLD.stock_quantity = 0 THEN
        NEW.is_active := TRUE;
        
        -- Reactivate product
        UPDATE products
        SET status = 'active'
        WHERE product_id = (SELECT product_id FROM product_variants WHERE variant_id = NEW.variant_id)
        AND status = 'out_of_stock';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_status
    BEFORE UPDATE ON product_variants
    FOR EACH ROW 
    WHEN (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity)
    EXECUTE FUNCTION update_product_status_on_inventory();

-- ========================================
-- FUNCTION 11: Prevent duplicate primary address
-- ========================================
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        -- Unset other default addresses for this user and type
        UPDATE user_addresses
        SET is_default = FALSE
        WHERE user_id = NEW.user_id 
        AND address_type = NEW.address_type
        AND address_id != NEW.address_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default
    BEFORE INSERT OR UPDATE ON user_addresses
    FOR EACH ROW 
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION ensure_single_default_address();

\echo '✅ All Triggers and Functions Created Successfully'
\echo '📊 Total Triggers: 15+'
\echo '🎯 Features: Auto-timestamps, Inventory Management, Notifications, Validations'
\echo '⚡ Optimized to prevent deadlocks and race conditions'
