@echo off
echo ================================================
echo    Stopping Crypto Marketplace - Dev Mode
echo ================================================
echo.

echo Stopping Infrastructure (Docker)...
cd docker
docker-compose -f docker-compose.dev.yml down
echo.

echo ================================================
echo    All Services Stopped
echo ================================================
echo.

pause
