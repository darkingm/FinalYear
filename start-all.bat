@echo off
echo ========================================
echo   STARTING TOKENASSET PLATFORM
echo ========================================
echo.

echo [1/3] Starting Infrastructure (Docker)...
docker-compose up -d postgres mongodb redis rabbitmq
timeout /t 10

echo.
echo [2/3] Starting Backend Services...
start "API Gateway" cmd /k "cd services\api-gateway && npm run dev"
timeout /t 2
start "Auth Service" cmd /k "cd services\auth-service && npm run dev"
timeout /t 2
start "Product Service" cmd /k "cd services\product-service && npm run dev"
timeout /t 2
start "Order Service" cmd /k "cd services\order-service && npm run dev"
timeout /t 2
start "Blockchain Service" cmd /k "cd services\blockchain-service && npm run dev"
timeout /t 2
start "Chat Service" cmd /k "cd services\chat-service && npm run dev"
timeout /t 2
start "AI Analysis Service" cmd /k "cd services\ai-analysis-service && npm run dev"

echo.
echo [3/3] Starting Frontend...
timeout /t 5
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   ALL SERVICES STARTED!
echo ========================================
echo.
echo Access URLs:
echo - Frontend:    http://localhost:5173
echo - API Gateway: http://localhost:3000
echo.
echo Service Ports:
echo - API Gateway:        3000
echo - Auth Service:        3001 (includes User Service)
echo - Product Service:     3003 (includes Coin Market Service)
echo - Order Service:       3005 (includes Payment Service)
echo - Blockchain Service:  3007
echo - Chat Service:        3008 (includes Social Service)
echo - AI Analysis Service: 3010
echo.
echo Press any key to open browser...
pause > nul
start http://localhost:5173


