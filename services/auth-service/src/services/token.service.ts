import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.config';
import RefreshToken from '../models/RefreshToken.model';
import User from '../models/User.model';
import logger from '../utils/logger';
import { hashToken, calculateExpiresAt } from '../utils/token.utils';

/**
 * TokenService - Handles JWT token generation, verification, and management
 * Separates token logic from controller
 */
export class TokenService {
  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      jwtConfig.access.secret,
      {
        expiresIn: jwtConfig.access.expiresIn,
        algorithm: jwtConfig.access.algorithm,
      }
    );
  }

  /**
   * Generate refresh token (long-lived) and save to DB
   */
  static async generateRefreshToken(user: User, ipAddress: string): Promise<string> {
    const refreshToken = jwt.sign(
      { id: user.id },
      jwtConfig.refresh.secret,
      {
        expiresIn: jwtConfig.refresh.expiresIn,
        algorithm: jwtConfig.refresh.algorithm,
      }
    );

    // Hash token before saving to DB
    const hashedToken = hashToken(refreshToken);
    const expiresAt = calculateExpiresAt(jwtConfig.refresh.expiresIn as string);

    await RefreshToken.create({
      userId: user.id,
      token: hashedToken,
      expiresAt,
      createdByIp: ipAddress,
    });

    return refreshToken;
  }

  /**
   * Verify refresh token and return decoded payload
   */
  static verifyRefreshToken(token: string): any {
    try {
      const decoded = jwt.verify(token, jwtConfig.refresh.secret, {
        algorithms: [jwtConfig.refresh.algorithm],
      }) as any;
      return decoded;
    } catch (error: any) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Verify access token and return decoded payload
   */
  static verifyAccessToken(token: string): any {
    try {
      const decoded = jwt.verify(token, jwtConfig.access.secret, {
        algorithms: [jwtConfig.access.algorithm],
      }) as any;
      return decoded;
    } catch (error: any) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Get refresh token record from DB
   */
  static async getRefreshTokenRecord(token: string) {
    const hashedToken = hashToken(token);
    return await RefreshToken.findOne({
      where: { token: hashedToken },
    });
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(
    tokenRecord: any,
    ipAddress: string,
    newTokenHash?: string
  ): Promise<void> {
    tokenRecord.revokedAt = new Date();
    tokenRecord.revokedByIp = ipAddress;
    if (newTokenHash) {
      tokenRecord.replacedByToken = newTokenHash;
    }
    await tokenRecord.save();
  }

  /**
   * Check if refresh token is active (not revoked and not expired)
   */
  static isRefreshTokenActive(tokenRecord: any): boolean {
    return !tokenRecord.revokedAt && new Date(tokenRecord.expiresAt) > new Date();
  }

  /**
   * Revoke all tokens for a user (used during password reset)
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId } }
    );
  }
}
