#!/usr/bin/env python3
"""VPS DB setup and verification script"""
import subprocess

def run_psql(sql):
    r = subprocess.run(
        ['docker', 'exec', 'marketplace-postgres', 'psql',
         '-U', 'postgres', '-d', 'marketplace_db', '-c', sql],
        capture_output=True, text=True
    )
    return r.stdout + r.stderr

# 1. Create schema_migrations if not exists
print("=== Creating schema_migrations table ===")
print(run_psql("""
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100) DEFAULT 'manual'
)
"""))

# 2. Check orders columns
print("=== Orders new columns ===")
print(run_psql("SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('tracking_number','release_tx_hash') ORDER BY column_name"))

# 3. Check disputes columns
print("=== Disputes new columns ===")
print(run_psql("SELECT column_name FROM information_schema.columns WHERE table_name='disputes' AND column_name IN ('evidence_urls','priority','admin_note','updated_at') ORDER BY column_name"))

# 4. Insert migration tracking records
print("=== Inserting migration records ===")
print(run_psql("""
INSERT INTO schema_migrations(version,name,filename,applied_by)
VALUES
  ('001','payment_system_fixes','001_payment_system_fixes.sql','manual-ssh'),
  ('002','dispute_system_improvements','002_dispute_system_improvements.sql','manual-ssh')
ON CONFLICT(version) DO NOTHING
"""))

# 5. Show all migrations
print("=== All migrations ===")
print(run_psql("SELECT version, name, applied_by, applied_at::timestamp(0) FROM schema_migrations ORDER BY version"))

# 6. Check nginx
import os
nginx_conf = '/etc/nginx/conf.d/kienai.conf'
if os.path.exists(nginx_conf):
    content = open(nginx_conf).read()
    has_payments = '/api/payments' in content
    has_payment_api = 'proxy_pass http://127.0.0.1:3002' in content
    print(f"\n=== Nginx config ===")
    print(f"Config exists: YES")
    print(f"Has /api/payments route: {has_payments}")
    print(f"Has payment-api proxy: {has_payment_api}")
    if not has_payments:
        print("WARNING: Missing /api/payments route!")
else:
    print(f"WARNING: {nginx_conf} not found!")

# 7. Check .env
env_file = '/root/services/FinalYear/docker/.env'
if os.path.exists(env_file):
    env = open(env_file).read()
    checks = ['INTERNAL_SERVICE_KEY','PAYMENT_SERVICE_URL','DOCKERHUB_USERNAME','POSTGRES_PASSWORD']
    print("\n=== .env key checks ===")
    for k in checks:
        print(f"  {k}: {'PRESENT' if k in env else 'MISSING'}")

# 8. Container status
print("\n=== Container status ===")
r = subprocess.run(['docker', 'ps', '--format', '{{.Names}} | {{.Status}}'], capture_output=True, text=True)
for line in sorted(r.stdout.strip().split('\n')):
    if 'marketplace' in line:
        print(f"  {line}")

# 9. Health checks
print("\n=== Health checks ===")
import urllib.request, urllib.error
for name, url in [('main-api', 'http://127.0.0.1:3001/api/health'), ('payment-api', 'http://127.0.0.1:3002/api/health'), ('frontend', 'http://127.0.0.1:3000')]:
    try:
        urllib.request.urlopen(url, timeout=5)
        print(f"  {name}: OK")
    except Exception as e:
        print(f"  {name}: FAIL ({e})")

print("\n=== DONE ===")
