import logger from './logger';

interface RequiredEnvVars {
  [key: string]: {
    required: boolean;
    description: string;
    defaultValue?: string;
    validate?: (value: string) => boolean;
  };
}

const requiredEnvVars: RequiredEnvVars = {
  JWT_SECRET: {
    required: true,
    description: 'JWT secret key for signing tokens',
    validate: (value: string) => {
      if (value === 'your-super-secret-jwt-key-change-in-production') {
        logger.error('SECURITY WARNING: Using default JWT_SECRET! Change it in production!');
        return false;
      }
      if (value.length < 32) {
        logger.error('SECURITY WARNING: JWT_SECRET should be at least 32 characters!');
        return false;
      }
      return true;
    },
  },
  JWT_REFRESH_SECRET: {
    required: true,
    description: 'JWT refresh secret key',
    validate: (value: string) => {
      if (value === 'your-super-secret-refresh-key-change-in-production') {
        logger.error('SECURITY WARNING: Using default JWT_REFRESH_SECRET! Change it in production!');
        return false;
      }
      if (value.length < 32) {
        logger.error('SECURITY WARNING: JWT_REFRESH_SECRET should be at least 32 characters!');
        return false;
      }
      return true;
    },
  },
  POSTGRES_PASSWORD: {
    required: true,
    description: 'PostgreSQL password',
    validate: (value: string) => {
      if (value === '1' || value === 'postgres' || value.length < 8) {
        logger.error('SECURITY WARNING: Weak PostgreSQL password detected!');
        return false;
      }
      return true;
    },
  },
  REDIS_PASSWORD: {
    required: false,
    description: 'Redis password (optional but recommended for production)',
  },
  RABBITMQ_DEFAULT_PASS: {
    required: false,
    description: 'RabbitMQ password',
    validate: (value: string) => {
      if (value === 'guest' && process.env.NODE_ENV === 'production') {
        logger.error('SECURITY WARNING: Using default RabbitMQ password in production!');
        return false;
      }
      return true;
    },
  },
};

export const validateEnvironmentVariables = (): boolean => {
  let isValid = true;
  const errors: string[] = [];

  for (const [key, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];

    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${key} - ${config.description}`);
      isValid = false;
    }

    if (value && config.validate && !config.validate(value)) {
      errors.push(`Invalid value for environment variable: ${key} - ${config.description}`);
      isValid = false;
    }
  }

  if (errors.length > 0) {
    logger.error('Environment validation errors:');
    errors.forEach((error) => logger.error(`  - ${error}`));
  }

  return isValid;
};

export const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && defaultValue) {
    logger.warn(`Environment variable ${key} not set, using default value`);
    return defaultValue;
  }
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
};

