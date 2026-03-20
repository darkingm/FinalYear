#!/usr/bin/env python3
"""
Script chạy trên VPS để setup production environment.
KHÔNG chứa secrets — đọc từ tham số hoặc prompt.
Secrets thực sự lưu trong /root/services/FinalYear/docker/.env (không commit git).
"""
import os, subprocess

DOCKER_DIR = "/root/services/FinalYear/docker"

# 1. Tạo .env template (điền giá trị thực vào file .env trên VPS, không commit)
env_template = (
    "# === Web3Market Production .env ===\n"
    "# File này KHÔNG được commit. Điền đúng giá trị trước khi chạy.\n"
    "\n"
    "POSTGRES_USER=postgres\n"
    "POSTGRES_PASSWORD=CHANGE_ME\n"
    "POSTGRES_DB=marketplace_db\n"
    "REDIS_PASSWORD=CHANGE_ME\n"
    "RABBITMQ_USER=kaitojpla\n"
    "RABBITMQ_PASSWORD=CHANGE_ME\n"
    "\n"
    "JWT_SECRET=CHANGE_ME_min_32_chars\n"
    "JWT_REFRESH_SECRET=CHANGE_ME_min_32_chars\n"
    "\n"
    "NEXTAUTH_URL=https://kienai.id.vn\n"
    "NEXTAUTH_SECRET=CHANGE_ME\n"
    "\n"
    "DOCKERHUB_USERNAME=kiendzpro\n"
    "\n"
    "GOOGLE_CLIENT_ID=CHANGE_ME\n"
    "GOOGLE_CLIENT_SECRET=CHANGE_ME\n"
    "FACEBOOK_CLIENT_ID=CHANGE_ME\n"
    "FACEBOOK_CLIENT_SECRET=CHANGE_ME\n"
    "\n"
    "PAYPAL_CLIENT_ID=CHANGE_ME\n"
    "PAYPAL_SECRET=CHANGE_ME\n"
    "PAYPAL_MODE=sandbox\n"
    "\n"
    "CLOUDINARY_CLOUD_NAME=CHANGE_ME\n"
    "CLOUDINARY_API_KEY=CHANGE_ME\n"
    "CLOUDINARY_API_SECRET=CHANGE_ME\n"
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=CHANGE_ME\n"
    "\n"
    "BLOCKCHAIN_PRIVATE_KEY=CHANGE_ME\n"
    "MORALIS_API_KEY=CHANGE_ME\n"
    "\n"
    "INTERNAL_SERVICE_KEY=CHANGE_ME_min_32_chars\n"
    "PAYMENT_SERVICE_URL=http://payment-api:3002\n"
    "\n"
    "ESCROW_CONTRACT_LOCALHOST=0x5FbDB2315678afecb367f032d93F642f64180aa3\n"
    "ESCROW_CONTRACT_POLYGON_AMOY=0xCDE08Be0190482691b3288C27240378497d74E79\n"
    "\n"
    "HCAPTCHA_SECRET=CHANGE_ME\n"
    "GROQ_API_KEY=CHANGE_ME\n"
)

env_path = DOCKER_DIR + "/.env"

if os.path.exists(env_path):
    print(f"✓ .env already exists at {env_path} — not overwriting.")
    print("  Edit manually to add missing keys.")
else:
    print("=== Writing .env TEMPLATE ===")
    with open(env_path, "w") as f:
        f.write(env_template)
    print(f"✓ Template written to {env_path}")
    print("  ⚠ Fill in all CHANGE_ME values before starting containers!")

# 2. Test + reload nginx
print("\n=== Testing nginx ===")
r = subprocess.run(["nginx", "-t"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
print("Nginx test:", r.returncode, r.stderr.strip())
if r.returncode == 0:
    subprocess.run(["systemctl", "reload", "nginx"])
    print("✓ Nginx reloaded")

# 3. Start containers
print("\n=== Starting containers ===")
r = subprocess.run(
    ["docker", "compose", "-f", "docker-compose.prod.yml", "--env-file", ".env", "up", "-d", "--remove-orphans"],
    cwd=DOCKER_DIR, universal_newlines=True
)

print("\n=== Container status ===")
subprocess.run(["docker", "ps", "--format", "table {{.Names}}\t{{.Status}}"])
