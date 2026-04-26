import { ethers } from 'ethers';
import { setCache, getCache } from '../config/redis';
import { AppError } from '../middleware/error-handler';
import { logger } from './logger';

/**
 * Verify a SIWE-style signed message and return the verified (lowercase) address.
 * Throws AppError on any validation failure.
 *
 * Validations performed:
 *  - ECDSA signature recovers the claimed address
 *  - Message contains required SIWE fields (Nonce, Issued At, Expiration Time)
 *  - Address inside the message matches the claimed address (if present)
 *  - URI domain matches FRONTEND_URL in production
 *  - Chain ID is in the platform whitelist
 *  - Nonce has not been used (Redis), expiration not passed, issued-at fresh
 */
export async function verifySiweSignature(
    walletAddress: string,
    message: string,
    signature: string,
): Promise<string> {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new AppError('Invalid signature', 401);
    }

    const nonceMatch = message.match(/Nonce: (.+)/);
    const issuedAtMatch = message.match(/Issued At: (.+)/);
    const expirationMatch = message.match(/Expiration Time: (.+)/);
    const addressMatch = message.match(/your Ethereum account:\n(0x[a-fA-F0-9]{40})/);
    const uriMatch = message.match(/URI: (.+)/);
    const chainIdMatch = message.match(/Chain ID: (\d+)/);

    if (!nonceMatch || !issuedAtMatch || !expirationMatch) {
        throw new AppError('Invalid message format — missing SIWE fields', 400);
    }

    if (addressMatch && addressMatch[1].toLowerCase() !== walletAddress.toLowerCase()) {
        throw new AppError('SIWE address mismatch', 401);
    }

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

    if (chainIdMatch) {
        const allowedChains = [
            '31337', '1', '137', '80002', '56', '97',
            '84532', '421614', '11155111',
        ];
        if (!allowedChains.includes(chainIdMatch[1])) {
            throw new AppError('Unsupported chain ID in signature', 400);
        }
    }

    const nonce = nonceMatch[1].trim();
    const issuedAt = new Date(issuedAtMatch[1].trim());
    const expirationTime = new Date(expirationMatch[1].trim());
    const now = new Date();

    if (now > expirationTime) {
        throw new AppError('Signature expired', 401);
    }

    if (now.getTime() - issuedAt.getTime() > 5 * 60 * 1000) {
        throw new AppError('Signature too old', 401);
    }

    try {
        const nonceKey = `wallet-nonce:${nonce}`;
        const used = await getCache(nonceKey);
        if (used) {
            throw new AppError('Nonce already used', 401);
        }
        await setCache(nonceKey, '1', 5 * 60);
    } catch (err) {
        if (err instanceof AppError) throw err;
        if (process.env.NODE_ENV === 'production') {
            logger.error('Redis nonce check failed in production — rejecting wallet action:', err);
            throw new AppError('Authentication service temporarily unavailable', 503);
        }
        logger.warn('Redis nonce check failed — allowing in dev mode:', err);
    }

    return walletAddress.toLowerCase();
}
