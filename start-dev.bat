@echo off
echo ================================================
echo    Starting Crypto Marketplace - Dev Mode
echo ================================================
echo.

echo [1/3] Starting Infrastructure (Docker)...
cd docker
docker-compose -f docker-compose.dev.yml up -d
echo.

echo Waiting for services to start (30 seconds)...
timeout /t 30 /nobreak >nul
echo.

echo [2/3] Infrastructure Status:
docker ps
echo.

echo ================================================
echo    Infrastructure Started Successfully!
echo ================================================
echo.
echo Next Steps:
echo.
echo 1. Start Backend Main Service:
echo    cd backend\main-service
echo    npm run dev
echo.
echo 2. Start Backend Payment Service:
echo    cd backend\payment-service
echo    npm run dev
echo.
echo 3. Start Frontend:
echo    cd frontend
echo    npm run dev
echo.
echo 4. Open Browser:
echo    http://localhost:3000
echo.
echo ================================================
echo.

pause
