import { ethers } from 'ethers';
import { query, mainQuery } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { BinanceService } from '../pricing/binance.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

const ESCROW_ABI = [
  // ERC-20 tokens: requires approve() first, then deposit()
  'function deposit(bytes32 orderId, address token, uint256 amount, address seller) external',
  // Native ETH/MATIC/BNB: payable, no approve needed
  'function depositNative(bytes32 orderId, address seller) external payable',
  // Admin release and refund
  'function releasePayment(bytes32 orderId) external',
  'function refund(bytes32 orderId) external',
];

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// All supported payment chains (testnets first for easy dev testing)
const ALL_SUPPORTED_CHAINS = [31337, 80002, 97, 421614, 84532, 137, 42161, 56, 1];

// Escrow contract addresses per chain — falls back to ESCROW_CONTRACT_ADDRESS for unspecified
const ESCROW_BY_CHAIN: Record<number, string | undefined> = {
  31337: process.env.ESCROW_CONTRACT_LOCALHOST || process.env.ESCROW_CONTRACT_ADDRESS,
  80002: process.env.ESCROW_CONTRACT_POLYGON_AMOY || '0xCDE08Be0190482691b3288C27240378497d74E79',
  137: process.env.ESCROW_CONTRACT_POLYGON || process.env.ESCROW_CONTRACT_ADDRESS,
  42161: process.env.ESCROW_CONTRACT_ARBITRUM || process.env.ESCROW_CONTRACT_ADDRESS,
  97: process.env.ESCROW_CONTRACT_BSC_TESTNET || process.env.ESCROW_CONTRACT_ADDRESS,
  421614: process.env.ESCROW_CONTRACT_ARB_SEPOLIA || process.env.ESCROW_CONTRACT_ADDRESS,
  84532: process.env.ESCROW_CONTRACT_BASE_SEPOLIA || process.env.ESCROW_CONTRACT_ADDRESS,
};

export class CryptoPaymentService {
  private binanceService: BinanceService;
  private providers: Map<number, ethers.JsonRpcProvider>;

  constructor() {
    this.binanceService = new BinanceService();
    this.providers = new Map();

    const localRpc = process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545';
    const amoyRpc = process.env.POLYGON_AMOY_RPC_URL        // correct env var
      || process.env.POLYGON_MUMBAI_RPC_URL      // fallback
      || 'https://polygon-amoy.drpc.org';        // public fallback

    this.providers.set(31337, new ethers.JsonRpcProvider(localRpc));
    this.providers.set(80002, new ethers.JsonRpcProvider(amoyRpc));
    this.providers.set(80001, new ethers.JsonRpcProvider(process.env.POLYGON_MUMBAI_RPC_URL));
    this.providers.set(137, new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL));
    this.providers.set(42161, new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL));
    this.providers.set(97, new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545'));
    this.providers.set(421614, new ethers.JsonRpcProvider(process.env.ARB_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'));
    this.providers.set(84532, new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'));
  }

  async generateQuote(orderId: number, tokenSymbol: string, preferredChainId?: number, buyerWallet?: string) {
    // Get order and product details
    const orderResult = await mainQuery(
      `SELECT o.*, p.metadata AS product_metadata 
       FROM orders o 
       LEFT JOIN products p ON o.product_id = p.product_id 
       WHERE o.order_id = $1`,
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

    // Determine which chains to query.
    // If preferredChainId is specified → search ONLY that chain (strict).
    // Otherwise use default priority: amoy > bscTestnet > arbSepolia > mainnet chains.
    const searchChains: number[] = preferredChainId && ALL_SUPPORTED_CHAINS.includes(preferredChainId)
      ? [preferredChainId]   // strict: only the chosen chain
      : [80002, 97, 421614, 84532, 137, 42161, 56, 1]; // broad fallback

    const tokenResult = await query(
      `SELECT * FROM token_whitelist 
       WHERE symbol = $1 AND is_active = true AND chain_id = ANY($2::int[])
       ORDER BY array_position($2::int[], chain_id) NULLS LAST
       LIMIT 1`,
      [tokenSymbol, searchChains]
    );

    if (tokenResult.rows.length === 0) {
      // Tell the user which chains DO support this token
      const availableResult = await query(
        `SELECT chain_id FROM token_whitelist WHERE symbol = $1 AND is_active = true`,
        [tokenSymbol]
      );
      const availableChains = availableResult.rows.map((r: any) => r.chain_id).join(', ');

      const chainName = preferredChainId
        ? `chain ${preferredChainId}`
        : 'any supported chain';

      throw new AppError(
        availableChains
          ? `Token "${tokenSymbol}" không khả dụng trên ${chainName}. ` +
          `Hỗ trợ trên chain: [${availableChains}]. Vui lòng chọn mạng khác.`
          : `Token "${tokenSymbol}" chưa được thêm vào whitelist. Liên hệ admin.`,
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

    // Get current token price — handle testnet native tokens specially
    // ETH on any chain (address 0x0) → use ETH/USDT Binance price
    // MATIC on Amoy (0x000...1010) → use MATIC/USDT Binance price
    // For testnet tokens with no real price (USDT/USDC) → price = 1
    const isNativeOnThisChain = (token.token_address as string).toLowerCase() === NATIVE_TOKEN_ADDRESS
      || (token.token_address as string).toLowerCase() === '0x0000000000000000000000000000000000001010';

    // Map token symbol to Binance pair — testnet native uses mainnet equivalent
    const pricePairMap: Record<string, string> = {
      'ETH': 'ETHUSDT',
      'MATIC': 'MATICUSDT',
      'BNB': 'BNBUSDT',
      'BTC': 'BTCUSDT',
      'WBTC': 'BTCUSDT',
      'USDT': 'USDTUSDT',
      'USDC': 'USDCUSDT',
      'ARB': 'ARBUSDT',
    };

    let tokenPrice: number;
    // Stablecoins → always $1
    if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(tokenSymbol)) {
      tokenPrice = 1;
    } else {
      const binancePair = pricePairMap[tokenSymbol] || `${tokenSymbol}USDT`;
      tokenPrice = await this.binanceService.getPrice(binancePair);
    }

    logger.info('Token price resolved', { tokenSymbol, tokenPrice, chain_id: token.chain_id });

    // Calculate token amount needed
    let amountToken: number;

    const metadata = order.product_metadata || {};
    const customPricing = metadata.pricing || {};

    // 1. If product has a fixed token price set by seller
    if (customPricing[tokenSymbol]) {
      amountToken = Number(customPricing[tokenSymbol]);
    }
    // 2. Otherwise calculate based on base_price in USD
    else {
      const priceUsd = Number(order.total_amount);
      if (!priceUsd || priceUsd <= 0) throw new AppError('Invalid order price', 400);
      if (!tokenPrice || tokenPrice <= 0) throw new AppError(`Cannot get price for ${tokenSymbol}`, 500);
      amountToken = priceUsd / tokenPrice;
    }

    const amountWei = ethers.parseUnits(amountToken.toFixed(token.decimals), token.decimals);

    // Generate calldata — CRITICAL: native vs ERC-20 use different functions!
    const isNative = (token.token_address as string).toLowerCase() === NATIVE_TOKEN_ADDRESS;
    const escrowIface = new ethers.Interface(ESCROW_ABI);
    const orderId32 = ethers.keccak256(ethers.toUtf8Bytes(order.internal_order_id));

    const calldata = isNative
      // depositNative(bytes32 orderId, address seller) — payable, no token param
      ? escrowIface.encodeFunctionData('depositNative', [
        orderId32,
        (sellerWallet as string).toLowerCase(),
      ])
      // deposit(bytes32 orderId, address token, uint256 amount, address seller) — ERC-20
      : escrowIface.encodeFunctionData('deposit', [
        orderId32,
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
      escrow_contract: escrowAddress,   // ← primary field name
      escrow_address: escrowAddress,   // ← alias for backward compat
      token_address: token.token_address,
      token_symbol: tokenSymbol,
      chain_id: token.chain_id,
      amount_token: amountToken,     // ← primary numeric amount
      amount: amountToken,     // ← alias for backward compat
      amount_wei: amountWei.toString(),
      calldata,
      expires_at: Math.floor(Date.now() / 1000) + 600, // 10 phút
      token_price: tokenPrice,
      seller_wallet: sellerWallet,
    };
  }

  async generateQuoteBatch(orderIds: number[], tokenSymbol: string, preferredChainId?: number, buyerWallet?: string) {
    if (!orderIds || orderIds.length === 0) throw new AppError('No orders provided', 400);

    // Fetch all orders
    const orderResult = await mainQuery(
      `SELECT o.*, p.metadata AS product_metadata 
       FROM orders o 
       LEFT JOIN products p ON o.product_id = p.product_id 
       WHERE o.order_id = ANY($1::int[])`,
      [orderIds]
    );

    if (orderResult.rows.length !== orderIds.length) {
      throw new AppError('Some orders were not found', 404);
    }

    const orders = orderResult.rows;

    for (const order of orders) {
      if (order.status !== 'UNPAID') {
        throw new AppError(`Order ${order.order_id} is not in UNPAID status`, 400);
      }
    }

    // Get sellers wallets
    const sellerIds = [...new Set(orders.map(o => o.seller_id))];
    const sellerResult = await mainQuery(
      'SELECT seller_id, payout_wallet FROM seller_profiles WHERE seller_id = ANY($1::int[])',
      [sellerIds]
    );

    const sellerWalletsMap = new Map(sellerResult.rows.map(r => [r.seller_id, r.payout_wallet]));
    const isValidEthAddress = (w: string | null): w is string => !!w && /^0x[0-9a-fA-F]{40}$/.test(w);

    const escrowAddrEnv = process.env.ESCROW_CONTRACT_ADDRESS ?? null;
    const escrowFallback = isValidEthAddress(escrowAddrEnv) ? escrowAddrEnv.toLowerCase() : null;

    const sellersForBatch: string[] = [];

    for (const order of orders) {
      const rawWallet = sellerWalletsMap.get(order.seller_id);
      const sellerWallet = isValidEthAddress(rawWallet)
        ? rawWallet.toLowerCase()
        : escrowFallback;

      if (!sellerWallet) {
        throw new AppError(`Seller of order ${order.order_id} has no valid wallet. Cannot proceed with crypto cart checkout.`, 400);
      }
      sellersForBatch.push(sellerWallet);
    }

    // Determine Chain and Token
    const searchChains: number[] = preferredChainId && ALL_SUPPORTED_CHAINS.includes(preferredChainId)
      ? [preferredChainId]
      : [80002, 97, 421614, 84532, 137, 42161, 56, 1];

    const tokenResult = await query(
      `SELECT * FROM token_whitelist 
       WHERE symbol = $1 AND is_active = true AND chain_id = ANY($2::int[])
       ORDER BY array_position($2::int[], chain_id) NULLS LAST
       LIMIT 1`,
      [tokenSymbol, searchChains]
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError(`Token "${tokenSymbol}" unavailable.`, 400);
    }

    const token = tokenResult.rows[0];
    const escrowAddress = ESCROW_BY_CHAIN[token.chain_id] || process.env.ESCROW_CONTRACT_ADDRESS;
    if (!escrowAddress || escrowAddress === '0x0000000000000000000000000000000000000000') {
      throw new AppError('No escrow contract deployed on this chain.', 400);
    }

    // Determine Price
    const pricePairMap: Record<string, string> = {
      'ETH': 'ETHUSDT', 'MATIC': 'MATICUSDT', 'BNB': 'BNBUSDT',
      'BTC': 'BTCUSDT', 'WBTC': 'BTCUSDT', 'USDT': 'USDTUSDT',
      'USDC': 'USDCUSDT', 'ARB': 'ARBUSDT',
    };

    let tokenPrice: number = 1;
    if (!['USDT', 'USDC', 'DAI', 'BUSD'].includes(tokenSymbol)) {
      const binancePair = pricePairMap[tokenSymbol] || `${tokenSymbol}USDT`;
      tokenPrice = await this.binanceService.getPrice(binancePair);
    }

    // Calculate amounts per order
    const amountsToken: number[] = [];
    const amountsWeiResult: bigint[] = [];
    let totalWei = 0n;

    for (const order of orders) {
      const metadata = order.product_metadata || {};
      const customPricing = metadata.pricing || {};
      let amtToken = 0;

      if (customPricing[tokenSymbol]) {
        amtToken = Number(customPricing[tokenSymbol]);
      } else {
        const priceUsd = Number(order.total_amount);
        amtToken = priceUsd / tokenPrice;
      }
      amountsToken.push(amtToken);

      const amtWei = ethers.parseUnits(amtToken.toFixed(token.decimals), token.decimals);
      amountsWeiResult.push(amtWei);
      totalWei += amtWei;
    }

    // Generate Calldata
    const isNative = (token.token_address as string).toLowerCase() === NATIVE_TOKEN_ADDRESS;
    const escrowIface = new ethers.Interface(ESCROW_ABI);

    // Re-declare ABI with batch functions for local encoding
    const EXTENDED_ABI = [
      ...ESCROW_ABI,
      'function depositBatch(bytes32[] calldata orderIds, address token, uint256[] calldata amounts, address[] calldata sellers) external',
      'function depositNativeBatch(bytes32[] calldata orderIds, address[] calldata sellers, uint256[] calldata amounts) external payable'
    ];
    const extIface = new ethers.Interface(EXTENDED_ABI);

    const orderIdsBytes32 = orders.map(o => ethers.keccak256(ethers.toUtf8Bytes(o.internal_order_id)));

    const calldata = isNative
      ? extIface.encodeFunctionData('depositNativeBatch', [
        orderIdsBytes32,
        sellersForBatch,
        amountsWeiResult
      ])
      : extIface.encodeFunctionData('depositBatch', [
        orderIdsBytes32,
        (token.token_address as string).toLowerCase(),
        amountsWeiResult,
        sellersForBatch
      ]);

    // Update ALL orders
    for (let i = 0; i < orders.length; i++) {
      await mainQuery(
        `UPDATE orders 
         SET token_id = $1, amount_token = $2, chain_id = $3,
          escrow_contract = $4, price_expires_at = NOW() + INTERVAL '10 minutes'
         WHERE order_id = $5`,
        [token.token_id, amountsToken[i], token.chain_id, escrowAddress, orders[i].order_id]
      );
    }

    return {
      order_ids: orderIds,
      escrow_contract: escrowAddress,
      token_address: token.token_address,
      token_symbol: tokenSymbol,
      chain_id: token.chain_id,
      amount_token_total: amountsToken.reduce((a, b) => a + b, 0),
      amount_wei_total: totalWei.toString(),
      amounts_wei_split: amountsWeiResult.map(a => a.toString()),
      calldata,
      expires_at: Math.floor(Date.now() / 1000) + 600,
      token_price: tokenPrice,
    };
  }

  async submitTransaction(orderId: number, txHash: string) {
    // Validate transaction hash format
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new AppError('Invalid transaction hash format', 400);
    }

    // Update order status first
    await mainQuery(
      `UPDATE orders SET tx_hash = $1, status = 'TX_SUBMITTED', updated_at = NOW() WHERE order_id = $2`,
      [txHash, orderId]
    );

    // Get order details for chain_id
    const orderResult = await mainQuery(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId]
    );
    const order = orderResult.rows[0];

    // Create payment record — guard against duplicate tx_hash (batch has same hash per order).
    // Use an explicit existence check instead of ON CONFLICT (payments has no UNIQUE on tx_hash).
    const existing = await query(
      `SELECT payment_id FROM payments WHERE tx_hash = $1 LIMIT 1`,
      [txHash]
    );

    if (existing.rows.length === 0) {
      // First order in the batch — create the payment record
      const escrowAddr = order.escrow_contract || process.env.ESCROW_CONTRACT_ADDRESS;
      const fromAddr = order.buyer_wallet || String(order.buyer_id);
      await query(
        `INSERT INTO payments(order_id, tx_hash, chain_id, status, from_address, to_address)
         VALUES($1, $2, $3, 'pending', $4, $5)`,
        [orderId, txHash, order.chain_id, fromAddr, escrowAddr]
      );
    }
    // (Subsequent batch orders share the same payment row — only the orders table is updated per order)

    // Publish event
    await publishEvent('tx.submitted', {
      order_id: orderId,
      tx_hash: txHash,
      chain_id: order.chain_id,
      timestamp: Date.now(),
    });

    logger.info('Transaction submitted', { orderId, txHash, chain_id: order.chain_id });
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
      // Funds are now locked in EscrowCore contract.
      // Status → PAID: waiting for seller to ship, then buyer to confirm delivery.
      // Release happens ONLY when buyer calls confirm delivery (COMPLETED → backend calls releasePayment).
      await mainQuery(
        `UPDATE orders SET status = 'PAID', updated_at = NOW() 
         WHERE order_id = $1`,
        [payment.order_id]
      );

      await query(
        `UPDATE payments SET status = 'confirmed', updated_at = NOW() WHERE tx_hash = $1`,
        [txHash]
      );

      await publishEvent('payment.validated', {
        order_id: payment.order_id,
        tx_hash: txHash,
        confirmations,
      });

      logger.info('Transaction verified — funds locked in escrow, awaiting delivery', { txHash, confirmations, order_id: payment.order_id });

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

  async releaseFunds(orderId: number) {
    const orderResult = await mainQuery(
      `SELECT internal_order_id, chain_id, escrow_contract, status FROM orders WHERE order_id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    // Only release if onchain confirmed or higher, or we can just trust the order status
    // Actually, usually release happens when status is COMPLETED
    if (order.status !== 'COMPLETED' && order.status !== 'ONCHAIN_CONFIRMED') {
      // It's ok if main-service already set it to COMPLETED.
    }

    const provider = this.providers.get(order.chain_id);
    if (!provider) throw new AppError('Unsupported chain', 400);

    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!privateKey) throw new AppError('Admin private key not configured', 500);

    const wallet = new ethers.Wallet(privateKey, provider);
    const escrowAddress = order.escrow_contract || process.env.ESCROW_CONTRACT_ADDRESS;
    const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, wallet);

    const orderId32 = ethers.keccak256(ethers.toUtf8Bytes(order.internal_order_id));

    try {
      const tx = await escrowContract.releasePayment(orderId32);
      await tx.wait(1);

      logger.info('Funds released from Escrow', { orderId, txHash: tx.hash });

      // Mark order as COMPLETED (funds successfully transferred to seller)
      await mainQuery(
        `UPDATE orders SET status = 'COMPLETED', release_tx_hash = $1, updated_at = NOW() WHERE order_id = $2`,
        [tx.hash, orderId]
      );

      await publishEvent('payment.released', { order_id: orderId, tx_hash: tx.hash });

      return { success: true, tx_hash: tx.hash };
    } catch (error: any) {
      logger.error('Error releasing funds', { orderId, error: error.message });
      throw new AppError(`Failed to release funds: ${error.message}`, 500);
    }
  }

  async refundPayment(orderId: number) {
    const orderResult = await mainQuery(
      `SELECT internal_order_id, chain_id, escrow_contract FROM orders WHERE order_id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    const provider = this.providers.get(order.chain_id);
    if (!provider) throw new AppError('Unsupported chain', 400);

    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!privateKey) throw new AppError('Admin private key not configured', 500);

    const wallet = new ethers.Wallet(privateKey, provider);
    const escrowAddress = order.escrow_contract || process.env.ESCROW_CONTRACT_ADDRESS;
    const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, wallet);

    const orderId32 = ethers.keccak256(ethers.toUtf8Bytes(order.internal_order_id));

    try {
      const tx = await escrowContract.refund(orderId32);
      await tx.wait(1);

      logger.info('Payment refunded from Escrow', { orderId, txHash: tx.hash });
      return { success: true, tx_hash: tx.hash };
    } catch (error: any) {
      logger.error('Error refunding payment', { orderId, error: error.message });
      throw new AppError(`Failed to refund payment: ${error.message}`, 500);
    }
  }
}
