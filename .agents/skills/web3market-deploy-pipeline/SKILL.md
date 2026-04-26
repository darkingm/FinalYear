---
name: web3market-deploy-pipeline
description: Use when deploying Web3Market to VPS (103.20.96.79), building Docker images, running migrations, or debugging deploy failures — covers the full build-push-SSH-migrate-restart cycle.
---

# Web3Market — Deploy Pipeline

## ⛔ Critical Rules: Local Source, No Heavy Work On VPS

**Local workspace is the source of truth.** For this single-developer project, treat `C:\Users\Asus\Documents\FYP\FYP` as newer than GitHub, VPS git state, or any remote branch unless the user explicitly says otherwise.

**NEVER run `git pull`, `git reset`, branch switching, or destructive cleanup on the VPS** unless the user explicitly authorizes that exact command. The VPS repo can be dirty and production-specific. Sync from local by copying selected files or by pulling pre-built Docker images, not by making VPS Git the authority.

**NEVER run CPU-heavy work on the VPS (103.20.96.79).** It has only 2 CPU cores. Do not run Docker image builds, `npm run build`, `next build`, TypeScript project builds, Hardhat compile/test, or similar heavy jobs there unless the user explicitly authorizes that exact command. These can spike CPU and make production unresponsive.

**How it works:**
1. Make and verify code in local workspace.
2. Build/test locally or via GitHub Actions as a build worker.
3. Push pre-built Docker images to Docker Hub (`kiendzpro/*`) if images changed.
4. On VPS: only copy lightweight config/migrations if needed, `docker pull`, run lightweight DB migrations, set env, restart containers, and read logs/health checks.

```bash
# ✅ CORRECT on VPS: pull pre-built images and restart
docker pull kiendzpro/marketplace-frontend:latest
docker compose -f docker-compose.prod.yml --env-file .env up -d frontend

# ❌ WRONG on VPS: heavy jobs
docker build -t ... -f frontend/Dockerfile frontend  # WILL CRASH VPS!
npm run build                                      # too heavy for VPS
npx hardhat test                                   # too heavy for VPS
npx hardhat compile                                # too heavy for VPS
git pull origin main                               # wrong authority unless user explicitly asks
```

## Quick Reference

```bash
# Full deploy from local/GitHub-built images, never VPS build
bash scripts/deploy.sh

# Only schema migration (no code changes)
BUILD_ALL=false bash scripts/deploy.sh

# SSH to VPS
ssh root@103.20.96.79

# Check all containers
docker ps --format 'NAME:{{.Names}}  STATUS:{{.Status}}'

# Check service logs
docker logs marketplace-main-api --tail 50
docker logs marketplace-payment-api --tail 50
docker logs marketplace-db-migrator
docker logs marketplace-frontend --tail 20

# Manual migration check
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version;"
```

## Image Names (Docker Hub: `kiendzpro/`)

| Service | Image |
|---|---|
| main-api | `kiendzpro/marketplace-main-api:latest` |
| payment-api | `kiendzpro/marketplace-payment-api:latest` |
| frontend | `kiendzpro/marketplace-frontend:latest` |
| ai-service | `kiendzpro/marketplace-ai-service:latest` |
| db-migrator | `kiendzpro/marketplace-db-migrator:latest` |

## Dockerfile Locations

| Service | Dockerfile | Context |
|---|---|---|
| main-api | `backend/main-service/Dockerfile` | `backend/main-service` |
| payment-api | `backend/payment-service/Dockerfile` | `backend/payment-service` |
| frontend | `frontend/Dockerfile` | `frontend` |
| db-migrator | `init_database.sql/Dockerfile.migrator` | `init_database.sql` |

## VPS Layout

```
/root/services/FinalYear/
├── docker/
│   ├── docker-compose.prod.yml
│   └── .env                  ← secrets (never committed to git)
├── init_database.sql/
│   ├── schema.sql
│   ├── db-migrate.sh
│   └── migrations/
└── contracts/
```

## Deploy Failure Scenarios

### db-migrator exits with error
```bash
docker logs marketplace-db-migrator
# Common causes:
# 1. PostgreSQL not healthy yet — db-migrator waits 60s, then fails
# 2. SQL syntax error in migration file
# 3. Constraint violation (migration not idempotent)
```
Fix: Ensure migration uses `IF NOT EXISTS` and `DO $$ EXCEPTION` blocks.

### main-api fails to start (depends on db-migrator)
```bash
docker logs marketplace-main-api
# "db-migrator" condition: service_completed_successfully
# If migrator exited non-zero, main-api won't start
```
Fix: Fix migration file, rebuild db-migrator image, `docker rm -f marketplace-db-migrator`, redeploy.

### Port already in use
```bash
# Kill stuck container
docker stop marketplace-main-api && docker rm marketplace-main-api
docker compose -f docker-compose.prod.yml --env-file .env up -d main-api
```

### Fresh redeploy (nuclear option — keeps data volumes)
```bash
bash scripts/vps-full-redeploy.sh
# Stops ALL containers, pulls new images, restarts everything
# Data volumes (postgres_data, etc.) are preserved
```

### Complete wipe (rare — loses ALL data)
```bash
docker compose -f docker-compose.prod.yml down -v  # -v removes volumes
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## Environment File on VPS

Location: `/root/services/FinalYear/docker/.env`

Must contain (minimum):
```
POSTGRES_PASSWORD=...
POSTGRES_USER=postgres
POSTGRES_DB=marketplace_db
JWT_SECRET=...
JWT_REFRESH_SECRET=...
DOCKERHUB_USERNAME=kiendzpro
INTERNAL_SERVICE_KEY=...         ← same value for both services
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://kienai.id.vn
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
HCAPTCHA_SECRET=...
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
ESCROW_CONTRACT_LOCALHOST=0x5FbDB2315678afecb367f032d93F642f64180aa3
LOCALHOST_RPC_URL=http://hardhat-node:8545
NEXT_PUBLIC_HARDHAT_RPC_URL=https://kienai.id.vn/rpc/hardhat
PAYMENT_INVOICE_RATE_LIMIT_MAX=10
```

## Nginx Config (System Nginx — NOT in Docker)

Nginx runs as system service proxying to Docker containers:
- `/` → `http://127.0.0.1:3000` (frontend)
- `/api/` → `http://127.0.0.1:3001/api/` (main-service, with explicit NextAuth exceptions above it)
- `/payment/` → `http://127.0.0.1:3002/` (payment-service; frontend base URL is `https://kienai.id.vn/payment`)
- SSL cert: Let's Encrypt (auto-renew via certbot)

Nginx config: `/etc/nginx/conf.d/kienai.conf`

Full routing table:
| External path | Container | Port |
|---|---|---|
| `/api/auth/session`, `/api/auth/csrf`, `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback/*`, `/api/auth/providers`, `/api/auth/error`, `/api/auth/_log` | frontend (NextAuth only) | 3000 |
| `/api/auth/register`, `/api/auth/login`, `/api/auth/wallet-login`, `/api/auth/oauth`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password` | main-api | 3001 |
| `/payment/*` | payment-api | 3002 |
| `/rpc/hardhat` | hardhat-node | 8545 |
| `/api/*` | main-api | 3001 |
| `/*` | frontend (Next.js) | 3000 |
| `:8545` (direct, if exposed) | hardhat-node | 8545 |

**Auth routing rule:** never use a system-nginx catch-all like `location ^~ /api/auth/ { proxy_pass frontend; }`. That sends backend endpoints such as register, forgot-password, reset-password, wallet-login, oauth, refresh, and logout to NextAuth and causes confusing 404/405/403 production failures. Use the narrow NextAuth regex from `docker/nginx/nginx.conf` or move backend auth to a separate namespace before changing this.

**Hardhat RPC rule:** public browser config must point to `https://kienai.id.vn/rpc/hardhat`. If `docker-compose.prod.yml` or VPS `.env` contains `NEXT_PUBLIC_HARDHAT_RPC_URL=http://103.20.96.79:8545`, fix it before building the frontend image; direct HTTP IP can be blocked by HTTPS mixed-content/CORS and is only acceptable for manual infrastructure debugging.

**Health endpoints** (NOT `/api/health`):
- main-api: `curl http://127.0.0.1:3001/health`
- payment-api: `curl http://127.0.0.1:3002/health`
- frontend: `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3000`

## Deploy Checklist

Before deploying:
- [ ] TypeScript compiles: `npx tsc --noEmit` (frontend + both services)
- [ ] New DB columns/tables → create migration file in `init_database.sql/migrations/`
- [ ] New env vars → add to `docker-compose.prod.yml` AND VPS `.env`
- [ ] Docker build/test happens locally or in GitHub Actions, never on the VPS
- [ ] Logged in to Docker Hub locally or CI has push credentials
- [ ] If syncing files manually, back up overwritten VPS files first and do not use `git pull` on VPS

After deploying:
- [ ] `docker logs marketplace-db-migrator` — migrations applied
- [ ] `curl -sf http://127.0.0.1:3001/health` on VPS  ← `/health` not `/api/health`
- [ ] `curl -sf http://127.0.0.1:3002/health` on VPS
- [ ] Check `https://kienai.id.vn` in browser
- [ ] Verify auth routing from outside nginx: register/forgot/reset hit main-api; NextAuth session/callback hit frontend.
- [ ] Verify Hardhat RPC from browser-safe URL: `curl -sf https://kienai.id.vn/rpc/hardhat` should reach the node and not require direct `http://103.20.96.79:8545`.
- [ ] Verify login methods separately: email/password, Google OAuth, wallet SIWE, register, refresh after reload, and logout blacklist.

## Tricky Issues Learned

### 1. Containers stuck in `Created` (not `Up`)
Happens when `db-migrator` image doesn't exist yet on Docker Hub (first deploy after adding migrator).

**Fix** — use override file to skip db-migrator dependency temporarily:
```bash
# On VPS
cp /path/to/docker-compose.override-nomigrator.yml \
   /root/services/FinalYear/docker/docker-compose.override.yml

cd /root/services/FinalYear/docker
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env up -d

# After CI builds db-migrator image successfully:
rm /root/services/FinalYear/docker/docker-compose.override.yml
```

### 2. PowerShell SSH quoting issues
PowerShell expands `$` and mangles quotes — heredocs and `$()` don't work.

**Fix** — write SQL to local file, scp, docker cp, then run:
```powershell
# Write file locally
"SELECT version FROM schema_migrations;" | Out-File -Encoding utf8 /tmp/check.sql
scp /tmp/check.sql root@103.20.96.79:/tmp/
ssh root@103.20.96.79 "docker cp /tmp/check.sql marketplace-postgres:/tmp/ && docker exec marketplace-postgres psql -U postgres -d marketplace_db -f /tmp/check.sql"
```

### 3. DO block with multiple EXCEPTION clauses
PostgreSQL only allows ONE `EXCEPTION` block per `DO` block.
```sql
-- WRONG:
DO $$ BEGIN ALTER TABLE ... ;
EXCEPTION WHEN duplicate_table THEN NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;  -- syntax error!

-- CORRECT:
DO $$ BEGIN ALTER TABLE ... ;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
```

### 4. Container name conflict on `docker compose up`
```bash
docker stop marketplace-main-api marketplace-payment-api marketplace-frontend
docker rm marketplace-main-api marketplace-payment-api marketplace-frontend
docker compose ... up -d --no-deps main-api payment-api frontend
```

### 5. VPS .env minimum required keys
```env
DOCKERHUB_USERNAME=kiendzpro
INTERNAL_SERVICE_KEY=<your-secret>   # CRITICAL — must match in both services
PAYMENT_SERVICE_URL=http://payment-api:3002
POSTGRES_PASSWORD=<your-db-password>
REDIS_PASSWORD=<your-redis-password>
RABBITMQ_PASSWORD=<your-rabbitmq-password>
JWT_SECRET=<min-32-chars>
JWT_REFRESH_SECRET=<min-32-chars>
NEXTAUTH_SECRET=<nextauth-secret>
NEXTAUTH_URL=https://kienai.id.vn
CLOUDINARY_CLOUD_NAME=deyjlti3v
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=deyjlti3v
CLOUDINARY_EVIDENCE_PRESET=marketplace_evidence
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
FACEBOOK_CLIENT_SECRET=<facebook-secret>
PAYPAL_SECRET=<paypal-secret>
SMTP_PASSWORD=<gmail-app-password>
HCAPTCHA_SECRET=<hcaptcha-secret>
BLOCKCHAIN_PRIVATE_KEY=<wallet-private-key>
NEXT_PUBLIC_HARDHAT_RPC_URL=https://kienai.id.vn/rpc/hardhat
```
