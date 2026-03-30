---
name: web3market-deploy-pipeline
description: Use when deploying Web3Market to VPS (103.20.96.79), building Docker images, running migrations, or debugging deploy failures — covers the full build-push-SSH-migrate-restart cycle.
---

# Web3Market — Deploy Pipeline

## ⛔ CRITICAL RULE: NEVER BUILD IMAGES ON VPS

**NEVER run `docker build` on the VPS (103.20.96.79).** The VPS has limited resources and building images WILL crash it.

**How it works:**
1. Push code to GitHub (`git push origin main`)
2. **GitHub Actions CI/CD** automatically builds Docker images and pushes to Docker Hub (`kiendzpro/*`)
3. On VPS: only `docker pull` + restart containers

```bash
# ✅ CORRECT: Pull pre-built images on VPS
docker pull kiendzpro/marketplace-frontend:latest
docker compose -f docker-compose.prod.yml --env-file .env up -d frontend

# ❌ WRONG: NEVER do this on VPS
docker build -t ... -f frontend/Dockerfile frontend  # WILL CRASH VPS!
```

## Quick Reference

```bash
# Full deploy (code changes + possible schema changes)
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
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
ESCROW_CONTRACT_LOCALHOST=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

## Nginx Config (System Nginx — NOT in Docker)

Nginx runs as system service proxying to Docker containers:
- `/` → `http://127.0.0.1:3000` (frontend)
- `/api/` (except `/api/payments`) → `http://127.0.0.1:3001/api/`
- `/payment/` → `http://127.0.0.1:3002/`
- SSL cert: Let's Encrypt (auto-renew via certbot)

Nginx config: `/etc/nginx/conf.d/kienai.conf`

Full routing table:
| External path | Container | Port |
|---|---|---|
| `/api/auth/*` | frontend (NextAuth) | 3000 |
| `/api/payments/*` | payment-api | 3002 |
| `/payment/*` | payment-api (legacy) | 3002 |
| `/api/*` | main-api | 3001 |
| `/*` | frontend (Next.js) | 3000 |
| `:8545` (direct) | hardhat-node | 8545 |

**Health endpoints** (NOT `/api/health`):
- main-api: `curl http://127.0.0.1:3001/health`
- payment-api: `curl http://127.0.0.1:3002/health`
- frontend: `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3000`

## Deploy Checklist

Before deploying:
- [ ] TypeScript compiles: `npx tsc --noEmit` (frontend + both services)
- [ ] New DB columns/tables → create migration file in `init_database.sql/migrations/`
- [ ] New env vars → add to `docker-compose.prod.yml` AND VPS `.env`
- [ ] Docker is running locally
- [ ] Logged in to Docker Hub: `docker login`

After deploying:
- [ ] `docker logs marketplace-db-migrator` — migrations applied
- [ ] `curl -sf http://127.0.0.1:3001/health` on VPS  ← `/health` not `/api/health`
- [ ] `curl -sf http://127.0.0.1:3002/health` on VPS
- [ ] Check `https://kienai.id.vn` in browser

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
CLOUDINARY_CLOUD_NAME=deyjlti3v
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=deyjlti3v
CLOUDINARY_EVIDENCE_PRESET=marketplace_evidence
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
FACEBOOK_CLIENT_SECRET=<facebook-secret>
PAYPAL_SECRET=<paypal-secret>
SMTP_PASSWORD=<gmail-app-password>
HCAPTCHA_SECRET=<hcaptcha-secret>
BLOCKCHAIN_PRIVATE_KEY=<wallet-private-key>
```
