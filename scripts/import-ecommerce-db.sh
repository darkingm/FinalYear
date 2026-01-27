#!/bin/bash
# ========================================
# Import Complete E-commerce Database
# PostgreSQL Port: 5433
# Password: 1
# ========================================

echo "========================================"
echo "E-COMMERCE DATABASE IMPORT SCRIPT"
echo "========================================"
echo ""
echo "This script will:"
echo "1. Create complete e-commerce schema"
echo "2. Create all triggers and functions"
echo "3. Import seed data (110 users, 50 products, 100 orders)"
echo ""
echo "PostgreSQL Configuration:"
echo "- Host: localhost"
echo "- Port: 5433"
echo "- Password: 1"
echo "- Database: ecommerce_db"
echo ""

# Set PostgreSQL environment
export PGPASSWORD=1
export PGHOST=localhost
export PGPORT=5433
export PGUSER=postgres

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Step 1: Creating database schema..."
psql -U postgres -p 5433 -f "$SCRIPT_DIR/00-complete-ecommerce-schema.sql" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to create schema. Please check if PostgreSQL is running on port 5433."
    exit 1
fi
echo "[SUCCESS] Schema created!"
echo ""

echo "Step 2: Creating triggers and functions..."
psql -U postgres -p 5433 -f "$SCRIPT_DIR/01-triggers-and-functions.sql" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to create triggers and functions."
    exit 1
fi
echo "[SUCCESS] Triggers and functions created!"
echo ""

echo "Step 3: Importing seed data..."
psql -U postgres -p 5433 -f "$SCRIPT_DIR/02-seed-data.sql" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to import seed data."
    exit 1
fi
echo "[SUCCESS] Seed data imported!"
echo ""

echo "========================================"
echo "DATABASE IMPORT COMPLETED SUCCESSFULLY!"
echo "========================================"
echo ""
echo "Database: ecommerce_db"
echo "Connection: postgresql://postgres:1@localhost:5433/ecommerce_db"
echo ""
echo "Sample Accounts:"
echo "==============="
echo "Admin:    admin1@ecom.com / Password123!"
echo "Seller:   seller1@ecom.com / Password123!"
echo "User:     user1@ecom.com / Password123!"
echo "Social:   social1@gmail.com (Google OAuth)"
echo ""
echo "Data Summary:"
echo "============="
echo "- 110 Users (10 admins, 30 sellers, 70 buyers)"
echo "- 50+ Products with variants"
echo "- 100 Sample orders"
echo "- 200+ Product reviews"
echo "- 6 Supported cryptocurrencies"
echo "- 5 Active coupons"
echo ""
echo "You can now connect to the database and start using it!"
echo ""
