import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { query } from '../../config/database';
import { setCache, getCache, deleteCache } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    username?: string;
    wallet_address?: string;
  }) {
    // Check if email already exists
    const existing = await query('SELECT * FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, username, wallet_address, role, status)
       VALUES ($1, $2, $3, $4, 'buyer', 'active')
       RETURNING user_id, email, username, wallet_address, role, status, created_at`,
      [data.email, password_hash, data.username, data.wallet_address]
    );

    const user = result.rows[0];

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    // Find user by email or username
    const result = await query(
      'SELECT * FROM users WHERE email = $1 OR username = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid email/username or password', 401);
    }

    const user = result.rows[0];

    // Check password — users who signed up via OAuth/wallet may not have a password
    if (!user.password_hash) {
      throw new AppError('Invalid email/username or password', 401);
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError('Invalid email/username or password', 401);
    }

    // Check status
    if (user.status !== 'active') {
      throw new AppError('Account is suspended', 403);
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async walletLogin(walletAddress: string, message: string, signature: string) {
    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new AppError('Invalid signature', 401);
    }

    // Find or create user
    let result = await query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    let user;
    if (result.rows.length === 0) {
      // Create new user
      result = await query(
        `INSERT INTO users (email, wallet_address, role, status)
         VALUES ($1, $2, 'buyer', 'active')
         RETURNING *`,
        [`${walletAddress}@wallet.local`, walletAddress]
      );
      user = result.rows[0];
    } else {
      user = result.rows[0];
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /** Link a wallet to the current user (email/password account). Verifies ownership via SIWE. */
  async linkWallet(userId: number, walletAddress: string, message: string, signature: string) {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new AppError('Invalid signature', 401);
    }
    const normalized = walletAddress.toLowerCase();
    const existing = await query(
      'SELECT user_id FROM users WHERE LOWER(wallet_address) = $1',
      [normalized]
    );
    if (existing.rows.length > 0 && existing.rows[0].user_id !== userId) {
      throw new AppError('This wallet is already linked to another account', 409);
    }
    await query(
      'UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE user_id = $2',
      [walletAddress, userId]
    );
    const result = await query(
      'SELECT user_id, email, username, wallet_address, avatar_url, role, status, created_at FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  async oauthLogin(data: {
    provider: string;
    providerId: string;
    email: string;
    name?: string;
    image?: string;
  }) {
    const idField = data.provider === 'google' ? 'google_id' : 'facebook_id';

    // Find user by provider ID
    let result = await query(
      `SELECT * FROM users WHERE ${idField} = $1`,
      [data.providerId]
    );

    let user;
    if (result.rows.length === 0) {
      // Check if email exists
      result = await query('SELECT * FROM users WHERE email = $1', [data.email]);

      if (result.rows.length > 0) {
        // Link OAuth account to existing user
        await query(
          `UPDATE users SET ${idField} = $1, avatar_url = $2 WHERE email = $3`,
          [data.providerId, data.image, data.email]
        );
        result = await query('SELECT * FROM users WHERE email = $1', [data.email]);
        user = result.rows[0];
      } else {
        // Create new user
        result = await query(
          `INSERT INTO users (email, ${idField}, username, avatar_url, role, status)
           VALUES ($1, $2, $3, $4, 'buyer', 'active')
           RETURNING *`,
          [data.email, data.providerId, data.name, data.image]
        );
        user = result.rows[0];
      }
    } else {
      user = result.rows[0];
    }

    const tokens = this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

      // Check if token is blacklisted
      const blacklisted = await this.isTokenBlacklisted(refreshToken);
      if (blacklisted) {
        throw new AppError('Token has been revoked', 401);
      }

      // Get user
      const result = await query('SELECT * FROM users WHERE user_id = $1', [decoded.user_id]);
      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      const user = result.rows[0];
      const tokens = this.generateTokens(user);

      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);

      return tokens;
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  async logout(refreshToken: string) {
    await this.blacklistToken(refreshToken);
  }

  private generateTokens(user: any) {
    const payload = {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return { accessToken, refreshToken };
  }

  private async blacklistToken(token: string) {
    await setCache(`blacklist:${token}`, true, 7 * 24 * 60 * 60); // 7 days
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await getCache(`blacklist:${token}`);
    return !!result;
  }

  private sanitizeUser(user: any) {
    const { password_hash, nonce, ...sanitized } = user;
    return sanitized;
  }
}
