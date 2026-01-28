import { ethers } from 'ethers';
import { query } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { BinanceService } from '../pricing/binance.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

const ESCROW_ABI = [
  'function deposit(string orderId, address token, uint256 amount, address seller) external',
];

export class CryptoPaymentService {
  private binanceService: BinanceService;
  private providers: Map<number, ethers.JsonRpcProvider>;

  constructor() {
    this.binanceService = new BinanceService();
    this.providers = new Map();
    
    // Initialize providers for different chains
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

    // Get token details from whitelist
    const tokenResult = await query(
      'SELECT * FROM token_whitelist WHERE symbol = $1 AND is_active = true',
      [tokenSymbol]
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError('Token not supported', 400);
    }

    const token = tokenResult.rows[0];

    // Get current token price
    const tokenPrice = await this.binanceService.getPrice(`${tokenSymbol}USDT`);
    
    // Calculate token amount needed
    const amountToken = order.price_usd / tokenPrice;
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
      order.seller_id.toString(), // This should be seller's wallet address
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

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);

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

    // Update payment record
    await query(
      `UPDATE payments 
       SET block_number = $1, block_timestamp = $2, gas_used = $3, 
           confirmations = $4, verified_by_rpc = true, status = $5, updated_at = NOW()
       WHERE tx_hash = $6`,
      [
        receipt.blockNumber,
        new Date(receipt.blockTimestamp * 1000),
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
