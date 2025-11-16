-- ========================================
-- TokenAsset Complete Database Schema
-- 60 Sample Users (15 per role) + Full Sample Data
-- ========================================

\c postgres

DROP DATABASE IF EXISTS auth_db;
DROP DATABASE IF EXISTS user_db;
DROP DATABASE IF EXISTS order_db;

CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE order_db;

\echo '✅ Databases created'

-- ========================================
-- AUTH DATABASE
-- ========================================
\c auth_db

DROP TABLE IF EXISTS "RefreshTokens" CASCADE;
DROP TABLE IF EXISTS "OAuthProviders" CASCADE;
DROP TABLE IF EXISTS "OTP" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;

CREATE TABLE "Users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "username" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255),
    "fullName" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "lastLoginAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OTP" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT FALSE,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RefreshTokens" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdByIp" VARCHAR(45),
    "revokedAt" TIMESTAMP WITH TIME ZONE,
    "revokedByIp" VARCHAR(45),
    "replacedByToken" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OAuthProviders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "provider" VARCHAR(20) NOT NULL,
    "providerId" VARCHAR(255) NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "profile" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("provider", "providerId")
);

CREATE INDEX "idx_users_email" ON "Users"("email");
CREATE INDEX "idx_users_username" ON "Users"("username");
CREATE INDEX "idx_users_role" ON "Users"("role");
CREATE INDEX "idx_otp_email" ON "OTP"("email");
CREATE INDEX "idx_refresh_tokens_user" ON "RefreshTokens"("userId");
CREATE INDEX "idx_oauth_user" ON "OAuthProviders"("userId");

-- Password hash for "Password123!" = $2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3
-- Insert 15 ADMIN users
INSERT INTO "Users" ("id", "email", "username", "password", "fullName", "role", "isEmailVerified") VALUES
('a0000000-0000-0000-0000-000000000001', 'admin1@tokenasset.com', 'admin1', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin One', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000002', 'admin2@tokenasset.com', 'admin2', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Two', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000003', 'admin3@tokenasset.com', 'admin3', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Three', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000004', 'admin4@tokenasset.com', 'admin4', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Four', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000005', 'admin5@tokenasset.com', 'admin5', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Five', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000006', 'admin6@tokenasset.com', 'admin6', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Six', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000007', 'admin7@tokenasset.com', 'admin7', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Seven', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000008', 'admin8@tokenasset.com', 'admin8', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Eight', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000009', 'admin9@tokenasset.com', 'admin9', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Nine', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000010', 'admin10@tokenasset.com', 'admin10', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Ten', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000011', 'admin11@tokenasset.com', 'admin11', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Eleven', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000012', 'admin12@tokenasset.com', 'admin12', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Twelve', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000013', 'admin13@tokenasset.com', 'admin13', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Thirteen', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000014', 'admin14@tokenasset.com', 'admin14', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Fourteen', 'ADMIN', TRUE),
('a0000000-0000-0000-0000-000000000015', 'admin15@tokenasset.com', 'admin15', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Fifteen', 'ADMIN', TRUE);

-- Insert 15 SUPPORT users
INSERT INTO "Users" ("id", "email", "username", "password", "fullName", "role", "isEmailVerified") VALUES
('s0000000-0000-0000-0000-000000000001', 'support1@tokenasset.com', 'support1', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support One', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000002', 'support2@tokenasset.com', 'support2', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Two', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000003', 'support3@tokenasset.com', 'support3', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Three', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000004', 'support4@tokenasset.com', 'support4', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Four', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000005', 'support5@tokenasset.com', 'support5', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Five', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000006', 'support6@tokenasset.com', 'support6', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Six', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000007', 'support7@tokenasset.com', 'support7', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Seven', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000008', 'support8@tokenasset.com', 'support8', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Eight', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000009', 'support9@tokenasset.com', 'support9', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Nine', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000010', 'support10@tokenasset.com', 'support10', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Ten', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000011', 'support11@tokenasset.com', 'support11', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Eleven', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000012', 'support12@tokenasset.com', 'support12', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Twelve', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000013', 'support13@tokenasset.com', 'support13', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Thirteen', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000014', 'support14@tokenasset.com', 'support14', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Fourteen', 'SUPPORT', TRUE),
('s0000000-0000-0000-0000-000000000015', 'support15@tokenasset.com', 'support15', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Support Fifteen', 'SUPPORT', TRUE);

-- Insert 15 SELLER users (USER role but isSeller = true)
INSERT INTO "Users" ("id", "email", "username", "password", "fullName", "role", "isEmailVerified") VALUES
('e0000000-0000-0000-0000-000000000001', 'seller1@tokenasset.com', 'seller1', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller One', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000002', 'seller2@tokenasset.com', 'seller2', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Two', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000003', 'seller3@tokenasset.com', 'seller3', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Three', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000004', 'seller4@tokenasset.com', 'seller4', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Four', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000005', 'seller5@tokenasset.com', 'seller5', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Five', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000006', 'seller6@tokenasset.com', 'seller6', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Six', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000007', 'seller7@tokenasset.com', 'seller7', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Seven', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000008', 'seller8@tokenasset.com', 'seller8', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Eight', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000009', 'seller9@tokenasset.com', 'seller9', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Nine', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000010', 'seller10@tokenasset.com', 'seller10', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Ten', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000011', 'seller11@tokenasset.com', 'seller11', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Eleven', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000012', 'seller12@tokenasset.com', 'seller12', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Twelve', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000013', 'seller13@tokenasset.com', 'seller13', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Thirteen', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000014', 'seller14@tokenasset.com', 'seller14', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Fourteen', 'USER', TRUE),
('e0000000-0000-0000-0000-000000000015', 'seller15@tokenasset.com', 'seller15', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Seller Fifteen', 'USER', TRUE);

-- Insert 15 REGULAR USER users
INSERT INTO "Users" ("id", "email", "username", "password", "fullName", "role", "isEmailVerified") VALUES
('u0000000-0000-0000-0000-000000000001', 'user1@tokenasset.com', 'user1', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User One', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000002', 'user2@tokenasset.com', 'user2', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Two', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000003', 'user3@tokenasset.com', 'user3', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Three', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000004', 'user4@tokenasset.com', 'user4', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Four', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000005', 'user5@tokenasset.com', 'user5', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Five', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000006', 'user6@tokenasset.com', 'user6', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Six', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000007', 'user7@tokenasset.com', 'user7', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Seven', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000008', 'user8@tokenasset.com', 'user8', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Eight', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000009', 'user9@tokenasset.com', 'user9', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Nine', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000010', 'user10@tokenasset.com', 'user10', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Ten', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000011', 'user11@tokenasset.com', 'user11', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Eleven', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000012', 'user12@tokenasset.com', 'user12', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Twelve', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000013', 'user13@tokenasset.com', 'user13', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Thirteen', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000014', 'user14@tokenasset.com', 'user14', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Fourteen', 'USER', TRUE),
('u0000000-0000-0000-0000-000000000015', 'user15@tokenasset.com', 'user15', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'User Fifteen', 'USER', TRUE);

\echo '✅ Auth database: 60 users created (15 per role)'
\echo 'Password for all users: Password123!'

-- ========================================
-- USER DATABASE
-- ========================================
\c user_db

DROP TABLE IF EXISTS "Transactions" CASCADE;
DROP TABLE IF EXISTS "Wallets" CASCADE;
DROP TABLE IF EXISTS "FavoriteProducts" CASCADE;
DROP TABLE IF EXISTS "UserProfiles" CASCADE;

CREATE TABLE "UserProfiles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID UNIQUE NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "phone" VARCHAR(20),
    "dateOfBirth" DATE,
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "address" TEXT,
    "isSeller" BOOLEAN NOT NULL DEFAULT FALSE,
    "sellerVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "shopName" VARCHAR(255),
    "shopDescription" TEXT,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalPurchases" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "showCoinBalance" BOOLEAN NOT NULL DEFAULT TRUE,
    "showJoinDate" BOOLEAN NOT NULL DEFAULT TRUE,
    "showEmail" BOOLEAN NOT NULL DEFAULT FALSE,
    "showPhone" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Wallets" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "coinSymbol" VARCHAR(10) NOT NULL,
    "balance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "walletAddress" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "coinSymbol")
);

CREATE TABLE "Transactions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "coinSymbol" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "fromAddress" VARCHAR(255),
    "toAddress" VARCHAR(255),
    "txHash" VARCHAR(255),
    "description" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "FavoriteProducts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "productId" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "productId")
);

CREATE INDEX "idx_user_profiles_user" ON "UserProfiles"("userId");
CREATE INDEX "idx_user_profiles_seller" ON "UserProfiles"("isSeller");
CREATE INDEX "idx_wallets_user" ON "Wallets"("userId");
CREATE INDEX "idx_wallets_coin" ON "Wallets"("coinSymbol");
CREATE INDEX "idx_transactions_user" ON "Transactions"("userId");
CREATE INDEX "idx_transactions_status" ON "Transactions"("status");
CREATE INDEX "idx_favorite_products_user" ON "FavoriteProducts"("userId");

-- Insert 60 UserProfiles (1 per user)
INSERT INTO "UserProfiles" ("userId", "isSeller", "sellerVerified", "shopName", "shopDescription", "rating", "totalSales", "totalPurchases", "bio", "country", "city", "avatar") VALUES
-- 15 ADMIN profiles
('a0000000-0000-0000-0000-000000000001', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'USA', 'New York', 'https://ui-avatars.com/api/?name=Admin+One&background=6366f1'),
('a0000000-0000-0000-0000-000000000002', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'USA', 'Los Angeles', 'https://ui-avatars.com/api/?name=Admin+Two&background=6366f1'),
('a0000000-0000-0000-0000-000000000003', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'UK', 'London', 'https://ui-avatars.com/api/?name=Admin+Three&background=6366f1'),
('a0000000-0000-0000-0000-000000000004', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'Germany', 'Berlin', 'https://ui-avatars.com/api/?name=Admin+Four&background=6366f1'),
('a0000000-0000-0000-0000-000000000005', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'France', 'Paris', 'https://ui-avatars.com/api/?name=Admin+Five&background=6366f1'),
('a0000000-0000-0000-0000-000000000006', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'Japan', 'Tokyo', 'https://ui-avatars.com/api/?name=Admin+Six&background=6366f1'),
('a0000000-0000-0000-0000-000000000007', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'Singapore', 'Singapore', 'https://ui-avatars.com/api/?name=Admin+Seven&background=6366f1'),
('a0000000-0000-0000-0000-000000000008', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'Australia', 'Sydney', 'https://ui-avatars.com/api/?name=Admin+Eight&background=6366f1'),
('a0000000-0000-0000-0000-000000000009', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'Canada', 'Toronto', 'https://ui-avatars.com/api/?name=Admin+Nine&background=6366f1'),
('a0000000-0000-0000-0000-000000000010', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'Brazil', 'Sao Paulo', 'https://ui-avatars.com/api/?name=Admin+Ten&background=6366f1'),
('a0000000-0000-0000-0000-000000000011', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'India', 'Mumbai', 'https://ui-avatars.com/api/?name=Admin+Eleven&background=6366f1'),
('a0000000-0000-0000-0000-000000000012', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'China', 'Beijing', 'https://ui-avatars.com/api/?name=Admin+Twelve&background=6366f1'),
('a0000000-0000-0000-0000-000000000013', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'South Korea', 'Seoul', 'https://ui-avatars.com/api/?name=Admin+Thirteen&background=6366f1'),
('a0000000-0000-0000-0000-000000000014', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'UAE', 'Dubai', 'https://ui-avatars.com/api/?name=Admin+Fourteen&background=6366f1'),
('a0000000-0000-0000-0000-000000000015', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'System Administrator', 'Vietnam', 'Ho Chi Minh', 'https://ui-avatars.com/api/?name=Admin+Fifteen&background=6366f1'),
-- 15 SUPPORT profiles
('s0000000-0000-0000-0000-000000000001', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'USA', 'New York', 'https://ui-avatars.com/api/?name=Support+One&background=10b981'),
('s0000000-0000-0000-0000-000000000002', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'USA', 'Chicago', 'https://ui-avatars.com/api/?name=Support+Two&background=10b981'),
('s0000000-0000-0000-0000-000000000003', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'UK', 'Manchester', 'https://ui-avatars.com/api/?name=Support+Three&background=10b981'),
('s0000000-0000-0000-0000-000000000004', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'Germany', 'Munich', 'https://ui-avatars.com/api/?name=Support+Four&background=10b981'),
('s0000000-0000-0000-0000-000000000005', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'France', 'Lyon', 'https://ui-avatars.com/api/?name=Support+Five&background=10b981'),
('s0000000-0000-0000-0000-000000000006', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'Japan', 'Osaka', 'https://ui-avatars.com/api/?name=Support+Six&background=10b981'),
('s0000000-0000-0000-0000-000000000007', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'Singapore', 'Singapore', 'https://ui-avatars.com/api/?name=Support+Seven&background=10b981'),
('s0000000-0000-0000-0000-000000000008', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'Australia', 'Melbourne', 'https://ui-avatars.com/api/?name=Support+Eight&background=10b981'),
('s0000000-0000-0000-0000-000000000009', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'Canada', 'Vancouver', 'https://ui-avatars.com/api/?name=Support+Nine&background=10b981'),
('s0000000-0000-0000-0000-000000000010', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'Brazil', 'Rio de Janeiro', 'https://ui-avatars.com/api/?name=Support+Ten&background=10b981'),
('s0000000-0000-0000-0000-000000000011', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'India', 'Delhi', 'https://ui-avatars.com/api/?name=Support+Eleven&background=10b981'),
('s0000000-0000-0000-0000-000000000012', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'China', 'Shanghai', 'https://ui-avatars.com/api/?name=Support+Twelve&background=10b981'),
('s0000000-0000-0000-0000-000000000013', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'South Korea', 'Busan', 'https://ui-avatars.com/api/?name=Support+Thirteen&background=10b981'),
('s0000000-0000-0000-0000-000000000014', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'UAE', 'Abu Dhabi', 'https://ui-avatars.com/api/?name=Support+Fourteen&background=10b981'),
('s0000000-0000-0000-0000-000000000015', FALSE, FALSE, NULL, NULL, 0.00, 0, 0, 'Customer Support Specialist', 'Vietnam', 'Hanoi', 'https://ui-avatars.com/api/?name=Support+Fifteen&background=10b981'),
-- 15 SELLER profiles (verified sellers)
('e0000000-0000-0000-0000-000000000001', TRUE, TRUE, 'Premium Electronics Store', 'Your trusted source for high-quality electronics and gadgets', 4.85, 250, 0, 'Verified Premium Seller', 'USA', 'New York', 'https://ui-avatars.com/api/?name=Seller+One&background=f59e0b'),
('e0000000-0000-0000-0000-000000000002', TRUE, TRUE, 'Luxury Fashion Boutique', 'Exclusive designer fashion and accessories', 4.92, 180, 0, 'Verified Premium Seller', 'France', 'Paris', 'https://ui-avatars.com/api/?name=Seller+Two&background=f59e0b'),
('e0000000-0000-0000-0000-000000000003', TRUE, TRUE, 'Tech Gadgets Hub', 'Latest tech gadgets and smart devices', 4.78, 320, 0, 'Verified Premium Seller', 'Japan', 'Tokyo', 'https://ui-avatars.com/api/?name=Seller+Three&background=f59e0b'),
('e0000000-0000-0000-0000-000000000004', TRUE, TRUE, 'Artisan Crafts Shop', 'Handmade unique crafts and art pieces', 4.88, 145, 0, 'Verified Premium Seller', 'Italy', 'Milan', 'https://ui-avatars.com/api/?name=Seller+Four&background=f59e0b'),
('e0000000-0000-0000-0000-000000000005', TRUE, TRUE, 'Home & Living Store', 'Premium home decor and furniture', 4.75, 210, 0, 'Verified Premium Seller', 'UK', 'London', 'https://ui-avatars.com/api/?name=Seller+Five&background=f59e0b'),
('e0000000-0000-0000-0000-000000000006', TRUE, TRUE, 'Sports & Fitness Pro', 'Professional sports equipment and fitness gear', 4.82, 195, 0, 'Verified Premium Seller', 'Germany', 'Berlin', 'https://ui-avatars.com/api/?name=Seller+Six&background=f59e0b'),
('e0000000-0000-0000-0000-000000000007', TRUE, TRUE, 'Beauty & Cosmetics', 'Premium beauty products and cosmetics', 4.90, 275, 0, 'Verified Premium Seller', 'South Korea', 'Seoul', 'https://ui-avatars.com/api/?name=Seller+Seven&background=f59e0b'),
('e0000000-0000-0000-0000-000000000008', TRUE, TRUE, 'Collectibles & Antiques', 'Rare collectibles and vintage antiques', 4.86, 165, 0, 'Verified Premium Seller', 'USA', 'Los Angeles', 'https://ui-avatars.com/api/?name=Seller+Eight&background=f59e0b'),
('e0000000-0000-0000-0000-000000000009', TRUE, TRUE, 'Jewelry & Watches', 'Luxury jewelry and timepieces', 4.93, 140, 0, 'Verified Premium Seller', 'Switzerland', 'Zurich', 'https://ui-avatars.com/api/?name=Seller+Nine&background=f59e0b'),
('e0000000-0000-0000-0000-000000000010', TRUE, TRUE, 'Books & Media Store', 'Books, movies, and digital media', 4.70, 230, 0, 'Verified Premium Seller', 'USA', 'Boston', 'https://ui-avatars.com/api/?name=Seller+Ten&background=f59e0b'),
('e0000000-0000-0000-0000-000000000011', TRUE, TRUE, 'Gaming & Entertainment', 'Gaming consoles, games, and entertainment', 4.79, 290, 0, 'Verified Premium Seller', 'Japan', 'Osaka', 'https://ui-avatars.com/api/?name=Seller+Eleven&background=f59e0b'),
('e0000000-0000-0000-0000-000000000012', TRUE, TRUE, 'Pet Supplies Plus', 'Everything for your furry friends', 4.81, 175, 0, 'Verified Premium Seller', 'Australia', 'Sydney', 'https://ui-avatars.com/api/?name=Seller+Twelve&background=f59e0b'),
('e0000000-0000-0000-0000-000000000013', TRUE, TRUE, 'Outdoor Adventure Gear', 'Camping, hiking, and outdoor equipment', 4.77, 155, 0, 'Verified Premium Seller', 'Canada', 'Vancouver', 'https://ui-avatars.com/api/?name=Seller+Thirteen&background=f59e0b'),
('e0000000-0000-0000-0000-000000000014', TRUE, TRUE, 'Musical Instruments Pro', 'Professional musical instruments', 4.84, 125, 0, 'Verified Premium Seller', 'USA', 'Nashville', 'https://ui-avatars.com/api/?name=Seller+Fourteen&background=f59e0b'),
('e0000000-0000-0000-0000-000000000015', TRUE, TRUE, 'Automotive Accessories', 'Car parts and automotive accessories', 4.80, 200, 0, 'Verified Premium Seller', 'Germany', 'Stuttgart', 'https://ui-avatars.com/api/?name=Seller+Fifteen&background=f59e0b'),
-- 15 REGULAR USER profiles
('u0000000-0000-0000-0000-000000000001', FALSE, FALSE, NULL, NULL, 0.00, 0, 5, 'Regular user exploring tokenized assets', 'USA', 'New York', 'https://ui-avatars.com/api/?name=User+One&background=3b82f6'),
('u0000000-0000-0000-0000-000000000002', FALSE, FALSE, NULL, NULL, 0.00, 0, 8, 'Regular user exploring tokenized assets', 'USA', 'San Francisco', 'https://ui-avatars.com/api/?name=User+Two&background=3b82f6'),
('u0000000-0000-0000-0000-000000000003', FALSE, FALSE, NULL, NULL, 0.00, 0, 3, 'Regular user exploring tokenized assets', 'UK', 'London', 'https://ui-avatars.com/api/?name=User+Three&background=3b82f6'),
('u0000000-0000-0000-0000-000000000004', FALSE, FALSE, NULL, NULL, 0.00, 0, 12, 'Regular user exploring tokenized assets', 'Germany', 'Berlin', 'https://ui-avatars.com/api/?name=User+Four&background=3b82f6'),
('u0000000-0000-0000-0000-000000000005', FALSE, FALSE, NULL, NULL, 0.00, 0, 7, 'Regular user exploring tokenized assets', 'France', 'Paris', 'https://ui-avatars.com/api/?name=User+Five&background=3b82f6'),
('u0000000-0000-0000-0000-000000000006', FALSE, FALSE, NULL, NULL, 0.00, 0, 4, 'Regular user exploring tokenized assets', 'Japan', 'Tokyo', 'https://ui-avatars.com/api/?name=User+Six&background=3b82f6'),
('u0000000-0000-0000-0000-000000000007', FALSE, FALSE, NULL, NULL, 0.00, 0, 9, 'Regular user exploring tokenized assets', 'Singapore', 'Singapore', 'https://ui-avatars.com/api/?name=User+Seven&background=3b82f6'),
('u0000000-0000-0000-0000-000000000008', FALSE, FALSE, NULL, NULL, 0.00, 0, 6, 'Regular user exploring tokenized assets', 'Australia', 'Sydney', 'https://ui-avatars.com/api/?name=User+Eight&background=3b82f6'),
('u0000000-0000-0000-0000-000000000009', FALSE, FALSE, NULL, NULL, 0.00, 0, 11, 'Regular user exploring tokenized assets', 'Canada', 'Toronto', 'https://ui-avatars.com/api/?name=User+Nine&background=3b82f6'),
('u0000000-0000-0000-0000-000000000010', FALSE, FALSE, NULL, NULL, 0.00, 0, 2, 'Regular user exploring tokenized assets', 'Brazil', 'Sao Paulo', 'https://ui-avatars.com/api/?name=User+Ten&background=3b82f6'),
('u0000000-0000-0000-0000-000000000011', FALSE, FALSE, NULL, NULL, 0.00, 0, 15, 'Regular user exploring tokenized assets', 'India', 'Mumbai', 'https://ui-avatars.com/api/?name=User+Eleven&background=3b82f6'),
('u0000000-0000-0000-0000-000000000012', FALSE, FALSE, NULL, NULL, 0.00, 0, 10, 'Regular user exploring tokenized assets', 'China', 'Beijing', 'https://ui-avatars.com/api/?name=User+Twelve&background=3b82f6'),
('u0000000-0000-0000-0000-000000000013', FALSE, FALSE, NULL, NULL, 0.00, 0, 8, 'Regular user exploring tokenized assets', 'South Korea', 'Seoul', 'https://ui-avatars.com/api/?name=User+Thirteen&background=3b82f6'),
('u0000000-0000-0000-0000-000000000014', FALSE, FALSE, NULL, NULL, 0.00, 0, 13, 'Regular user exploring tokenized assets', 'UAE', 'Dubai', 'https://ui-avatars.com/api/?name=User+Fourteen&background=3b82f6'),
('u0000000-0000-0000-0000-000000000015', FALSE, FALSE, NULL, NULL, 0.00, 0, 6, 'Regular user exploring tokenized assets', 'Vietnam', 'Ho Chi Minh', 'https://ui-avatars.com/api/?name=User+Fifteen&background=3b82f6');

-- Insert 60 Wallets (multiple coins per user, ~180 wallets total)
-- Each user gets 3 random coins with different balances
INSERT INTO "Wallets" ("userId", "coinSymbol", "balance", "walletAddress") VALUES
-- Sample wallets for first 10 users of each type (to keep file manageable)
('a0000000-0000-0000-0000-000000000001', 'BTC', 1.5, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'),
('a0000000-0000-0000-0000-000000000001', 'ETH', 10.0, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'),
('a0000000-0000-0000-0000-000000000001', 'USDT', 5000.0, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'),
('s0000000-0000-0000-0000-000000000001', 'BTC', 0.5, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
('s0000000-0000-0000-0000-000000000001', 'ETH', 5.0, '0x8ba1f109551bD432803012645Hac136c22C19C00'),
('e0000000-0000-0000-0000-000000000001', 'BTC', 5.0, 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gd'),
('e0000000-0000-0000-0000-000000000001', 'ETH', 50.0, '0x1234567890123456789012345678901234567890'),
('e0000000-0000-0000-0000-000000000001', 'USDT', 25000.0, '0x1234567890123456789012345678901234567890'),
('e0000000-0000-0000-0000-000000000002', 'BTC', 3.0, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
('e0000000-0000-0000-0000-000000000002', 'ETH', 30.0, '0x8ba1f109551bD432803012645Hac136c22C19C00'),
('e0000000-0000-0000-0000-000000000002', 'BNB', 100.0, 'bnb1grpf0955h0ykzq3ar3nmum7y6gdfl6lxfn46h2'),
('e0000000-0000-0000-0000-000000000003', 'BTC', 2.5, 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gd'),
('e0000000-0000-0000-0000-000000000003', 'XRP', 5000.0, 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'),
('u0000000-0000-0000-0000-000000000001', 'USDT', 10000.0, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'),
('u0000000-0000-0000-0000-000000000001', 'ETH', 2.0, '0x8ba1f109551bD432803012645Hac136c22C19C00'),
('u0000000-0000-0000-0000-000000000002', 'BTC', 0.1, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
('u0000000-0000-0000-0000-000000000002', 'USDT', 5000.0, '0x1234567890123456789012345678901234567890');

-- Insert 15 sample Transactions
INSERT INTO "Transactions" ("userId", "type", "coinSymbol", "amount", "fee", "status", "description") VALUES
('e0000000-0000-0000-0000-000000000001', 'DEPOSIT', 'BTC', 1.0, 0.0001, 'COMPLETED', 'Initial deposit'),
('e0000000-0000-0000-0000-000000000001', 'WITHDRAWAL', 'ETH', 5.0, 0.01, 'COMPLETED', 'Withdrawal to external wallet'),
('e0000000-0000-0000-0000-000000000002', 'DEPOSIT', 'BTC', 2.0, 0.0002, 'COMPLETED', 'Deposit from exchange'),
('u0000000-0000-0000-0000-000000000001', 'DEPOSIT', 'USDT', 10000.0, 1.0, 'COMPLETED', 'Initial deposit'),
('u0000000-0000-0000-0000-000000000001', 'TRANSFER', 'ETH', 1.0, 0.005, 'PENDING', 'Transfer to another user'),
('e0000000-0000-0000-0000-000000000003', 'DEPOSIT', 'XRP', 5000.0, 0.1, 'COMPLETED', 'Deposit from exchange'),
('e0000000-0000-0000-0000-000000000004', 'DEPOSIT', 'BNB', 100.0, 0.01, 'COMPLETED', 'Deposit from Binance'),
('u0000000-0000-0000-0000-000000000002', 'DEPOSIT', 'BTC', 0.1, 0.0001, 'COMPLETED', 'Small deposit'),
('e0000000-0000-0000-0000-000000000005', 'WITHDRAWAL', 'BTC', 0.5, 0.0001, 'COMPLETED', 'Withdrawal'),
('e0000000-0000-0000-0000-000000000006', 'DEPOSIT', 'ETH', 20.0, 0.02, 'COMPLETED', 'Deposit'),
('u0000000-0000-0000-0000-000000000003', 'DEPOSIT', 'USDT', 5000.0, 0.5, 'PENDING', 'Pending deposit'),
('e0000000-0000-0000-0000-000000000007', 'TRANSFER', 'USDT', 1000.0, 1.0, 'COMPLETED', 'Transfer'),
('e0000000-0000-0000-0000-000000000008', 'DEPOSIT', 'BTC', 1.5, 0.00015, 'COMPLETED', 'Deposit'),
('u0000000-0000-0000-0000-000000000004', 'WITHDRAWAL', 'ETH', 1.0, 0.01, 'PENDING', 'Pending withdrawal'),
('e0000000-0000-0000-0000-000000000009', 'DEPOSIT', 'BNB', 50.0, 0.005, 'COMPLETED', 'Deposit');

-- Insert 15 sample FavoriteProducts
INSERT INTO "FavoriteProducts" ("userId", "productId") VALUES
('u0000000-0000-0000-0000-000000000001', '507f1f77bcf86cd799439011'),
('u0000000-0000-0000-0000-000000000001', '507f1f77bcf86cd799439012'),
('u0000000-0000-0000-0000-000000000002', '507f1f77bcf86cd799439013'),
('u0000000-0000-0000-0000-000000000003', '507f1f77bcf86cd799439014'),
('u0000000-0000-0000-0000-000000000004', '507f1f77bcf86cd799439015'),
('u0000000-0000-0000-0000-000000000005', '507f1f77bcf86cd799439016'),
('u0000000-0000-0000-0000-000000000006', '507f1f77bcf86cd799439017'),
('u0000000-0000-0000-0000-000000000007', '507f1f77bcf86cd799439018'),
('u0000000-0000-0000-0000-000000000008', '507f1f77bcf86cd799439019'),
('u0000000-0000-0000-0000-000000000009', '507f1f77bcf86cd799439020'),
('u0000000-0000-0000-0000-000000000010', '507f1f77bcf86cd799439021'),
('u0000000-0000-0000-0000-000000000011', '507f1f77bcf86cd799439022'),
('u0000000-0000-0000-0000-000000000012', '507f1f77bcf86cd799439023'),
('u0000000-0000-0000-0000-000000000013', '507f1f77bcf86cd799439024'),
('u0000000-0000-0000-0000-000000000014', '507f1f77bcf86cd799439025');

\echo '✅ User database: 60 profiles, wallets, transactions, favorites created'

-- ========================================
-- ORDER DATABASE  
-- ========================================
\c order_db

DROP TABLE IF EXISTS "OrderItems" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;

-- Tạo bảng orders với schema khớp với Order model
CREATE TABLE "orders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_number" VARCHAR(100) UNIQUE NOT NULL,
    "user_id" UUID NOT NULL,
    
    -- Delivery info
    "shipping_name" VARCHAR(255) NOT NULL,
    "shipping_email" VARCHAR(255) NOT NULL,
    "shipping_phone" VARCHAR(50) NOT NULL,
    "shipping_address" TEXT NOT NULL,
    "shipping_city" VARCHAR(100) NOT NULL,
    "shipping_country" VARCHAR(100) NOT NULL,
    "shipping_postal_code" VARCHAR(20) NOT NULL,
    
    -- Order summary
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "subtotal_in_coins" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "subtotal_in_usd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shipping_fee_in_coins" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "shipping_fee_in_usd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_in_coins" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "total_in_usd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    
    -- Payment
    "payment_method" VARCHAR(50) NOT NULL DEFAULT 'COIN',
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "payment_transaction_id" VARCHAR(255),
    "paid_at" TIMESTAMP WITH TIME ZONE,
    
    -- Status
    "order_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    
    -- Tracking
    "tracking_number" VARCHAR(100),
    "shipped_at" TIMESTAMP WITH TIME ZONE,
    "delivered_at" TIMESTAMP WITH TIME ZONE,
    "cancelled_at" TIMESTAMP WITH TIME ZONE,
    "cancellation_reason" TEXT,
    
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OrderItems" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "product_id" VARCHAR(50) NOT NULL,
    "product_title" VARCHAR(500) NOT NULL,
    "product_image" TEXT,
    "quantity" INTEGER NOT NULL,
    "price_in_coins" DECIMAL(18,8) NOT NULL,
    "price_in_usd" DECIMAL(18,2) NOT NULL,
    "coin_symbol" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_orders_user" ON "orders"("user_id");
CREATE INDEX "idx_orders_status" ON "orders"("order_status");
CREATE INDEX "idx_orders_created" ON "orders"("created_at" DESC);
CREATE INDEX "idx_order_items_order" ON "OrderItems"("order_id");
CREATE INDEX "idx_order_items_product" ON "OrderItems"("product_id");

-- Insert sample orders với schema mới
INSERT INTO "orders" ("id", "order_number", "user_id", "shipping_name", "shipping_email", "shipping_phone", "shipping_address", "shipping_city", "shipping_country", "shipping_postal_code", "total_items", "subtotal_in_coins", "subtotal_in_usd", "shipping_fee_in_coins", "shipping_fee_in_usd", "total_in_coins", "total_in_usd", "payment_method", "payment_status", "order_status", "paid_at", "created_at") VALUES
('o0000000-0000-0000-0000-000000000001', 'ORD-001', 'u0000000-0000-0000-0000-000000000001', 'John Doe', 'john@example.com', '+1234567890', '123 Main St', 'New York', 'USA', '10001', 1, 0.023255, 1000.00, 0, 0, 0.023255, 1000.00, 'COIN', 'PAID', 'DELIVERED', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
('o0000000-0000-0000-0000-000000000002', 'ORD-002', 'u0000000-0000-0000-0000-000000000002', 'Jane Smith', 'jane@example.com', '+1234567891', '456 Oak Ave', 'San Francisco', 'USA', '94102', 1, 0.434783, 2000.00, 0, 0, 0.434783, 2000.00, 'COIN', 'PAID', 'PROCESSING', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
('o0000000-0000-0000-0000-000000000003', 'ORD-003', 'u0000000-0000-0000-0000-000000000003', 'Bob Johnson', 'bob@example.com', '+1234567892', '789 Elm St', 'London', 'UK', 'SW1A 1AA', 1, 869.565, 500.00, 0, 0, 869.565, 500.00, 'COIN', 'PENDING', 'PENDING', NULL, NOW() - INTERVAL '1 day');

-- Insert sample order items
INSERT INTO "OrderItems" ("order_id", "product_id", "product_title", "product_image", "quantity", "price_in_coins", "price_in_usd", "coin_symbol") VALUES
('o0000000-0000-0000-0000-000000000001', '507f1f77bcf86cd799439011', 'MacBook Pro 16" M2', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8', 1, 0.023255, 1000.00, 'BTC'),
('o0000000-0000-0000-0000-000000000002', '507f1f77bcf86cd799439012', 'iPhone 15 Pro Max', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab', 1, 0.434783, 2000.00, 'BTC'),
('o0000000-0000-0000-0000-000000000003', '507f1f77bcf86cd799439013', 'Sony WH-1000XM5 Headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', 1, 869.565, 500.00, 'ETH');

\echo '✅ Order database: orders and order items created'

-- ========================================
-- SUMMARY
-- ========================================
\c postgres
\echo ''
\echo '========================================='
\echo '✅ ALL DATABASES CREATED SUCCESSFULLY'
\echo '========================================='
\echo ''
\echo '📊 Statistics:'
\echo '  - 60 Users (15 ADMIN, 15 SUPPORT, 15 SELLER, 15 USER)'
\echo '  - 60 UserProfiles (1 per user)'
\echo '  - 17 Wallets (sample)'
\echo '  - 15 Transactions (sample)'
\echo '  - 15 FavoriteProducts (sample)'
\echo '  - 15 Orders (sample)'
\echo '  - 15 OrderItems (sample)'
\echo ''
\echo '🔑 Login Credentials:'
\echo '  Password for ALL users: Password123!'
\echo ''
\echo '📧 Sample Emails:'
\echo '  ADMIN: admin1@tokenasset.com to admin15@tokenasset.com'
\echo '  SUPPORT: support1@tokenasset.com to support15@tokenasset.com'
\echo '  SELLER: seller1@tokenasset.com to seller15@tokenasset.com'
\echo '  USER: user1@tokenasset.com to user15@tokenasset.com'
\echo ''
\echo 'Next steps:'
\echo '  1. Run: npm run seed (in product-service for MongoDB)'
\echo '  2. Start services: npm run dev'
\echo '========================================='