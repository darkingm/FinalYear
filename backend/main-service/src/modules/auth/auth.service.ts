import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { query } from '../../config/database';
import { setCache, getCache, deleteCache } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { getRefreshTokenErrorMessage } from './auth.refresh-logic';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    username?: string;
    wallet_address?: string;
  }) {
    // Normalize email & username to prevent case-sensitive duplicates
    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedUsername = data.username?.trim();

    // Check if email already exists
    const existing = await query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      throw new AppError('Email already registered', 409);
    }

    // Check if username already exists (case-insensitive)
    if (normalizedUsername) {
      const existingUsername = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [normalizedUsername]);
      if (existingUsername.rows.length > 0) {
        throw new AppError('Username already taken', 409);
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, 10);

    // Create user — store normalized email
    const result = await query(
      `INSERT INTO users (email, password_hash, username, wallet_address, role, status)
       VALUES ($1, $2, $3, $4, 'buyer', 'active')
       RETURNING user_id, email, username, wallet_address, role, status, created_at`,
      [normalizedEmail, password_hash, normalizedUsername, data.wallet_address]
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
    // Normalize input for case-insensitive lookup
    const normalizedInput = email.toLowerCase().trim();
    // Find user by email or username (case-insensitive)
    const result = await query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
      [normalizedInput]
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
    // 1. Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new AppError('Invalid signature', 401);
    }

    // 2. Parse SIWE message fields to prevent replay attacks
    await this.validateSiweMessage(message, walletAddress);

    // 3. Find or create user
    let result = await query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    let user;
    if (result.rows.length === 0) {
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

    // 4. Check account status
    if (user.status !== 'active') {
      throw new AppError('Account is suspended', 403);
    }

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /** Link a wallet to the current user (email/password account). Verifies ownership via SIWE. */
  async linkWallet(userId: number, walletAddress: string, message: string, signature: string) {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new AppError('Invalid signature', 401);
    }

    // Validate SIWE message to prevent replay
    await this.validateSiweMessage(message, walletAddress);

    const normalized = walletAddress.toLowerCase();
    const existing = await query(
      'SELECT user_id FROM users WHERE LOWER(wallet_address) = $1',
      [normalized]
    );
    if (existing.rows.length > 0 && existing.rows[0].user_id !== userId) {
      throw new AppError('This wallet is already linked to another account', 409);
    }
    // Also check the multi-wallet table — same wallet may have been linked there only.
    const existingMulti = await query(
      `SELECT user_id FROM user_wallets WHERE chain_type = 'evm' AND LOWER(address) = $1 AND user_id <> $2 LIMIT 1`,
      [normalized, userId]
    );
    if (existingMulti.rows.length > 0) {
      throw new AppError('This wallet is already linked to another account', 409);
    }
    await query(
      'UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE user_id = $2',
      [walletAddress, userId]
    );

    // Sync into user_wallets so the multi-wallet UI (`/wallet`) sees this wallet.
    // Use the global EVM partial unique index from migration 020.
    // If this is the first wallet of the user, also mark it primary.
    const countRes = await query(
      `SELECT COUNT(*)::int AS count FROM user_wallets WHERE user_id = $1 AND chain_type = 'evm'`,
      [userId]
    );
    const isFirst = countRes.rows[0].count === 0;
    if (isFirst) {
      await query(
        `UPDATE user_wallets SET is_primary = FALSE WHERE user_id = $1`,
        [userId]
      );
    }
    await query(
      `INSERT INTO user_wallets (user_id, chain_type, chain_id, address, label, is_primary, is_verified, verified_at)
       VALUES ($1, 'evm', NULL, $2, $3, $4, TRUE, NOW())
       ON CONFLICT (LOWER(address)) WHERE chain_type = 'evm' DO UPDATE
       SET is_verified = TRUE, verified_at = NOW(), updated_at = NOW(),
           is_primary = CASE WHEN user_wallets.user_id = EXCLUDED.user_id THEN GREATEST(user_wallets.is_primary::int, EXCLUDED.is_primary::int)::boolean
                              ELSE user_wallets.is_primary END`,
      [userId, normalized, 'MetaMask', isFirst]
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
    const normalizedEmail = data.email.toLowerCase().trim();

    // Find user by provider ID
    let result = await query(
      `SELECT * FROM users WHERE ${idField} = $1`,
      [data.providerId]
    );

    let user;
    if (result.rows.length === 0) {
      // Check if email exists (case-insensitive, consistent with register/login)
      result = await query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);

      if (result.rows.length > 0) {
        // Link OAuth account to existing user
        await query(
          `UPDATE users SET ${idField} = $1, avatar_url = $2 WHERE LOWER(email) = $3`,
          [data.providerId, data.image, normalizedEmail]
        );
        result = await query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        user = result.rows[0];
      } else {
        // Create new user — store normalized email
        result = await query(
          `INSERT INTO users (email, ${idField}, username, avatar_url, role, status)
           VALUES ($1, $2, $3, $4, 'buyer', 'active')
           RETURNING *`,
          [normalizedEmail, data.providerId, data.name, data.image]
        );
        user = result.rows[0];
      }
    } else {
      user = result.rows[0];
    }

    // Check account status
    if (user.status !== 'active') {
      throw new AppError('Account is suspended', 403);
    }

    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshToken(refreshToken: string) {
    let decoded: any;

    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    } catch (error) {
      throw new AppError(getRefreshTokenErrorMessage(error), 401);
    }

    const blacklisted = await this.isTokenBlacklisted(refreshToken);
    if (blacklisted) {
      throw new AppError('Refresh token revoked', 401);
    }

    const result = await query('SELECT * FROM users WHERE user_id = $1', [decoded.user_id]);
    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    // Block suspended users from refreshing tokens
    if (user.status !== 'active') {
      await this.blacklistToken(refreshToken);
      logger.warn('Suspended user attempted token refresh', { user_id: user.user_id, status: user.status });
      throw new AppError('Account suspended', 403);
    }

    const tokens = this.generateTokens(user);

    await this.blacklistToken(refreshToken);

    return tokens;
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
      expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any,
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
    });

    return { accessToken, refreshToken };
  }

  private async blacklistToken(token: string) {
    try {
      await setCache(`blacklist:${token}`, true, 7 * 24 * 60 * 60); // 7 days
    } catch (err) {
      logger.error('Redis blacklist failed — token NOT blacklisted:', err);
    }
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await getCache(`blacklist:${token}`);
      return !!result;
    } catch (err) {
      logger.error('Redis blacklist check failed — assuming not blacklisted:', err);
      return false;
    }
  }

  /**
   * Parse and validate SIWE message fields to prevent replay attacks.
   * Checks: nonce uniqueness, expiration, issued-at freshness, address match,
   * URI domain match (production), and chain ID whitelist.
   */
  private async validateSiweMessage(message: string, expectedAddress?: string) {
    const nonceMatch = message.match(/Nonce: (.+)/);
    const issuedAtMatch = message.match(/Issued At: (.+)/);
    const expirationMatch = message.match(/Expiration Time: (.+)/);
    const addressMatch = message.match(/your Ethereum account:\n(0x[a-fA-F0-9]{40})/);
    const uriMatch = message.match(/URI: (.+)/);
    const chainIdMatch = message.match(/Chain ID: (\d+)/);

    if (!nonceMatch || !issuedAtMatch || !expirationMatch) {
      throw new AppError('Invalid message format — missing SIWE fields', 400);
    }

    // Validate address matches claimed wallet
    if (expectedAddress && addressMatch) {
      if (addressMatch[1].toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new AppError('SIWE address mismatch', 401);
      }
    }

    // Validate URI domain matches expected frontend
    if (uriMatch) {
      const frontendUrl = process.env.FRONTEND_URL || '';
      if (frontendUrl && process.env.NODE_ENV === 'production') {
        const messageOrigin = uriMatch[1].trim();
        if (!messageOrigin.startsWith(frontendUrl)) {
          logger.warn(`SIWE URI mismatch: message=${messageOrigin}, expected=${frontendUrl}`);
          throw new AppError('Invalid SIWE origin', 401);
        }
      }
    }

    // Validate chain ID against allowed chains
    if (chainIdMatch) {
      const allowedChains = [
        '31337',    // Hardhat local
        '1',        // Ethereum Mainnet
        '137',      // Polygon Mainnet
        '80002',    // Polygon Amoy Testnet
        '56',       // BSC Mainnet
        '97',       // BSC Testnet
        '84532',    // Base Sepolia
        '421614',   // Arbitrum Sepolia
        '11155111', // Sepolia
      ];
      if (!allowedChains.includes(chainIdMatch[1])) {
        throw new AppError('Unsupported chain ID in signature', 400);
      }
    }

    const nonce = nonceMatch[1].trim();
    const issuedAt = new Date(issuedAtMatch[1].trim());
    const expirationTime = new Date(expirationMatch[1].trim());
    const now = new Date();

    // Check expiration
    if (now > expirationTime) {
      throw new AppError('Signature expired', 401);
    }

    // Check issued-at not too old (5 minutes)
    if (now.getTime() - issuedAt.getTime() > 5 * 60 * 1000) {
      throw new AppError('Signature too old', 401);
    }

    // Check nonce not already used (prevents replay)
    try {
      const nonceKey = `wallet-nonce:${nonce}`;
      const used = await getCache(nonceKey);
      if (used) {
        throw new AppError('Nonce already used', 401);
      }
      await setCache(nonceKey, '1', 5 * 60); // expire after 5 min
    } catch (err) {
      if (err instanceof AppError) throw err;
      // SECURITY: fail-closed in production — nonce replay protection is critical
      if (process.env.NODE_ENV === 'production') {
        logger.error('Redis nonce check failed in production — blocking wallet login:', err);
        throw new AppError('Authentication service temporarily unavailable', 503);
      }
      logger.warn('Redis nonce check failed — allowing login (dev mode):', err);
    }
  }

  private sanitizeUser(user: any) {
    const { password_hash, nonce, ...sanitized } = user;
    return sanitized;
  }

  async forgotPassword(email: string) {
    const result = await query('SELECT user_id, email FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return { message: 'If an account exists, a reset link has been sent.' };
    }

    const user = result.rows[0];
    const resetToken = jwt.sign(
      { user_id: user.user_id, email: user.email, purpose: 'reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    // Store token in Redis with 15min TTL
    await setCache(`reset:${user.user_id}`, resetToken, 15 * 60);

    // Send email
    const frontendUrl = process.env.FRONTEND_URL || 'https://kienai.id.vn';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"Web3Market 🚀" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Khôi phục mật khẩu tài khoản Web3Market',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #eaeaea; border-radius: 12px; background-color: #ffffff; color: #333333;">
            <div style="text-align: center; margin-bottom: 25px;">
              <h1 style="color: #f0b90b; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Web3Market.</h1>
              <p style="color: #888888; font-size: 14px; margin-top: 5px;">Công ty CP TMĐT Web3Market - Nền tảng TMĐT Crypto hàng đầu</p>
            </div>
            
            <div style="background-color: #fafafa; border-radius: 8px; padding: 25px; text-align: left;">
              <h2 style="color: #1a1d26; margin-top: 0; font-size: 20px;">Yêu cầu Khôi phục Mật khẩu 🔒</h2>
              <p style="font-size: 15px; line-height: 1.6; color: #555555;">
                Chào bạn,<br/><br/>
                Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với địa chỉ email này. Để đặt lại mật khẩu của bạn, vui lòng click vào nút xác nhận bên dưới:
              </p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f0b90b 0%, #e6a800 100%); color: #000000; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(240, 185, 11, 0.25); transition: background 0.3s;">
                  Khôi Phục Mật Khẩu Ngay
                </a>
              </div>
              
              <p style="font-size: 14px; line-height: 1.5; color: #666666;">
                <strong>Lưu ý:</strong> Liên kết này chỉ có hiệu lực trong vòng <strong>15 phút</strong> vì lý do bảo mật.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 25px 0;"/>
            
            <div style="text-align: center; font-size: 12px; color: #999999; line-height: 1.5;">
              <p style="margin: 0 0 10px 0;">
                Nếu bạn không yêu cầu thay đổi này, hãy bỏ qua email này hoặc liên hệ ngay với bộ phận CSKH của chúng tôi.
              </p>
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} Công ty Cổ phần Web3Market.<br/>
                Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh, Việt Nam<br/>
                Hotline: 1900 1000 • Email: support@web3market.vn
              </p>
            </div>
          </div>
        `,
      });
      logger.info(`Reset email sent to ${user.email}`);
    } catch (err) {
      logger.error('Failed to send reset email:', err);
      // Still return success to not reveal info
    }

    return { message: 'If an account exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (decoded.purpose !== 'reset') {
        throw new AppError('Invalid reset token', 400);
      }

      // Check token in Redis
      const storedToken = await getCache(`reset:${decoded.user_id}`);
      if (!storedToken || storedToken !== token) {
        throw new AppError('Reset token expired or already used', 400);
      }

      // Hash new password
      const password_hash = await bcrypt.hash(newPassword, 10);

      // Update user
      await query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [password_hash, decoded.user_id]);

      // Remove token from Redis
      await deleteCache(`reset:${decoded.user_id}`);

      return { message: 'Password updated successfully' };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired reset token', 400);
    }
  }
}
