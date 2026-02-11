@echo off
title Start Dev - Docker
cd /d "%~dp0"

echo ================================================
echo    Dev: Docker - Start infra + mo terminal
echo ================================================
echo.

echo [1] Starting Docker (Postgres, Redis, RabbitMQ)...
cd docker
docker-compose -f docker-compose.dev.yml up -d
if errorlevel 1 (
    echo ERROR: Docker that bai. Kiem tra Docker Desktop dang chay?
    cd ..
    pause
    exit /b 1
)
cd ..
echo.

echo [2] Doi services san sang (15s)...
timeout /t 15 /nobreak >nul
docker ps --format "table {{.Names}}\t{{.Status}}"
echo.

echo [3] Mo cac terminal va chay npm run dev...
echo.

start "Backend - Main API" cmd /k "cd /d %~dp0backend\main-service && npm install && npm run dev"
timeout /t 2 /nobreak >nul

start "Backend - Payment API" cmd /k "cd /d %~dp0backend\payment-service && npm install && npm run dev"
timeout /t 2 /nobreak >nul

start "Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"
timeout /t 2 /nobreak >nul

start "Contract - Hardhat Node" cmd /k "cd /d %~dp0contracts && npm install && npx hardhat node"

echo.
echo ================================================
echo    Da mo 4 cua so: Main API, Payment API, FE, Hardhat node
echo    Sau khi chay xong, mo: http://localhost:3000
echo ================================================
exit /b 0
