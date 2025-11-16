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
}

export const jwtConfig = {
  access: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  } as TokenConfig,
  
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  } as TokenConfig
};