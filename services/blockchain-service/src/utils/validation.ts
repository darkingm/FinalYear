import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import { getNetworkById, NetworkType } from '../config/networks';
import BigNumber from 'bignumber.js';

/**
 * Validate Ethereum/EVM address
 */
export const validateEVMAddress = (address: string): boolean => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

/**
 * Validate Bitcoin address
 */
export const validateBitcoinAddress = (address: string, isTestnet: boolean = false): boolean => {
  try {
    const network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    bitcoin.address.toOutputScript(address, network);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate address based on network type
 */
export const validateAddress = (address: string, networkId: string): boolean => {
  const network = getNetworkById(networkId);
  if (!network) {
    return false;
  }

  if (network.type === NetworkType.BITCOIN) {
    return validateBitcoinAddress(address, network.isTestnet);
  } else if (network.type === NetworkType.EVM) {
    return validateEVMAddress(address);
  }

  return false;
};

/**
 * Validate amount (must be positive number)
 */
export const validateAmount = (amount: string | number): boolean => {
  try {
    const amountBN = new BigNumber(amount);
    return amountBN.isPositive() && amountBN.isFinite();
  } catch {
    return false;
  }
};

/**
 * Validate amount is greater than minimum
 */
export const validateMinAmount = (amount: string | number, minAmount: string | number): boolean => {
  try {
    const amountBN = new BigNumber(amount);
    const minBN = new BigNumber(minAmount);
    return amountBN.isGreaterThanOrEqualTo(minBN);
  } catch {
    return false;
  }
};

/**
 * Validate network ID exists
 */
export const validateNetworkId = (networkId: string): boolean => {
  const network = getNetworkById(networkId);
  return network !== undefined;
};

/**
 * Format amount to string with proper decimals
 */
export const formatAmount = (amount: string | number, decimals: number = 18): string => {
  try {
    const amountBN = new BigNumber(amount);
    return amountBN.toFixed(decimals);
  } catch {
    return '0';
  }
};

/**
 * Parse amount from string to BigNumber
 */
export const parseAmount = (amount: string | number): BigNumber => {
  return new BigNumber(amount);
};

/**
 * Convert amount to smallest unit (wei, satoshi, etc.)
 */
export const toSmallestUnit = (amount: string | number, decimals: number): string => {
  try {
    const amountBN = new BigNumber(amount);
    const multiplier = new BigNumber(10).pow(decimals);
    return amountBN.multipliedBy(multiplier).toFixed(0);
  } catch {
    return '0';
  }
};

/**
 * Convert from smallest unit to human readable
 */
export const fromSmallestUnit = (amount: string | number, decimals: number): string => {
  try {
    const amountBN = new BigNumber(amount);
    const divisor = new BigNumber(10).pow(decimals);
    return amountBN.dividedBy(divisor).toFixed(decimals);
  } catch {
    return '0';
  }
};

/**
 * Check if address is valid for the given network
 */
export const isAddressValidForNetwork = (address: string, networkId: string): boolean => {
  return validateAddress(address, networkId);
};

/**
 * Validate transaction hash format
 */
export const validateTxHash = (txHash: string, networkId: string): boolean => {
  const network = getNetworkById(networkId);
  if (!network) {
    return false;
  }

  if (network.type === NetworkType.BITCOIN) {
    // Bitcoin tx hash: 64 hex characters
    return /^[a-fA-F0-9]{64}$/.test(txHash);
  } else if (network.type === NetworkType.EVM) {
    // EVM tx hash: 0x followed by 64 hex characters
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
  }

  return false;
};

/**
 * Normalize address (checksum for EVM)
 */
export const normalizeAddress = (address: string, networkId: string): string => {
  const network = getNetworkById(networkId);
  if (!network) {
    return address;
  }

  if (network.type === NetworkType.EVM) {
    try {
      return ethers.getAddress(address);
    } catch {
      return address;
    }
  }

  return address;
};



