---
name: web3market-deploy-pipeline
description: Use when deploying Web3Market to VPS (103.20.96.79), building Docker images, running migrations, or debugging deploy failures — covers the full build-push-SSH-migrate-restart cycle.
---

# Web3Market — Deploy Pipeline

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

Nginx config: `/etc/nginx/sites-available/kienai.id.vn`

## Deploy Checklist

Before deploying:
- [ ] TypeScript compiles: `npx tsc --noEmit` (frontend + both services)
- [ ] New DB columns/tables → create migration file in `migrations/`
- [ ] New env vars → add to `docker-compose.prod.yml` AND VPS `.env`
- [ ] Docker is running locally
- [ ] Logged in to Docker Hub: `docker login`

After deploying:
- [ ] `docker logs marketplace-db-migrator` — migrations applied
- [ ] `curl -sf http://127.0.0.1:3001/api/health` on VPS
- [ ] `curl -sf http://127.0.0.1:3002/api/health` on VPS
- [ ] Check `https://kienai.id.vn` in browser
