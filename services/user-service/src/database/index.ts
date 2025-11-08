import { Sequelize } from 'sequelize';
import logger from '../utils/logger';

const sequelize = new Sequelize({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB_USER || 'user_db',
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '1',
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export { sequelize };

