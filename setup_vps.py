#!/usr/bin/env python3
"""Script chay tren VPS de setup toan bo production environment"""
import os, subprocess

DOCKER_DIR = "/root/services/FinalYear/docker"

# 1. Tao .env
env_content = (
    "POSTGRES_USER=postgres\n"
    "POSTGRES_PASSWORD=Kien29092004\n"
    "POSTGRES_DB=marketplace_db\n"
    "REDIS_PASSWORD=Kien29092004\n"
    "RABBITMQ_USER=kaitojpla\n"
    "RABBITMQ_PASSWORD=Kien29092004\n"
    "JWT_SECRET=fyp_jwt_Kien29092004_marketplace_2024_prod\n"
    "JWT_REFRESH_SECRET=fyp_refresh_Kien29092004_marketplace_2024_prod\n"
    "NEXTAUTH_URL=https://kienai.id.vn\n"
    "NEXTAUTH_SECRET=qo/QS42PzUNj0lFF9JbxXhD2S247Yf5ZMCoar3leqaw=\n"
    "DOCKERHUB_USERNAME=kiendzpro\n"
    "GOOGLE_CLIENT_SECRET=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\n"
    "FACEBOOK_CLIENT_SECRET=7bbce842d85baa3c21fca3101b42c832\n"
    "PAYPAL_SECRET=EPxefifbE6-6hPXAsqdY8jGlxcTpYRwuAjhT2aRPxWChSK0QOwIhijGbgwfRNhS2TEN2FSwSG-Mf4hhN\n"
    "BLOCKCHAIN_PRIVATE_KEY=your_private_key_here\n"
    "MORALIS_API_KEY=your_moralis_api_key\n"
)

print("=== Writing .env ===")
with open(DOCKER_DIR + "/.env", "w") as f:
    f.write(env_content)
print("OK")

# 2. Tao docker-compose.prod.yml
compose_content = """version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: marketplace-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: Kien29092004
      POSTGRES_DB: marketplace_db
    expose:
      - '5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../init_database.sql:/docker-entrypoint-initdb.d
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - marketplace-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: marketplace-redis
    command: redis-server --appendonly yes --requirepass Kien29092004
    expose:
      - '6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', '-a', 'Kien29092004', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - marketplace-network
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: marketplace-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: kaitojpla
      RABBITMQ_DEFAULT_PASS: Kien29092004
      RABBITMQ_DEFAULT_VHOST: /
    ports:
      - '127.0.0.1:15672:15672'
    expose:
      - '5672'
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping']
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - marketplace-network
    restart: unless-stopped

  main-api:
    image: kiendzpro/marketplace-main-api:latest
    container_name: marketplace-main-api
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://postgres:Kien29092004@postgres:5432/marketplace_db
      REDIS_URL: redis://:Kien29092004@redis:6379
      RABBITMQ_URL: amqp://kaitojpla:Kien29092004@rabbitmq:5672
      JWT_SECRET: fyp_jwt_Kien29092004_marketplace_2024_prod
      JWT_REFRESH_SECRET: fyp_refresh_Kien29092004_marketplace_2024_prod
      JWT_EXPIRES_IN: 24h
      JWT_REFRESH_EXPIRES_IN: 7d
      SMTP_HOST: smtp.gmail.com
      SMTP_PORT: 587
      SMTP_USER: kaitojpla@gmail.com
      SMTP_PASSWORD: cltk gtwx cgek mofm
      HCAPTCHA_SECRET: ES_9a13fd597b2c4cd5a3b0ded489fd5e17
      CLOUDINARY_CLOUD_NAME: deyjlti3v
      CLOUDINARY_API_KEY: 769799281583264
      CLOUDINARY_API_SECRET: FpgAWZCGduORuwPClfJXt5d6aas
      FRONTEND_URL: https://kienai.id.vn
    ports:
      - '127.0.0.1:3001:3001'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - marketplace-network
    restart: unless-stopped

  payment-api:
    image: kiendzpro/marketplace-payment-api:latest
    container_name: marketplace-payment-api
    environment:
      NODE_ENV: production
      PORT: 3002
      DATABASE_URL: postgresql://postgres:Kien29092004@postgres:5432/marketplace_db
      REDIS_URL: redis://:Kien29092004@redis:6379
      RABBITMQ_URL: amqp://kaitojpla:Kien29092004@rabbitmq:5672
      PAYPAL_CLIENT_ID: AYxcD1jBUgx2LMY2eoXyM
      PAYPAL_SECRET: EPxefifbE6-6hPXAsqdY8jGlxcTpYRwuAjhT2aRPxWChSK0QOwIhijGbgwfRNhS2TEN2FSwSG-Mf4hhN
      PAYPAL_MODE: sandbox
      ESCROW_CONTRACT_ADDRESS: 0xCDE08Be0190482691b3288C27240378497d74E79
      POLYGON_RPC_URL: https://polygon.drpc.org
      POLYGON_MUMBAI_RPC_URL: https://rpc-amoy.polygon.technology
      ARBITRUM_RPC_URL: https://arb1.arbitrum.io/rpc
      FRONTEND_URL: https://kienai.id.vn
    ports:
      - '127.0.0.1:3002:3002'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - marketplace-network
    restart: unless-stopped

  frontend:
    image: kiendzpro/marketplace-frontend:latest
    container_name: marketplace-frontend
    environment:
      NODE_ENV: production
      NEXTAUTH_URL: https://kienai.id.vn
      NEXTAUTH_SECRET: qo/QS42PzUNj0lFF9JbxXhD2S247Yf5ZMCoar3leqaw=
      GOOGLE_CLIENT_ID: 946575631331-1p51ll7tpqd0bo1impek2nggoqjrcoo8.apps.googleusercontent.com
      GOOGLE_CLIENT_SECRET: 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
      FACEBOOK_CLIENT_ID: 1497732641781702
      FACEBOOK_CLIENT_SECRET: 7bbce842d85baa3c21fca3101b42c832
      PAYPAL_SECRET: EPxefifbE6-6hPXAsqdY8jGlxcTpYRwuAjhT2aRPxWChSK0QOwIhijGbgwfRNhS2TEN2FSwSG-Mf4hhN
    ports:
      - '127.0.0.1:3000:3000'
    depends_on:
      - main-api
      - payment-api
    networks:
      - marketplace-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:

networks:
  marketplace-network:
    driver: bridge
"""

print("=== Writing docker-compose.prod.yml ===")
with open(DOCKER_DIR + "/docker-compose.prod.yml", "w") as f:
    f.write(compose_content)
print("OK")

# 3. Nginx config - LF line endings, no Windows CR
nginx_conf = (
    "server {\n"
    "    listen 80;\n"
    "    server_name kienai.id.vn www.kienai.id.vn;\n"
    "    return 301 https://$host$request_uri;\n"
    "}\n"
    "\n"
    "server {\n"
    "    listen 443 ssl;\n"
    "    server_name kienai.id.vn www.kienai.id.vn;\n"
    "\n"
    "    ssl_certificate /etc/letsencrypt/live/kienai.id.vn/fullchain.pem;\n"
    "    ssl_certificate_key /etc/letsencrypt/live/kienai.id.vn/privkey.pem;\n"
    "    include /etc/letsencrypt/options-ssl-nginx.conf;\n"
    "    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n"
    "\n"
    "    client_max_body_size 20M;\n"
    "    server_tokens off;\n"
    "    add_header X-Frame-Options SAMEORIGIN;\n"
    "    add_header X-Content-Type-Options nosniff;\n"
    "\n"
    "    # NextAuth endpoints -> Frontend\n"
    "    location ~ ^/api/auth/(session|csrf|signin|signout|callback|providers|error|_log) {\n"
    "        proxy_pass http://127.0.0.1:3000;\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Upgrade $http_upgrade;\n"
    "        proxy_set_header Connection upgrade;\n"
    "        proxy_set_header Host $host;\n"
    "        proxy_set_header X-Real-IP $remote_addr;\n"
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
    "        proxy_set_header X-Forwarded-Proto $scheme;\n"
    "        proxy_cache_bypass $http_upgrade;\n"
    "    }\n"
    "\n"
    "    # Main API\n"
    "    location /api/ {\n"
    "        proxy_pass http://127.0.0.1:3001;\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Host $host;\n"
    "        proxy_set_header X-Real-IP $remote_addr;\n"
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
    "        proxy_set_header X-Forwarded-Proto $scheme;\n"
    "    }\n"
    "\n"
    "    # Payment API\n"
    "    location /payment/ {\n"
    "        proxy_pass http://127.0.0.1:3002/;\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Host $host;\n"
    "        proxy_set_header X-Real-IP $remote_addr;\n"
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
    "        proxy_set_header X-Forwarded-Proto $scheme;\n"
    "    }\n"
    "\n"
    "    # Frontend catch-all\n"
    "    location / {\n"
    "        proxy_pass http://127.0.0.1:3000;\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Upgrade $http_upgrade;\n"
    "        proxy_set_header Connection upgrade;\n"
    "        proxy_set_header Host $host;\n"
    "        proxy_set_header X-Real-IP $remote_addr;\n"
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
    "        proxy_set_header X-Forwarded-Proto $scheme;\n"
    "        proxy_cache_bypass $http_upgrade;\n"
    "    }\n"
    "}\n"
)

print("=== Writing nginx config ===")
with open("/etc/nginx/conf.d/kienai.conf", "w") as f:
    f.write(nginx_conf)
# Remove conflicting configs
for fn in ["kienai.id.vn.conf", "kienai.id.vn.confnano"]:
    path = "/etc/nginx/conf.d/" + fn
    if os.path.exists(path):
        os.remove(path)
        print("Removed " + fn)
print("OK")

# 4. Test + reload nginx
r = subprocess.run(["nginx", "-t"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
print("Nginx test:", r.returncode, r.stdout, r.stderr)
if r.returncode == 0:
    subprocess.run(["systemctl", "reload", "nginx"])
    print("Nginx reloaded OK")

# 5. Pull and start Docker containers
print("=== Pulling Docker images ===")
r = subprocess.run(
    ["docker", "compose", "-f", "docker-compose.prod.yml", "pull"],
    cwd=DOCKER_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True
)
stdout_tail = r.stdout[-500:] if len(r.stdout) > 500 else r.stdout
stderr_tail = r.stderr[-300:] if len(r.stderr) > 300 else r.stderr
print(stdout_tail, stderr_tail)

print("=== Starting containers ===")
r = subprocess.run(
    ["docker", "compose", "-f", "docker-compose.prod.yml", "up", "-d", "--remove-orphans"],
    cwd=DOCKER_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True
)
stderr_tail2 = r.stderr[-500:] if len(r.stderr) > 500 else r.stderr
print(r.stdout, stderr_tail2)

print("=== Container status ===")
subprocess.run(["docker", "ps", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"])
