import { ethers } from 'ethers';
import { query, mainQuery } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { BinanceService } from '../pricing/binance.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

const ESCROW_ABI = [
  'function deposit(bytes32 orderId, address token, uint256 amount, address seller) external',
];

// All supported payment chains (testnets first for easy dev testing)
const ALL_SUPPORTED_CHAINS = [31337, 80002, 97, 421614, 84532, 137, 42161, 56, 1];

// Escrow contract addresses per chain — falls back to ESCROW_CONTRACT_ADDRESS for unspecified
const ESCROW_BY_CHAIN: Record<number, string | undefined> = {
  31337:  process.env.ESCROW_CONTRACT_LOCALHOST   || process.env.ESCROW_CONTRACT_ADDRESS,
  80002:  process.env.ESCROW_CONTRACT_POLYGON_AMOY || '0xCDE08Be0190482691b3288C27240378497d74E79',
  137:    process.env.ESCROW_CONTRACT_POLYGON      || process.env.ESCROW_CONTRACT_ADDRESS,
  42161:  process.env.ESCROW_CONTRACT_ARBITRUM     || process.env.ESCROW_CONTRACT_ADDRESS,
  97:     process.env.ESCROW_CONTRACT_BSC_TESTNET  || process.env.ESCROW_CONTRACT_ADDRESS,
  421614: process.env.ESCROW_CONTRACT_ARB_SEPOLIA  || process.env.ESCROW_CONTRACT_ADDRESS,
  84532:  process.env.ESCROW_CONTRACT_BASE_SEPOLIA || process.env.ESCROW_CONTRACT_ADDRESS,
};

export class CryptoPaymentService {
  private binanceService: BinanceService;
  private providers: Map<number, ethers.JsonRpcProvider>;

  constructor() {
    this.binanceService = new BinanceService();
    this.providers = new Map();

    const localRpc   = process.env.LOCALHOST_RPC_URL          || 'http://127.0.0.1:8545';
    const amoyRpc    = process.env.POLYGON_AMOY_RPC_URL        // correct env var
                    || process.env.POLYGON_MUMBAI_RPC_URL      // fallback
                    || 'https://polygon-amoy.drpc.org';        // public fallback

    this.providers.set(31337,  new ethers.JsonRpcProvider(localRpc));
    this.providers.set(80002,  new ethers.JsonRpcProvider(amoyRpc));
    this.providers.set(80001,  new ethers.JsonRpcProvider(process.env.POLYGON_MUMBAI_RPC_URL));
    this.providers.set(137,    new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL));
    this.providers.set(42161,  new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL));
    this.providers.set(97,     new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545'));
    this.providers.set(421614, new ethers.JsonRpcProvider(process.env.ARB_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'));
    this.providers.set(84532,  new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'));
  }

  async generateQuote(orderId: number, tokenSymbol: string, preferredChainId?: number, buyerWallet?: string) {
    // Get order details
    const orderResult = await mainQuery(
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

    // Get seller's wallet address (payout_wallet from seller_profiles)
    const sellerResult = await mainQuery(
      'SELECT payout_wallet FROM seller_profiles WHERE seller_id = $1',
      [order.seller_id]
    );
    const rawWallet: string | null = sellerResult.rows[0]?.payout_wallet ?? null;

    const isValidEthAddress = (w: string | null): w is string =>
      !!w && /^0x[0-9a-fA-F]{40}$/.test(w);

    const sellerWallet = isValidEthAddress(rawWallet)
      ? rawWallet.toLowerCase()
      : isValidEthAddress(process.env.ESCROW_CONTRACT_ADDRESS ?? null)
        ? process.env.ESCROW_CONTRACT_ADDRESS!.toLowerCase()
        : null;

    if (!sellerWallet) {
      throw new AppError(
        `Seller has not connected a crypto wallet. Please use PayPal payment instead.`,
        400
      );
    }

    // Determine which chains to look for the token on.
    // If preferredChainId is specified, try that chain first.
    // Otherwise fall back to: localhost > amoy > polygon mainnet > others
    let chainPriority: number[];
    if (preferredChainId && ALL_SUPPORTED_CHAINS.includes(preferredChainId)) {
      // Preferred chain first, then others as fallback
      chainPriority = [preferredChainId, ...ALL_SUPPORTED_CHAINS.filter(c => c !== preferredChainId)];
    } else {
      // Default order: testnet first (localhost, amoy), then mainnet
      chainPriority = [31337, 80002, 97, 421614, 84532, 137, 42161, 56, 1];
    }

    // Build a CASE for chain priority in SQL
    const priorityCaseExpr = chainPriority
      .map((cid, i) => `WHEN chain_id = ${cid} THEN ${i}`)
      .join(' ');

    const tokenResult = await query(
      `SELECT * FROM token_whitelist 
       WHERE symbol = $1 AND is_active = true AND chain_id = ANY($2::int[]) 
       ORDER BY CASE ${priorityCaseExpr} ELSE ${chainPriority.length} END`,
      [tokenSymbol, chainPriority]
    );

    if (tokenResult.rows.length === 0) {
      const chainHint = preferredChainId ? ` on chain ${preferredChainId}` : '';
      throw new AppError(
        `Token "${tokenSymbol}" is not available${chainHint}. Try a different token or network.`,
        400
      );
    }

    const token = tokenResult.rows[0];

    // Get escrow contract address for this specific chain
    const escrowAddress = ESCROW_BY_CHAIN[token.chain_id] || process.env.ESCROW_CONTRACT_ADDRESS;
    if (!escrowAddress || escrowAddress === '0x0000000000000000000000000000000000000000') {
      throw new AppError(
        `No escrow contract deployed on ${token.chain_id === 80002 ? 'Polygon Amoy' : `chain ${token.chain_id}`}. Please choose a different network.`,
        400
      );
    }

    // Get current token price
    const tokenPrice = await this.binanceService.getPrice(`${tokenSymbol}USDT`);

    // Calculate token amount needed
    let amountToken: number;

    if (order.amount_token && order.token_id) {
      const prodTokenResult = await query(
        'SELECT symbol FROM token_whitelist WHERE token_id = $1 LIMIT 1',
        [order.token_id]
      );
      if (prodTokenResult.rows.length > 0) {
        const prodTokenSymbol = prodTokenResult.rows[0].symbol;
        if (prodTokenSymbol === tokenSymbol) {
          amountToken = Number(order.amount_token);
        } else {
          let prodTokenPrice = 1;
          if (prodTokenSymbol !== 'USDT') {
            prodTokenPrice = await this.binanceService.getPrice(`${prodTokenSymbol}USDT`);
          }
          const valueUsd = Number(order.amount_token) * prodTokenPrice;
          amountToken = valueUsd / tokenPrice;
        }
      } else {
        const priceUsd = Number(order.total_amount);
        amountToken = priceUsd / tokenPrice;
      }
    } else {
      const priceUsd = Number(order.total_amount);
      amountToken = priceUsd / tokenPrice;
    }

    const amountWei = ethers.parseUnits(amountToken.toFixed(token.decimals), token.decimals);

    // Generate calldata for escrow contract
    const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI);
    const calldata = escrowContract.interface.encodeFunctionData('deposit', [
      ethers.keccak256(ethers.toUtf8Bytes(order.internal_order_id)),
      (token.token_address as string).toLowerCase(),
      amountWei,
      (sellerWallet as string).toLowerCase(),
    ]);

    // Update order with token + chain info
    await mainQuery(
      `UPDATE orders 
       SET token_id = $1, amount_token = $2, chain_id = $3, 
           escrow_contract = $4, price_expires_at = NOW() + INTERVAL '10 minutes'
       WHERE order_id = $5`,
      [token.token_id, amountToken, token.chain_id, escrowAddress, orderId]
    );

    logger.info('Generated quote', {
      orderId, tokenSymbol, amountToken, tokenPrice,
      chain_id: token.chain_id,
      preferred_chain: preferredChainId,
      escrow: escrowAddress,
    });

    return {
      order_id: orderId,
      escrow_contract: escrowAddress,
      token_address: token.token_address,
      chain_id: token.chain_id,
      amount_token: amountToken,
      amount_wei: amountWei.toString(),
      calldata,
      expires_at: Math.floor(Date.now() / 1000) + 600, // 10 minutes as unix seconds
      token_price: tokenPrice,
      seller_wallet: sellerWallet,
    };
  }

  async submitTransaction(orderId: number, txHash: string) {
    // Validate transaction hash format
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new AppError('Invalid transaction hash format', 400);
    }

    // Update order status
    await mainQuery(
      `UPDATE orders 
       SET tx_hash = $1, status = 'TX_SUBMITTED', updated_at = NOW()
       WHERE order_id = $2`,
      [txHash, orderId]
    );

    // Get order details for chain_id
    const orderResult = await mainQuery(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId]
    );
    const order = orderResult.rows[0];

    // Create payment record
    // Use escrow_contract stored on order (set at quote time, chain-specific)
    const escrowAddr = order.escrow_contract || process.env.ESCROW_CONTRACT_ADDRESS;
    const fromAddr = order.buyer_wallet || String(order.buyer_id);
    await query(
      `INSERT INTO payments (order_id, tx_hash, chain_id, status, from_address, to_address)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       ON CONFLICT (tx_hash) DO NOTHING`,
      [orderId, txHash, order.chain_id, fromAddr, escrowAddr]
    );

    // Publish event
    await publishEvent('tx.submitted', {
      order_id: orderId,
      tx_hash: txHash,
      chain_id: order.chain_id,
      timestamp: Date.now(),
    });

    logger.info('Transaction submitted', { orderId, txHash, chain_id: order.chain_id, escrow: escrowAddr });
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

      await mainQuery(
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
    const requiredConfirmations = payment.chain_id === 31337 ? 0 : 12;

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
        confirmations >= requiredConfirmations ? 'confirmed' : 'pending',
        txHash,
      ]
    );

    if (confirmations >= requiredConfirmations) {
      // Transaction confirmed
      await mainQuery(
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
      required_confirmations: requiredConfirmations,
    };
  }

  async getPaymentStatus(orderId: number) {
    const orderResult = await mainQuery(
      `SELECT * FROM orders WHERE order_id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    const paymentResult = await query(
      `SELECT tx_hash, status as payment_status, confirmations, block_number
       FROM payments 
       WHERE order_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );

    const payment = paymentResult.rows[0] || {};

    return {
      ...order,
      ...payment,
    };
  }
}
