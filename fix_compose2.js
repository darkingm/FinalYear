const fs = require('fs');
let c = fs.readFileSync('docker/docker-compose.prod.yml', 'utf8');

const target1 = `      PORT: 3002\r
      DATABASE_URL: postgresql://postgres:%40Kien2909@postgres:5432/marketplace_db`;

const repl1 = `      PORT: 3002\r
      DATABASE_URL: postgresql://postgres:%40Kien2909@postgres-payment:5432/payment_db\r
      MAIN_DATABASE_URL: postgresql://postgres:%40Kien2909@postgres:5432/marketplace_db`;

c = c.replace(target1, repl1);

const target2 = `    depends_on:\r
      postgres:\r
        condition: service_healthy\r
      redis:`;

const repl2 = `    depends_on:\r
      postgres:\r
        condition: service_healthy\r
      postgres-payment:\r
        condition: service_healthy\r
      redis:`;

c = c.replace(target2, repl2);

const target3 = `volumes:\r
  postgres_data:\r
  redis_data:`;

const repl3 = `volumes:\r
  postgres_data:\r
  payment_postgres_data:\r
  redis_data:`;

c = c.replace(target3, repl3);

fs.writeFileSync('docker/docker-compose.prod.yml', c);
console.log('Done!');
