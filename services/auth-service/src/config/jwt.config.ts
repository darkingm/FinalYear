import { Secret, SignOptions } from 'jsonwebtoken';

export interface JWTPayload {
  id: string;
  email?: string;
  username?: string;
  role?: string;
}

export interface TokenConfig {
  secret: Secret;
  expiresIn: string | number;
  algorithm: 'HS256';
}


function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${name}`);
  }
  return value;
}

export const jwtConfig = {
  access: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    algorithm: 'HS256'
  } as TokenConfig,

  refresh: {
    secret: requireEnv('JWT_REFRESH_SECRET'),
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    algorithm: 'HS256'
  } as TokenConfig
};