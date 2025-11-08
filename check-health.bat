@echo off
echo ========================================
echo   CHECKING ALL SERVICES HEALTH
echo ========================================
echo.

echo Checking API Gateway (Port 3000)...
curl -s http://localhost:3000/health
echo.
echo.

echo Checking Auth Service (Port 3001)...
curl -s http://localhost:3001/health
echo.
echo.

echo Checking User Service (Port 3002)...
curl -s http://localhost:3002/health
echo.
echo.

echo Checking Product Service (Port 3003)...
curl -s http://localhost:3003/health
echo.
echo.

echo Checking Coin Market Service (Port 3004)...
curl -s http://localhost:3004/health
echo.
echo.

echo Checking Order Service (Port 3005)...
curl -s http://localhost:3005/health
echo.
echo.

echo Checking Payment Service (Port 3006)...
curl -s http://localhost:3006/health
echo.
echo.

echo Checking Blockchain Service (Port 3007)...
curl -s http://localhost:3007/health
echo.
echo.

echo Checking Chat Service (Port 3008)...
curl -s http://localhost:3008/health
echo.
echo.

echo Checking Social Service (Port 3009)...
curl -s http://localhost:3009/health
echo.
echo.

echo Checking AI Analysis Service (Port 3010)...
curl -s http://localhost:3010/health
echo.
echo.

echo ========================================
echo   HEALTH CHECK COMPLETE!
echo ========================================
pause


