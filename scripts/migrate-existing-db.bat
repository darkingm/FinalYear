@echo off
REM ========================================
REM Migrate Existing Auth Database
REM Add wallet tables to existing auth_db
REM PostgreSQL Port: 5432 (default)
REM ========================================

echo ========================================
echo DATABASE MIGRATION SCRIPT
echo ========================================
echo.
echo This script will:
echo 1. Add new columns to users table
echo 2. Create social_accounts table
echo 3. Create user_addresses table
echo 4. Create wallets table (symbolic balances)
echo 5. Create wallet_transactions table
echo 6. Create admin master wallet
echo.
echo PostgreSQL Configuration:
echo - Host: localhost
echo - Port: 5432
echo - Database: auth_db
echo.

set /p PGPASSWORD="Enter PostgreSQL password: "
set PGHOST=localhost
set PGPORT=5432
set PGUSER=postgres

echo.
echo Running migration...
psql -U postgres -p 5432 -f "%~dp004-migrate-to-new-schema.sql"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Migration failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo MIGRATION COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Changes Applied:
echo - Users table updated with phone, avatar_url, auth_type, status
echo - social_accounts table created
echo - user_addresses table created  
echo - wallets table created (symbolic balances)
echo - wallet_transactions table created
echo - Admin master wallet created
echo.
echo Admin Wallet Info:
echo - ID: 00000000-0000-0000-0000-000000000001
echo - Purpose: Holds REAL coins on blockchain
echo - Initial balance: 0 for all coins
echo.
echo Next Steps:
echo 1. Set admin wallet addresses: POST /api/v1/admin/wallets/address
echo 2. Sync real balance from blockchain: POST /api/v1/admin/wallets/sync
echo 3. Start accepting user deposits
echo.

pause
