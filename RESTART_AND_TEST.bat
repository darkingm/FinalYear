@echo off
echo ================================================
echo    Restarting Services After Fixes
echo ================================================
echo.

echo [1] Clearing Frontend Cache...
cd frontend
if exist .next (
    rmdir /s /q .next
    echo ✓ .next folder deleted
) else (
    echo ✓ No cache to clear
)
echo.

echo ================================================
echo [2] Services to Restart Manually:
echo ================================================
echo.
echo BACKEND (Terminal 1):
echo   cd backend\main-service
echo   npm run dev
echo.
echo FRONTEND (Terminal 2):
echo   cd frontend
echo   npm run dev
echo.
echo ================================================
echo [3] Test OAuth Login:
echo ================================================
echo.
echo 1. Open: http://localhost:3000/login
echo 2. Click "Sign in with Google"
echo 3. Select Google account
echo 4. Should redirect to homepage
echo 5. Check user created in database
echo.
echo ================================================
echo [4] Check Logs:
echo ================================================
echo.
echo Backend logs should show:
echo   - POST /api/auth/oauth
echo   - User created or logged in
echo   - JWT tokens generated
echo.
echo Frontend logs should NOT show:
echo   - useNetwork errors (FIXED)
echo   - MetaMask SDK errors (FIXED)
echo   - 404 errors (FIXED)
echo.
pause
