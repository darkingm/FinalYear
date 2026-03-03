import { ethers } from 'ethers';

/**
 * EIP-4361 Sign-In with Ethereum: build and verify SIWE message.
 */
const DOMAIN = process.env.SIWE_DOMAIN || 'localhost';
const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

export function buildSiweMessage(address: string, nonce: string): string {
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  return `${DOMAIN} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Crypto Marketplace\n\nURI: ${ORIGIN}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;
}

export function verifySiweSignature(message: string, signature: string): string {
  const recoveredAddress = ethers.verifyMessage(message, signature);
  return recoveredAddress;
}

export function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): boolean {
  try {
    const recovered = verifySiweSignature(message, signature);
    return recovered.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}
