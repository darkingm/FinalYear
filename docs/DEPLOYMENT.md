# Deployment Guide for Windows 11

Complete deployment guide for the Crypto Marketplace platform on Windows 11.

## Docker Hub account switch

If you change the Docker Hub account used by CI/CD, update these values together:

1. GitHub repository secret `DOCKERHUB_USERNAME`
2. GitHub repository secret `DOCKERHUB_TOKEN`
3. VPS runtime file `/root/services/FinalYear/docker/.env` field `DOCKERHUB_USERNAME` if you still do manual `docker compose` work outside GitHub Actions

The workflow builds and pushes images under `${DOCKERHUB_USERNAME}/marketplace-*`, so the username and token must belong to the same Docker Hub account.

## Prerequisites

### Required Software

1. **Node.js 18+**
   ```bash
   # Download from https://nodejs.org/
   # Verify installation:
   node --version  # Should show v18.x.x or higher
   npm --version
   ```

2. **Docker Desktop**
   ```bash
   # Download from https://www.docker.com/products/docker-desktop
   # After installation, enable WSL 2 backend
   # Verify:
   docker --version
   docker-compose --version
   ```

3. **PostgreSQL Client** (optional, for database management)
   ```bash
   # Download from https://www.postgresql.org/download/windows/
   ```

4. **Git**
   ```bash
   # Download from https://git-scm.com/download/win
   git --version
   ```

5. **MetaMask Browser Extension**
   - Install from https://metamask.io/

---

## Development Setup

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd FYP
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Main Service
cd ../backend/main-service
npm install

# Payment Service
cd ../backend/payment-service
npm install

# Smart Contracts
cd ../../contracts
npm install

# Return to root
cd ..
```

### 3. Environment Configuration

#### Frontend `.env`
```bash
cd frontend
cp .env.example .env
```

Edit `frontend\.env`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PAYMENT_API_URL=http://localhost:3002
NEXT_PUBLIC_BINANCE_WS=wss://stream.binance.com:9443/ws

# Get from https://dashboard.hcaptcha.com/
NEXT_PUBLIC_HCAPTCHA_SITEKEY=10000000-ffff-ffff-ffff-000000000001

# Get from https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Get from https://developers.facebook.com/
FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret

# Get from https://www.paypal.com/developer/
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id

# Generate with: openssl rand -base64 32 (use Git Bash)
NEXTAUTH_SECRET=your_nextauth_secret_here

# Get from https://cloud.walletconnect.com/
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

NEXTAUTH_URL=http://localhost:3000
```

#### Backend Main Service `.env`
```bash
cd ../backend/main-service
cp .env.example .env
```

Edit `backend\main-service\.env`:
```env
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://marketplace:secure_password@localhost:5432/marketplace_db
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://marketplace:password@localhost:5672

# Generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=24h

# AWS S3 (get from https://console.aws.amazon.com/)
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1

# hCaptcha (get from https://dashboard.hcaptcha.com/)
HCAPTCHA_SECRET=your_hcaptcha_secret
```

#### Backend Payment Service `.env`
```bash
cd ../payment-service
cp .env.example .env
```

Edit `backend\payment-service\.env`:
```env
NODE_ENV=development
PORT=3002

DATABASE_URL=postgresql://marketplace:secure_password@localhost:5432/marketplace_db
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://marketplace:password@localhost:5672

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret
PAYPAL_MODE=sandbox

# Blockchain (after deploying contracts)
ESCROW_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
ESCROW_CONTRACT_BASE_SEPOLIA=0x0000000000000000000000000000000000000000
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Moralis (get from https://admin.moralis.io/)
MORALIS_API_KEY=your_moralis_api_key

# Private key for contract interactions (KEEP SECRET!)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

### 4. Start Infrastructure with Docker

```powershell
# Start PostgreSQL, Redis, RabbitMQ
cd docker
docker-compose up -d postgres redis rabbitmq

# Wait for services to be healthy (30 seconds)
Start-Sleep -Seconds 30

# Check status
docker-compose ps
```

### 5. Initialize Database

```powershell
# Using Docker
docker exec -i marketplace-postgres psql -U marketplace -d marketplace_db < ..\init_database.sql

# Or using local PostgreSQL client
psql -h localhost -U marketplace -d marketplace_db -f ..\init_database.sql
```

### 6. Deploy Smart Contracts

```bash
cd contracts

# Create .env file
echo "PRIVATE_KEY=your_private_key" > .env
echo "BASESCAN_API_KEY=your_api_key" >> .env

# Demo mode: local Hardhat
npx hardhat run scripts/bootstrap-local.ts --network localhost

# Public testnet-lite mode: Base Sepolia
npx hardhat run scripts/deploy-base-sepolia.ts --network baseSepolia

# Optional secondary testnet: Polygon Amoy
npx hardhat run scripts/deploy-amoy.ts --network amoy

# Optional mock stablecoin on Base Sepolia
npx hardhat run scripts/deploy-mock-usdt-base-sepolia.ts --network baseSepolia

# Copy resulting contract addresses to backend/frontend env
# Update ESCROW_CONTRACT_LOCALHOST, ESCROW_CONTRACT_BASE_SEPOLIA, or ESCROW_CONTRACT_POLYGON_AMOY as needed
```

### 7. Download Cryptocurrency Logos

Download logos from https://cryptologos.cc/ and place in `frontend\public\coins\`:

Required files:
- btc.png
- eth.png
- bnb.png
- usdt.png
- usdc.png
- dai.png
- matic.png
- placeholder.png (for fallback)

Recommended size: 128x128px PNG with transparent background.

### 8. Start Development Servers

**Option A: Using npm scripts (recommended for development)**

Open 3 separate PowerShell windows:

```powershell
# Terminal 1: Frontend
cd frontend
npm run dev
# Access at http://localhost:3000

# Terminal 2: Main API
cd backend\main-service
npm run dev
# Access at http://localhost:3001

# Terminal 3: Payment API
cd backend\payment-service
npm run dev
# Access at http://localhost:3002
```

**Option B: Using Docker Compose (full stack)**

```powershell
cd docker
docker-compose up -d
# All services will start automatically
```

---

## Production Deployment

### 1. Build Applications

```powershell
# Frontend
cd frontend
npm run build

# Backend services
cd ..\backend\main-service
npm run build

cd ..\payment-service
npm run build
```

### 2. Deploy to Cloud

#### Option A: Deploy to VPS (DigitalOcean, Linode, etc.)

1. Create VPS with Ubuntu 22.04
2. Install Docker and Docker Compose
3. Copy project files:
   ```bash
   scp -r ./FYP user@your-server-ip:/home/user/
   ```
4. SSH into server:
   ```bash
   ssh user@your-server-ip
   cd /home/user/FYP/docker
   docker-compose up -d
   ```

#### Option B: Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

#### Option C: Deploy Backend to Railway/Render

1. Create account at https://railway.app or https://render.com
2. Connect GitHub repository
3. Configure environment variables
4. Deploy each service separately

### 3. Configure DNS

1. Purchase domain (e.g., cryptomarket.com)
2. Add A records:
   - `cryptomarket.com` → Frontend IP
   - `api.cryptomarket.com` → Backend IP
   - `payment.cryptomarket.com` → Payment API IP

### 4. Setup SSL Certificates

```bash
# Using Certbot (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d cryptomarket.com -d api.cryptomarket.com
```

### 5. Configure Firewall

```bash
# Allow HTTP, HTTPS, SSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check all services
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3000/

# Check Docker containers
docker ps
docker logs marketplace-main-api
docker logs marketplace-payment-api
```

### Database Backup

```powershell
# Backup
docker exec marketplace-postgres pg_dump -U marketplace marketplace_db > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i marketplace-postgres psql -U marketplace -d marketplace_db < backup_20240101.sql
```

### Update Application

```powershell
# Pull latest code
git pull origin main

# Rebuild and restart
cd docker
docker-compose down
docker-compose up -d --build
```

---

## Troubleshooting

### Issue: Port already in use

```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <process_id> /F
```

### Issue: Docker containers won't start

```powershell
# Reset Docker
docker-compose down -v
docker system prune -a
docker-compose up -d
```

### Issue: Database connection failed

```powershell
# Check PostgreSQL is running
docker ps | findstr postgres

# Test connection
docker exec -it marketplace-postgres psql -U marketplace -d marketplace_db
```

### Issue: Frontend can't connect to backend

1. Check NEXT_PUBLIC_API_URL in `.env`
2. Ensure backend is running: `curl http://localhost:3001/health`
3. Check browser console for CORS errors
4. Verify API URLs don't have trailing slashes

### Issue: MetaMask connection fails

1. Ensure HTTPS is enabled (required for wallet connection)
2. Check WalletConnect project ID is correct
3. Clear browser cache and reconnect wallet
4. Try in incognito mode

---

## Performance Optimization

### 1. Enable Redis Caching

Ensure Redis is properly configured for:
- Price caching (1s TTL)
- Session management
- Rate limiting

### 2. Database Optimization

```sql
-- Create additional indexes if needed
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('english', name || ' ' || description));

-- Analyze tables
ANALYZE products;
ANALYZE orders;
ANALYZE payments;
```

### 3. CDN Configuration

Upload static assets (logos, images) to CDN:
- Cloudinary
- AWS CloudFront
- Cloudflare

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable HTTPS in production
- [ ] Configure firewall rules
- [ ] Regular database backups
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (DOMPurify)
- [ ] CSRF protection (NextAuth)
- [ ] Private keys stored securely (environment variables only)
- [ ] API keys rotated regularly

---

## Support

For issues or questions:
- Check `IMPLEMENTATION_GUIDE.md` for code details
- Review `API.md` for endpoint documentation
- See `WEB3_FLOWS.md` for payment flow explanations
- Contact development team

---

**Last Updated:** January 2026
