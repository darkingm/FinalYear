import { NetworkConfig } from '../config/networks';

export interface BalanceResult {
  balance: string;
  decimals: number;
  symbol: string;
}

export interface TransactionResult {
  txHash: string;
  blockNumber?: number;
  blockHash?: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
}

export interface TransactionDetails {
  txHash: string;
  from: string;
  to: string;
  value: string;
  blockNumber?: number;
  blockHash?: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
  nonce?: number;
  timestamp?: Date;
}

export interface TransferParams {
  fromAddress: string;
  toAddress: string;
  amount: string;
  privateKey: string;
  gasPrice?: string;
  gasLimit?: number;
}

export interface TokenTransferParams extends TransferParams {
  tokenAddress: string;
  decimals: number;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export abstract class BaseProvider {
  protected network: NetworkConfig;

  constructor(network: NetworkConfig) {
    this.network = network;
  }

  /**
   * Get native coin balance for an address
   */
  abstract getBalance(address: string): Promise<BalanceResult>;

  /**
   * Get token balance for an address
   */
  abstract getTokenBalance(address: string, tokenAddress: string): Promise<BalanceResult>;

  /**
   * Transfer native coin
   */
  abstract transfer(params: TransferParams): Promise<TransactionResult>;

  /**
   * Transfer token
   */
  abstract transferToken(params: TokenTransferParams): Promise<TransactionResult>;

  /**
   * Get transaction details by hash
   */
  abstract getTransaction(txHash: string): Promise<TransactionDetails | null>;

  /**
   * Get transaction receipt
   */
  abstract getTransactionReceipt(txHash: string): Promise<any>;

  /**
   * Estimate gas for a transaction
   */
  abstract estimateGas(params: Partial<TransferParams>): Promise<GasEstimate>;

  /**
   * Get current gas price
   */
  abstract getGasPrice(): Promise<string>;

  /**
   * Get transaction count (nonce) for an address
   */
  abstract getTransactionCount(address: string): Promise<number>;

  /**
   * Validate address format
   */
  abstract validateAddress(address: string): boolean;

  /**
   * Get network information
   */
  getNetwork(): NetworkConfig {
    return this.network;
  }

  /**
   * Check if transaction is confirmed
   */
  abstract isTransactionConfirmed(txHash: string, minConfirmations?: number): Promise<boolean>;

  /**
   * Wait for transaction confirmation
   */
  abstract waitForConfirmation(txHash: string, minConfirmations?: number, timeout?: number): Promise<TransactionDetails>;
}



