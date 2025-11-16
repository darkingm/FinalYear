-- Create UserProfile table
CREATE TABLE IF NOT EXISTS "UserProfiles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE,
    "username" VARCHAR(255) NOT NULL UNIQUE,
    "fullName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "phoneNumber" VARCHAR(20),
    "bio" TEXT,
    "avatarUrl" VARCHAR(255),
    "dateOfBirth" DATE,
    "address" TEXT,
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "joinDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP WITH TIME ZONE,
    "socialLinks" JSONB DEFAULT '{}',
    "preferences" JSONB DEFAULT '{}',
    "showCoinBalance" BOOLEAN DEFAULT true,
    "showJoinDate" BOOLEAN DEFAULT true,
    "showEmail" BOOLEAN DEFAULT false,
    "showPhone" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create SellerApplication table
CREATE TABLE IF NOT EXISTS "SellerApplications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "shopName" VARCHAR(100) NOT NULL,
    "shopDescription" TEXT NOT NULL,
    "businessType" VARCHAR(50) NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(100) NOT NULL,
    "bankAccountNumber" VARCHAR(50) NOT NULL,
    "bankAccountName" VARCHAR(100) NOT NULL,
    "documents" JSONB DEFAULT '[]',
    "rejectionReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_user_profiles_user_id" ON "UserProfiles"("userId");
CREATE INDEX IF NOT EXISTS "idx_user_profiles_username" ON "UserProfiles"("username");
CREATE INDEX IF NOT EXISTS "idx_user_profiles_email" ON "UserProfiles"("email");
CREATE INDEX IF NOT EXISTS "idx_seller_applications_user_id" ON "SellerApplications"("userId");
CREATE INDEX IF NOT EXISTS "idx_seller_applications_status" ON "SellerApplications"("status");

-- Create trigger to update updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON "UserProfiles"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_seller_applications_updated_at
    BEFORE UPDATE ON "SellerApplications"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();