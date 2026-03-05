-- =====================================================
-- SECTION 13: MERGE USER AND SELLER ROLES
-- =====================================================

-- 1. Make seller_profiles columns flexible since all users get one
ALTER TABLE seller_profiles ALTER COLUMN payout_wallet DROP NOT NULL;
ALTER TABLE seller_profiles ALTER COLUMN display_name DROP NOT NULL;

-- 2. Auto-provision seller profile for ALL existing users
INSERT INTO seller_profiles (user_id, display_name, payout_wallet, kyc_status)
SELECT user_id, COALESCE(username, email, 'User ' || user_id), wallet_address, 'verified'
FROM users
WHERE user_id NOT IN (SELECT user_id FROM seller_profiles);

-- 3. Create a trigger to automatically create a seller profile whenever a new user registers
CREATE OR REPLACE FUNCTION auto_create_seller_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO seller_profiles (user_id, display_name, payout_wallet, kyc_status)
    VALUES (NEW.user_id, COALESCE(NEW.username, NEW.email, 'User'), NEW.wallet_address, 'verified');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_seller_profile ON users;
CREATE TRIGGER trigger_auto_create_seller_profile
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION auto_create_seller_profile();

-- 4. Update all existing buyers to have the 'seller' role (since everyone can sell)
UPDATE users SET role = 'seller' WHERE role = 'buyer';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'seller';
