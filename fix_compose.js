const fs = require('fs');
let c = fs.readFileSync('docker/docker-compose.prod.yml', 'utf8');

const newContainer = `
  postgres-payment:
    image: postgres:15-alpine
    container_name: marketplace-payment-postgres
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: payment_db
    expose:
      - "5432"
    volumes:
      - payment_postgres_data:/var/lib/postgresql/data
      - ../payment_init_database.sql/01_schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
    healthcheck:
      test: [ "CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-postgres} -d payment_db" ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    networks:
      - marketplace-network
    restart: unless-stopped
`;

c = c.replace(
  '    networks:\r\n      - marketplace-network\r\n    restart: unless-stopped\r\n\r\n  redis:',
  '    networks:\r\n      - marketplace-network\r\n    restart: unless-stopped\r\n' + newContainer.replace(/\n/g, '\r\n') + '\r\n  redis:'
);

fs.writeFileSync('docker/docker-compose.prod.yml', c);
console.log('Done!');
