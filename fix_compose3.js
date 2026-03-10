const fs = require('fs');
let c = fs.readFileSync('docker/docker-compose.prod.yml', 'utf8');

c = c.replace(
`    depends_on:\r
      postgres:\r
        condition: service_healthy\r
      redis:\r
        condition: service_healthy\r
      rabbitmq:\r
        condition: service_healthy\r
    networks:\r
      - marketplace-network\r
    restart: unless-stopped\r
\r
  frontend:`,

`    depends_on:\r
      postgres:\r
        condition: service_healthy\r
      postgres-payment:\r
        condition: service_healthy\r
      redis:\r
        condition: service_healthy\r
      rabbitmq:\r
        condition: service_healthy\r
    networks:\r
      - marketplace-network\r
    restart: unless-stopped\r
\r
  frontend:`
);

fs.writeFileSync('docker/docker-compose.prod.yml', c);
console.log('Fixed payment-api depends!');
