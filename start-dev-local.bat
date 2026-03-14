@echo off
title Start Dev - Local
cd /d "%~dp0"

echo ================================================
echo    Dev: Local - Mo terminal (Postgres da cai san)
echo ================================================
echo.

echo [1] Kiem tra Postgres (port 5433)...
powershell -Command "try { $t = New-Object System.Net.Sockets.TcpClient('localhost', 5433); $t.Close(); exit 0 } catch { exit 1 }" 2>nul
if errorlevel 1 (
    echo CANH BAO: Khong ket noi port 5433. Hay start PostgreSQL truoc.
    echo.
) else (
    echo   Postgres: OK
    echo.
)

echo [2] Mo cac terminal va chay npm run dev...
echo.

start "Backend - Main API" cmd /k "cd /d %~dp0backend\main-service && npm install && npm run dev"
timeout /t 2 /nobreak >nul

start "Backend - Payment API" cmd /k "cd /d %~dp0backend\payment-service && npm install && npm run dev"
timeout /t 2 /nobreak >nul

start "Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"
timeout /t 2 /nobreak >nul

start "Contract - Hardhat Node" cmd /k "cd /d %~dp0contracts && npm install && npx hardhat node"
timeout /t 2 /nobreak >nul

start "AI Service - Groq Chat" cmd /k "cd /d %~dp0backend\ai-service && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 3005 --reload"
timeout /t 2 /nobreak >nul

start "Mobile App - Expo" cmd /k "cd /d %~dp0mobile && npx expo start"

echo.
echo ================================================
echo    Da mo 6 cua so: Main API, Payment API, FE, Hardhat, AI Service, Mobile
echo    Web:    http://localhost:3000
echo    AI:     http://localhost:3005
echo    Mobile: Scan QR bang Expo Go app
echo ================================================
exit /b 0
