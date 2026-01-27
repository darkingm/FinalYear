# E-Commerce Database Setup Guide

## 📋 Overview

Complete e-commerce database schema with cryptocurrency payment support, designed for high-performance PostgreSQL deployment.

## 🎯 Features

### Core Features
- ✅ **User Management** - Local and social authentication (Google, Facebook, Microsoft)
- ✅ **Product Catalog** - Categories, products, variants, inventory management
- ✅ **Shopping Cart** - Session-based cart with real-time updates
- ✅ **Order Processing** - Complete order lifecycle management
- ✅ **Payment Gateway** - Multiple payment methods including crypto
- ✅ **Cryptocurrency Support** - BTC, ETH, USDT, USDC, BNB, BUSD
- ✅ **Reviews & Ratings** - Verified purchase reviews
- ✅ **Coupons & Promotions** - Flexible discount system
- ✅ **Notifications** - Real-time user notifications
- ✅ **Admin Panel** - Role-based access control

### Technical Features
- ⚡ **Optimized Indexes** - Fast queries on large datasets
- 🔒 **Deadlock Prevention** - Consistent lock ordering
- 🔄 **Triggers & Functions** - Auto-updates and validations
- 📊 **Denormalized Stats** - Real-time performance metrics
- 🎭 **Partitioning Ready** - For future scaling
- 🔐 **Security** - Password hashing, SQL injection prevention

## 🚀 Quick Start

### Prerequisites
- PostgreSQL 16+ installed
- PostgreSQL running on port 5433
- Password set to `1`

### Installation

#### Windows
```bash
cd scripts
import-ecommerce-db.bat
```

#### Linux/Mac
```bash
cd scripts
chmod +x import-ecommerce-db.sh
./import-ecommerce-db.sh
```

### Manual Installation
```bash
# Set password
set PGPASSWORD=1  # Windows
export PGPASSWORD=1  # Linux/Mac

# Run scripts in order
psql -U postgres -p 5433 -f 00-complete-ecommerce-schema.sql
psql -U postgres -p 5433 -f 01-triggers-and-functions.sql
psql -U postgres -p 5433 -f 02-seed-data.sql
```

## 📊 Database Schema

### Main Tables (40+)

#### 1. Users & Authentication
- `users` - Main user table with auth_type support
- `social_accounts` - OAuth provider connections
- `user_addresses` - Shipping and billing addresses
- `admin_users` - Admin role management

#### 2. Products & Categories
- `categories` - Hierarchical category tree
- `products` - Product catalog
- `product_variants` - SKU variants (size, color, etc.)
- `product_images` - Product gallery
- `product_categories` - Many-to-many mapping
- `inventory_log` - Audit trail for stock changes

#### 3. Shopping & Orders
- `cart_items` - Shopping cart
- `orders` - Order header
- `order_items` - Order line items
- `order_status_history` - Status change tracking

#### 4. Cryptocurrency Payments
- `supported_cryptocurrencies` - Active crypto currencies
- `crypto_wallets` - System wallets (hot/cold)
- `user_deposit_addresses` - User-specific deposit addresses
- `crypto_payments` - Crypto payment tracking
- `crypto_transactions` - Blockchain transaction log
- `crypto_exchange_rates` - Exchange rate cache

#### 5. Payments & Transactions
- `payment_methods` - Available payment options
- `payment_transactions` - All payment records

#### 6. Marketing & Engagement
- `coupons` - Discount codes
- `coupon_usage` - Redemption tracking
- `product_reviews` - Customer reviews
- `notifications` - User notifications

#### 7. System
- `system_settings` - Configuration key-value store

## 🔑 Sample Data

### Users (110 total)

#### Admin Accounts (10)
```
Email: admin1@ecom.com to admin10@ecom.com
Password: Password123!
```

#### Seller Accounts (30)
```
Email: seller1@ecom.com to seller30@ecom.com
Password: Password123!
```

#### Buyer Accounts (60)
```
Email: user1@ecom.com to user60@ecom.com
Password: Password123!
```

#### Social Login (10)
```
Email: social1@gmail.com to social10@gmail.com
Provider: Google
```

### Products
- **50 Products** across Electronics and Fashion categories
- **Multiple variants** per product (sizes, colors)
- **Realistic pricing** and inventory levels

### Orders
- **100 Sample orders** in various states
- **Pending, Confirmed, Shipped, Delivered**
- **Realistic order items** (1-5 items per order)

### Reviews
- **200+ Product reviews** with ratings 3-5 stars
- **Verified purchases** linked to orders

### Coupons
- `WELCOME10` - 10% off first order
- `SAVE50` - $50 off orders over $500
- `MEGA20` - 20% off everything
- `FREESHIP` - Free shipping
- `FLASH25` - 25% flash sale

## 🔧 Database Connection

```
Host: localhost
Port: 5433
Database: ecommerce_db
Username: postgres
Password: 1

Connection String:
postgresql://postgres:1@localhost:5433/ecommerce_db
```

## 📝 Important Features

### 1. Account Merge Logic
The system supports merging social and local accounts:
- Email is unique across all users
- Social accounts store provider email for matching
- `auth_type` field: `local`, `social`, or `hybrid`

### 2. Inventory Management
- **Reserved quantity** - Stock reserved for pending orders
- **Available stock** - `stock_quantity - reserved_quantity`
- **Automatic updates** - Triggers handle stock changes
- **Audit trail** - `inventory_log` tracks all changes

### 3. Deadlock Prevention
- **Consistent lock ordering** - Always lock by ID ascending
- **SKIP LOCKED** - Non-blocking inventory checks
- **Optimistic locking** - Version columns on critical tables

### 4. Performance Optimization
- **Denormalized stats** - `rating_average`, `sold_count` on products
- **Partial indexes** - Only index active records
- **GIN indexes** - Fast text search with trigrams
- **Composite indexes** - Multi-column queries optimized

### 5. Crypto Payment Flow
1. User selects cryptocurrency at checkout
2. System generates unique payment address
3. Exchange rate locked for 30 minutes
4. Blockchain monitored for incoming transaction
5. Auto-confirm after required confirmations
6. Order status updated automatically

## 🔒 Security Features

- ✅ Password hashing (bcrypt)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Email verification required
- ✅ Role-based access control
- ✅ Encrypted private keys for hot wallets
- ✅ Rate limiting ready (via Redis in app layer)

## 📈 Scaling Considerations

### Ready for Partitioning
The schema is designed for easy partitioning:
- `orders` - Partition by month
- `order_items` - Partition by order date
- `crypto_transactions` - Partition by date
- `inventory_log` - Partition by date

### Caching Strategy
Recommended Redis caching:
- User sessions (JWT tokens)
- Product catalog (5 min TTL)
- Exchange rates (1 min TTL)
- Shopping carts (24 hour TTL)

### Read Replicas
All queries optimized for read replicas:
- No write-heavy reads
- Explicit transactions for writes
- Read-your-writes consistency

## 🧪 Testing Queries

### Check User Accounts
```sql
SELECT auth_type, COUNT(*) 
FROM users 
GROUP BY auth_type;
```

### Check Product Inventory
```sql
SELECT 
    p.name,
    pv.variant_name,
    pv.stock_quantity,
    pv.reserved_quantity,
    (pv.stock_quantity - pv.reserved_quantity) AS available
FROM products p
JOIN product_variants pv ON pv.product_id = p.product_id
WHERE p.status = 'active'
ORDER BY available ASC
LIMIT 10;
```

### Check Recent Orders
```sql
SELECT 
    o.order_number,
    u.email,
    o.status,
    o.payment_status,
    o.total_amount,
    o.created_at
FROM orders o
JOIN users u ON u.user_id = o.user_id
ORDER BY o.created_at DESC
LIMIT 20;
```

### Check Crypto Payments
```sql
SELECT 
    cp.payment_id,
    sc.symbol,
    cp.expected_amount,
    cp.received_amount,
    cp.status,
    o.order_number
FROM crypto_payments cp
JOIN supported_cryptocurrencies sc ON sc.crypto_id = cp.crypto_id
JOIN orders o ON o.order_id = cp.order_id
ORDER BY cp.created_at DESC
LIMIT 10;
```

## 🛠️ Maintenance

### Vacuum and Analyze
```sql
VACUUM ANALYZE users;
VACUUM ANALYZE products;
VACUUM ANALYZE orders;
VACUUM ANALYZE product_variants;
```

### Check Table Sizes
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Index Usage
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 📞 Support

For issues or questions:
1. Check PostgreSQL logs
2. Verify port 5433 is not in use
3. Ensure PostgreSQL service is running
4. Check password is set to `1`

## 📄 License

This database schema is part of the FYP E-commerce platform project.

---

**Created**: 2026-01-25  
**Version**: 1.0.0  
**PostgreSQL**: 16+  
**Status**: Production Ready
