import { ethers } from 'ethers';
import { query } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { BinanceService } from '../pricing/binance.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

const ESCROW_ABI = [
  'function deposit(string orderId, address token, uint256 amount, address seller) external',
];

// Chains with RPC and escrow support (31337 = Hardhat/Anvil local)
const SUPPORTED_CHAIN_IDS = [31337, 137, 80001, 42161];

export class CryptoPaymentService {
  private binanceService: BinanceService;
  private providers: Map<number, ethers.JsonRpcProvider>;

  constructor() {
    this.binanceService = new BinanceService();
    this.providers = new Map();

    const localRpc = process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545';
    this.providers.set(31337, new ethers.JsonRpcProvider(localRpc));
    this.providers.set(137, new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL));
    this.providers.set(80001, new ethers.JsonRpcProvider(process.env.POLYGON_MUMBAI_RPC_URL));
    this.providers.set(42161, new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL));
  }

  async generateQuote(orderId: number, tokenSymbol: string) {
    // Get order details
    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    if (order.status !== 'UNPAID') {
      throw new AppError('Order is not in UNPAID status', 400);
    }

    // Get seller's wallet address (escrow deposit expects address, not user_id)
    const sellerResult = await query(
      'SELECT wallet_address FROM users WHERE user_id = $1',
      [order.seller_id]
    );
    const sellerWallet = sellerResult.rows[0]?.wallet_address;
    if (!sellerWallet || !ethers.isAddress(sellerWallet)) {
      throw new AppError(
        `Seller (user_id: ${order.seller_id}) has no valid wallet_address in users table. Sellers must connect a wallet to receive crypto payments.`,
        400
      );
    }

    // Get token only on supported chains (Polygon, Mumbai, Arbitrum) to avoid wrong-chain / Internal JSON-RPC errors
    const tokenResult = await query(
      `SELECT * FROM token_whitelist 
       WHERE symbol = $1 AND is_active = true AND chain_id = ANY($2::int[]) 
       ORDER BY CASE WHEN chain_id = 31337 THEN 0 WHEN chain_id = 137 THEN 1 WHEN chain_id = 42161 THEN 2 ELSE 3 END`,
      [tokenSymbol, SUPPORTED_CHAIN_IDS]
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError(
        `Token "${tokenSymbol}" is not available on supported networks (Polygon, Arbitrum). Use USDT or USDC on Polygon.`,
        400
      );
    }

    const token = tokenResult.rows[0];

    // Get current token price
    const tokenPrice = await this.binanceService.getPrice(`${tokenSymbol}USDT`);

    // Calculate token amount needed
    const priceUsd = Number(order.price_usd);
    const amountToken = priceUsd / tokenPrice;
    const amountWei = ethers.parseUnits(amountToken.toFixed(token.decimals), token.decimals);

    // Generate calldata for escrow contract
    const escrowContract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS!,
      ESCROW_ABI
    );

    const calldata = escrowContract.interface.encodeFunctionData('deposit', [
      order.internal_order_id,
      token.token_address,
      amountWei,
      sellerWallet,
    ]);

    // Update order with token info
    await query(
      `UPDATE orders 
       SET token_id = $1, amount_token = $2, chain_id = $3, 
           escrow_contract = $4, price_expires_at = NOW() + INTERVAL '10 minutes'
       WHERE order_id = $5`,
      [token.token_id, amountToken, token.chain_id, process.env.ESCROW_CONTRACT_ADDRESS, orderId]
    );

    logger.info('Generated quote', { orderId, tokenSymbol, amountToken, tokenPrice });

    return {
      order_id: orderId,
      escrow_contract: process.env.ESCROW_CONTRACT_ADDRESS,
      token_address: token.token_address,
      chain_id: token.chain_id,
      amount_token: amountToken,
      amount_wei: amountWei.toString(),
      calldata,
      expires_at: Date.now() + 600000, // 10 minutes
      token_price: tokenPrice,
    };
  }

  async submitTransaction(orderId: number, txHash: string) {
    // Validate transaction hash format
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new AppError('Invalid transaction hash format', 400);
    }

    // Update order status
    await query(
      `UPDATE orders 
       SET tx_hash = $1, status = 'TX_SUBMITTED', updated_at = NOW()
       WHERE order_id = $2`,
      [txHash, orderId]
    );

    // Get order details for chain_id
    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId]
    );
    const order = orderResult.rows[0];

    // Create payment record
    await query(
      `INSERT INTO payments (order_id, tx_hash, chain_id, status, from_address, to_address)
       VALUES ($1, $2, $3, 'pending', $4, $5)`,
      [orderId, txHash, order.chain_id, order.buyer_id, process.env.ESCROW_CONTRACT_ADDRESS]
    );

    // Publish event
    await publishEvent('tx.submitted', {
      order_id: orderId,
      tx_hash: txHash,
      timestamp: Date.now(),
    });

    logger.info('Transaction submitted', { orderId, txHash });
  }

  /**
   * Retry an async operation with exponential backoff
   * Useful for handling rate-limited RPC calls
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if this is a rate limit error
        const isRateLimit =
          error?.error?.code === -32090 ||
          error?.message?.includes('rate limit') ||
          error?.message?.includes('Too many requests');

        if (!isRateLimit || attempt === maxRetries - 1) {
          // Not a rate limit error, or we've exhausted retries
          throw error;
        }

        // Calculate delay with exponential backoff
        const delayMs = initialDelayMs * Math.pow(2, attempt);

        logger.warn('RPC rate limit hit, retrying...', {
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          error: error.message,
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  async verifyTransaction(txHash: string) {
    // Get payment record
    const paymentResult = await query(
      'SELECT * FROM payments WHERE tx_hash = $1',
      [txHash]
    );

    if (paymentResult.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    const payment = paymentResult.rows[0];
    const provider = this.providers.get(payment.chain_id);

    if (!provider) {
      throw new AppError('Unsupported chain', 400);
    }

    // Get transaction receipt with retry logic
    let receipt;
    try {
      receipt = await this.retryWithBackoff(
        () => provider.getTransactionReceipt(txHash),
        5,
        1000
      );
    } catch (error: any) {
      logger.error('Error verifying transaction', {
        tx_hash: txHash,
        error: error.message,
        service: 'payment-service',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      });

      // Re-throw as AppError for consistent error handling
      throw new AppError(
        `Error verifying transaction: ${error.message}`,
        500
      );
    }

    if (!receipt) {
      // Transaction still pending
      return {
        verified: false,
        status: 'pending',
        confirmations: 0,
      };
    }

    // Check if transaction succeeded
    if (receipt.status === 0) {
      // Transaction failed
      await query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE tx_hash = $1`,
        [txHash]
      );

      await query(
        `UPDATE orders SET status = 'TX_FAILED', updated_at = NOW() 
         WHERE order_id = $1`,
        [payment.order_id]
      );

      await publishEvent('payment.failed', {
        order_id: payment.order_id,
        tx_hash: txHash,
        reason: 'Transaction reverted',
      });

      return {
        verified: false,
        status: 'failed',
        reason: 'Transaction reverted on blockchain',
      };
    }

    // Get confirmation count
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    // Get block to retrieve timestamp (TransactionReceipt doesn't have blockTimestamp in ethers v6)
    const block = await provider.getBlock(receipt.blockNumber);
    const blockTimestamp = block ? new Date(block.timestamp * 1000) : new Date();

    // Update payment record
    await query(
      `UPDATE payments 
       SET block_number = $1, block_timestamp = $2, gas_used = $3, 
           confirmations = $4, verified_by_rpc = true, status = $5, updated_at = NOW()
       WHERE tx_hash = $6`,
      [
        receipt.blockNumber,
        blockTimestamp,
        receipt.gasUsed.toString(),
        confirmations,
        confirmations >= 12 ? 'confirmed' : 'pending',
        txHash,
      ]
    );

    if (confirmations >= 12) {
      // Transaction confirmed
      await query(
        `UPDATE orders SET status = 'ONCHAIN_CONFIRMED', updated_at = NOW() 
         WHERE order_id = $1`,
        [payment.order_id]
      );

      await publishEvent('payment.validated', {
        order_id: payment.order_id,
        tx_hash: txHash,
        confirmations,
      });

      logger.info('Transaction verified', { txHash, confirmations });

      return {
        verified: true,
        status: 'confirmed',
        confirmations,
        block_number: receipt.blockNumber,
      };
    }

    return {
      verified: false,
      status: 'confirming',
      confirmations,
      required_confirmations: 12,
    };
  }

  async getPaymentStatus(orderId: number) {
    const result = await query(
      `SELECT o.*, p.tx_hash, p.status as payment_status, p.confirmations, p.block_number
       FROM orders o
       LEFT JOIN payments p ON o.order_id = p.order_id
       WHERE o.order_id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    return result.rows[0];
  }
}
