import { ethers } from 'ethers';
import { query, mainQuery } from '../../config/database';
import { BinanceService } from '../pricing/binance.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';
import {
  collectAffectedOrderIds,
  resolveBuyerWallet,
  resolveOperatorPrivateKey,
  resolveSellerWallet,
} from './crypto-payment.logic';
import {
  buildPaymentVerificationMeta,
  getRequiredConfirmationsForChain,
  shouldReadThroughVerifyStatus,
} from './crypto-payment.status';
import { PaymentEventService } from './payment-event.service';
import { PAYMENT_EVENT_TYPES } from './payment-event.contract';
import type { PaymentSessionRecord } from './payment-session.service';
import type { PaymentBatchSessionRecord } from './payment-batch-session.service';
import {
  derivePaymentReconciliationCase,
  type PaymentReconciliationCase,
  type PaymentReconciliationRow,
} from './payment-reconciliation.logic';

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

// All supported payment chains (demo-first, then primary public testnet)
const ALL_SUPPORTED_CHAINS = [31337, 84532, 80002, 97, 421614, 137, 42161, 56, 1];

// Escrow contract addresses per chain — falls back to ESCROW_CONTRACT_ADDRESS for unspecified
const ESCROW_BY_CHAIN: Record<number, string | undefined> = {
  31337: process.env.ESCROW_CONTRACT_LOCALHOST || process.env.ESCROW_CONTRACT_ADDRESS,
  84532: process.env.ESCROW_CONTRACT_BASE_SEPOLIA || process.env.ESCROW_CONTRACT_ADDRESS,
  80002: process.env.ESCROW_CONTRACT_POLYGON_AMOY || '0xCDE08Be0190482691b3288C27240378497d74E79',
  137: process.env.ESCROW_CONTRACT_POLYGON || process.env.ESCROW_CONTRACT_ADDRESS,
  42161: process.env.ESCROW_CONTRACT_ARBITRUM || process.env.ESCROW_CONTRACT_ADDRESS,
  97: process.env.ESCROW_CONTRACT_BSC_TESTNET || process.env.ESCROW_CONTRACT_ADDRESS,
  421614: process.env.ESCROW_CONTRACT_ARB_SEPOLIA || process.env.ESCROW_CONTRACT_ADDRESS,
};

export class CryptoPaymentService {
  private binanceService: BinanceService;
  private providers: Map<number, ethers.AbstractProvider>;
  private paymentEventService: PaymentEventService;

  constructor() {
    this.binanceService = new BinanceService();
    this.providers = new Map();
    this.paymentEventService = new PaymentEventService();

    const localRpc = process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545';

    // Create robust FallbackProvider for Polygon Amoy (80002)
    const amoyRpcs = [
      process.env.POLYGON_AMOY_RPC_URL,
      'https://polygon-amoy.drpc.org',
      'https://rpc-amoy.polygon.technology'
    ].filter(Boolean) as string[];
    const amoyFallback = new ethers.FallbackProvider(
      amoyRpcs.map(url => new ethers.JsonRpcProvider(url))
    );

    // Create robust FallbackProvider for Polygon Mainnet (137)
    const polyRpcs = [
      process.env.POLYGON_RPC_URL,
      'https://polygon.drpc.org',
      'https://polygon-rpc.com'
    ].filter(Boolean) as string[];
    const polyFallback = new ethers.FallbackProvider(
      polyRpcs.map(url => new ethers.JsonRpcProvider(url))
    );

    // Create robust FallbackProvider for BSC Testnet (97)
    const bscTestRpcs = [
      process.env.BSC_TESTNET_RPC_URL,
      'https://data-seed-prebsc-1-s1.binance.org:8545',
      'https://data-seed-prebsc-2-s1.binance.org:8545'
    ].filter(Boolean) as string[];
    const bscTestFallback = new ethers.FallbackProvider(
      bscTestRpcs.map(url => new ethers.JsonRpcProvider(url))
    );

    this.providers.set(31337, new ethers.JsonRpcProvider(localRpc));
    this.providers.set(84532, new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'));
    this.providers.set(80002, amoyFallback);
    this.providers.set(137, polyFallback);
    this.providers.set(42161, new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL));
    this.providers.set(97, bscTestFallback);
    this.providers.set(421614, new ethers.JsonRpcProvider(process.env.ARB_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'));

    logger.info('[CryptoPaymentService] Initialized RPC providers', {
      chain_31337: localRpc,
      chain_84532: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      chain_80002: amoyRpcs.join(', '),
      total_chains: this.providers.size,
    });
  }

  private getRequiredConfirmations(chainId: number) {
    return getRequiredConfirmationsForChain(chainId);
  }

  private isPayableOrderStatus(status: string) {
    return ['UNPAID', 'TX_FAILED', 'TX_SUBMITTED'].includes(status);
  }

  private isIdempotentSubmittedOrder(order: { status: string; tx_hash: string | null }, txHash: string) {
    return ['PAID', 'ONCHAIN_CONFIRMED'].includes(order.status) && order.tx_hash === txHash;
  }

  private async loadOrderPaymentContext(orderId: number) {
    const orderResult = await mainQuery(
      `SELECT o.order_id,
              o.buyer_id,
              u.wallet_address AS buyer_wallet_address,
              o.status,
              o.chain_id,
              o.token_id,
              o.amount_token,
              o.escrow_contract,
              o.tx_hash
       FROM orders o
       LEFT JOIN users u ON u.user_id = o.buyer_id
       WHERE o.order_id = $1`,
      [orderId]
    );

    const order = orderResult.rows[0];
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    return order;
  }

  private async recordSubmittedPayment(input: {
    orderId: number;
    txHash: string;
    sessionId: string | null;
    userId?: number;
    chainId?: number;
    amountToken?: number | string;
    buyerWallet?: string | null;
  }) {
    if (!input.txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new AppError('Invalid transaction hash format', 400);
    }

    const order = await this.loadOrderPaymentContext(input.orderId);
    const effectiveChainId = input.chainId ?? order.chain_id;
    const effectiveAmount = Number(input.amountToken ?? order.amount_token);
    const allowIdempotentSubmit = this.isIdempotentSubmittedOrder(order, input.txHash);

    if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
      throw new AppError('Missing canonical token amount for payment submission', 400);
    }

    if (!this.isPayableOrderStatus(order.status) && !allowIdempotentSubmit) {
      throw new AppError(`Order ${input.orderId} is not payable`, 400);
    }

    const transition = await this.paymentEventService.recordSubmitted({
      orderId: input.orderId,
      sessionId: input.sessionId,
      txHash: input.txHash,
      chainId: effectiveChainId,
      userId: input.userId ?? order.buyer_id,
      amount: effectiveAmount,
      tokenId: order.token_id ?? null,
      fromAddress: resolveBuyerWallet({
        sessionBuyerWallet: input.buyerWallet,
        userWallet: order.buyer_wallet_address,
        buyerId: order.buyer_id,
      }),
      toAddress: order.escrow_contract || process.env.ESCROW_CONTRACT_ADDRESS || null,
    });

    if (!allowIdempotentSubmit) {
      await mainQuery(
        `UPDATE orders
         SET tx_hash = $1,
             status = 'TX_SUBMITTED',
             updated_at = NOW()
         WHERE order_id = $2`,
        [input.txHash, input.orderId]
      );
    }

    return {
      order,
      transition,
    };
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

    if (!['UNPAID', 'TX_FAILED'].includes(order.status)) {
      throw new AppError('Order is not in UNPAID status', 400);
    }

    // Get seller's wallet address (payout_wallet from seller_profiles)
    const sellerResult = await mainQuery(
      'SELECT payout_wallet FROM seller_profiles WHERE seller_id = $1',
      [order.seller_id]
    );
    const rawWallet: string | null = sellerResult.rows[0]?.payout_wallet ?? null;
    const sellerWallet = resolveSellerWallet(rawWallet);

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
      : [84532, 80002, 97, 421614, 137, 42161, 56, 1]; // broad fallback

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
        `No escrow contract deployed on ${token.chain_id === 84532 ? 'Base Sepolia' : token.chain_id === 80002 ? 'Polygon Amoy' : `chain ${token.chain_id}`}. Please choose a different network.`,
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
      token_id: token.token_id,
      token_symbol: tokenSymbol,
      chain_id: token.chain_id,
      amount_token: amountToken,     // ← primary numeric amount
      amount: amountToken,     // ← alias for backward compat
      amount_wei: amountWei.toString(),
      calldata,
      expires_at: Math.floor(Date.now() / 1000) + 600, // 10 phút
      token_price: tokenPrice,
      seller_wallet: sellerWallet,
      buyer_wallet: buyerWallet || null,
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
      if (!['UNPAID', 'TX_FAILED'].includes(order.status)) {
        throw new AppError(`Order ${order.order_id} is not in payable retry state`, 400);
      }
    }

    // Get sellers wallets
    const sellerIds = [...new Set(orders.map(o => o.seller_id))];
    const sellerResult = await mainQuery(
      'SELECT seller_id, payout_wallet FROM seller_profiles WHERE seller_id = ANY($1::int[])',
      [sellerIds]
    );

    const sellerWalletsMap = new Map<number, string | null>(
      sellerResult.rows.map(r => [r.seller_id, r.payout_wallet ?? null])
    );

    const sellersForBatch: string[] = [];

    for (const order of orders) {
      const rawWallet = sellerWalletsMap.get(order.seller_id) ?? null;
      const sellerWallet = resolveSellerWallet(rawWallet);

      if (!sellerWallet) {
        throw new AppError(`Seller of order ${order.order_id} has no valid wallet. Cannot proceed with crypto cart checkout.`, 400);
      }
      sellersForBatch.push(sellerWallet);
    }

    // Determine Chain and Token
    const searchChains: number[] = preferredChainId && ALL_SUPPORTED_CHAINS.includes(preferredChainId)
      ? [preferredChainId]
      : [84532, 80002, 97, 421614, 137, 42161, 56, 1];

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
      buyer_wallet: buyerWallet || null,
    };
  }

  async submitTransaction(orderId: number, txHash: string) {
    const { order } = await this.recordSubmittedPayment({
      orderId,
      txHash,
      sessionId: null,
    });

    logger.info('Transaction submitted', { orderId, txHash, chain_id: order.chain_id });
  }

  async submitTransactionWithSession(session: PaymentSessionRecord, txHash: string) {
    const { order } = await this.recordSubmittedPayment({
      orderId: session.order_id,
      txHash,
      sessionId: session.session_id,
      userId: session.user_id,
      chainId: session.chain_id,
      amountToken: session.amount_token,
      buyerWallet: (session.quote_snapshot as { buyer_wallet?: string | null })?.buyer_wallet ?? null,
    });

    logger.info('Session transaction submitted', {
      orderId: session.order_id,
      txHash,
      session_id: session.session_id,
      chain_id: order.chain_id,
    });
  }

  async submitBatchTransactionWithSession(session: PaymentBatchSessionRecord, txHash: string) {
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new AppError('Invalid transaction hash format', 400);
    }

    const quote = session.quote_snapshot as {
      order_ids: number[];
      amounts_wei_split?: string[];
      amount_token_total: number | string;
      token_id?: number | null;
    };
    const orderIds = Array.isArray(quote.order_ids) ? quote.order_ids : [];
    if (orderIds.length === 0) {
      throw new AppError('Payment session does not contain any orders', 400);
    }

    const orderContexts = await Promise.all(orderIds.map((orderId) => this.loadOrderPaymentContext(orderId)));
    for (const order of orderContexts) {
      if (!this.isPayableOrderStatus(order.status) && !this.isIdempotentSubmittedOrder(order, txHash)) {
        throw new AppError(`Order ${order.order_id} is not payable`, 400);
      }
    }

    const batchResults = await this.paymentEventService.recordSubmittedBatch(
      orderContexts.map((order) => {
        const effectiveAmount = Number(order.amount_token);
        if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
          throw new AppError(`Missing canonical token amount for order ${order.order_id}`, 400);
        }

        return {
          orderId: order.order_id,
          sessionId: session.session_id,
          txHash,
          chainId: session.chain_id,
          userId: session.user_id,
          amount: effectiveAmount,
          tokenId: order.token_id ?? null,
          fromAddress: resolveBuyerWallet({
            sessionBuyerWallet: (session.quote_snapshot as { buyer_wallet?: string | null })?.buyer_wallet ?? null,
            userWallet: order.buyer_wallet_address,
            buyerId: order.buyer_id,
          }),
          toAddress: order.escrow_contract || process.env.ESCROW_CONTRACT_ADDRESS || null,
        };
      })
    );

    const orderIdsNeedingPendingSync = orderContexts
      .filter((order) => !this.isIdempotentSubmittedOrder(order, txHash))
      .map((order) => order.order_id);

    if (orderIdsNeedingPendingSync.length > 0) {
      try {
        await mainQuery(
          `UPDATE orders
           SET tx_hash = $1,
               status = 'TX_SUBMITTED',
               updated_at = NOW()
           WHERE order_id = ANY($2::int[])`,
          [txHash, orderIdsNeedingPendingSync]
        );
      } catch (error: any) {
        logger.error('Best-effort batch order sync after submit failed; projection will retry via events', {
          order_ids: orderIdsNeedingPendingSync,
          tx_hash: txHash,
          session_id: session.session_id,
          error: error.message,
        });
      }
    }

    logger.info('Batch session transaction submitted', {
      order_ids: orderIds,
      txHash,
      session_id: session.session_id,
      chain_id: session.chain_id,
      payment_rows: batchResults.length,
    });
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
        const msg = error?.message || '';

        // Retry on: rate limit, connection refused, timeout, network errors
        const isRetryable =
          error?.error?.code === -32090 ||
          msg.includes('rate limit') ||
          msg.includes('Too many requests') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ENOTFOUND') ||
          msg.includes('network error') ||
          msg.includes('server error') ||
          msg.includes('could not detect network') ||
          msg.includes('missing response');

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        const delayMs = initialDelayMs * Math.pow(2, attempt);

        logger.warn('RPC error, retrying...', {
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          error: msg,
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  async verifyTransaction(txHash: string) {
    logger.info('[verify] Starting verification', { tx_hash: txHash });

    // Get payment record
    const paymentResult = await query(
      'SELECT * FROM payments WHERE tx_hash = $1',
      [txHash]
    );

    if (paymentResult.rows.length === 0) {
      logger.warn('[verify] No payment record found', { tx_hash: txHash });
      throw new AppError('Payment not found', 404);
    }

    const payments = paymentResult.rows;
    const payment = payments[0];
    const affectedOrderIds = collectAffectedOrderIds(payments);
    const provider = this.providers.get(payment.chain_id);

    logger.info('[verify] Payment record found', {
      tx_hash: txHash,
      chain_id: payment.chain_id,
      payment_status: payment.status,
      order_ids: affectedOrderIds,
      has_provider: !!provider,
    });

    if (!provider) {
      logger.error('[verify] No provider for chain', { chain_id: payment.chain_id });
      throw new AppError('Unsupported chain', 400);
    }

    // Get transaction receipt with retry logic
    let receipt;
    try {
      logger.info('[verify] Fetching tx receipt from RPC...', { tx_hash: txHash, chain_id: payment.chain_id });
      receipt = await this.retryWithBackoff(
        () => provider.getTransactionReceipt(txHash),
        5,
        1000
      );
      logger.info('[verify] Receipt result', {
        tx_hash: txHash,
        has_receipt: !!receipt,
        receipt_status: receipt?.status,
        block_number: receipt?.blockNumber,
      });
    } catch (error: any) {
      logger.error('[verify] RPC getTransactionReceipt FAILED after retries', {
        tx_hash: txHash,
        chain_id: payment.chain_id,
        error: error.message,
        error_code: error.code,
        error_reason: error.reason,
      });

      throw new AppError(
        `Error verifying transaction: ${error.message}`,
        500
      );
    }

    if (!receipt) {
      logger.info('[verify] No receipt yet — tx still pending', { tx_hash: txHash });
      return {
        verified: false,
        status: 'pending',
        confirmations: 0,
      };
    }

    // Check if transaction succeeded
    if (receipt.status === 0) {
      await mainQuery(
        `UPDATE orders SET status = 'TX_FAILED', updated_at = NOW()
         WHERE order_id = ANY($1::int[])`,
        [affectedOrderIds]
      );

      for (const currentPayment of payments) {
        await this.paymentEventService.recordTransition({
          orderId: currentPayment.order_id,
          paymentId: currentPayment.payment_id,
          sessionId: null,
          txHash,
          chainId: currentPayment.chain_id,
          eventType: PAYMENT_EVENT_TYPES.FAILED,
          toState: 'failed',
          reason: 'Transaction reverted',
          metadata: {
            confirmations: 0,
          },
        });
      }

      return {
        verified: false,
        status: 'failed',
        reason: 'Transaction reverted on blockchain',
      };
    }

    // Get confirmation count
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    const requiredConfirmations = this.getRequiredConfirmations(payment.chain_id);

    // Get block to retrieve timestamp (TransactionReceipt doesn't have blockTimestamp in ethers v6)
    const block = await provider.getBlock(receipt.blockNumber);
    const blockTimestamp = block ? new Date(block.timestamp * 1000) : new Date();

    // Update payment record
    await query(
      `UPDATE payments 
       SET block_number = $1, block_timestamp = $2, gas_used = $3,
          confirmations = $4, verified_by_rpc = true, updated_at = NOW()
       WHERE tx_hash = $5`,
      [
        receipt.blockNumber,
        blockTimestamp,
        receipt.gasUsed.toString(),
        confirmations,
        txHash,
      ]
    );

    if (confirmations >= requiredConfirmations) {
      // Funds are now locked in EscrowCore contract.
      // Status → PAID: waiting for seller to ship, then buyer to confirm delivery.
      // Release happens ONLY when buyer calls confirm delivery (COMPLETED → backend calls releasePayment).
      await mainQuery(
        `UPDATE orders SET status = 'PAID', updated_at = NOW()
         WHERE order_id = ANY($1::int[])`,
        [affectedOrderIds]
      );

      for (const currentPayment of payments) {
        await this.paymentEventService.recordTransition({
          orderId: currentPayment.order_id,
          paymentId: currentPayment.payment_id,
          sessionId: null,
          txHash,
          chainId: currentPayment.chain_id,
          eventType: PAYMENT_EVENT_TYPES.CONFIRMED,
          toState: 'confirmed',
          metadata: {
            confirmations,
            required_confirmations: requiredConfirmations,
            block_number: receipt.blockNumber,
          },
        });
      }

      logger.info('Transaction verified — funds locked in escrow, awaiting delivery', {
        txHash,
        confirmations,
        order_ids: affectedOrderIds,
      });

      return {
        verified: true,
        status: 'confirmed',
        confirmations,
        block_number: receipt.blockNumber,
      };
    }

    for (const currentPayment of payments) {
      await this.paymentEventService.recordTransition({
        orderId: currentPayment.order_id,
        paymentId: currentPayment.payment_id,
        sessionId: null,
        txHash,
        chainId: currentPayment.chain_id,
        eventType: PAYMENT_EVENT_TYPES.CONFIRMING,
        toState: 'confirming',
        metadata: {
          confirmations,
          required_confirmations: requiredConfirmations,
          block_number: receipt.blockNumber,
        },
      });
    }

    return {
      verified: false,
      status: 'confirming',
      confirmations,
      required_confirmations: requiredConfirmations,
    };
  }

  async getPaymentStatus(orderId: number) {
    const readSnapshot = async () => {
      const orderResult = await mainQuery(
        `SELECT * FROM orders WHERE order_id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new AppError('Order not found', 404);
      }

      const paymentResult = await query(
        `SELECT tx_hash, status as payment_status, confirmations, block_number, chain_id, updated_at
         FROM payments
         WHERE order_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      return {
        order: orderResult.rows[0],
        payment: paymentResult.rows[0] || {},
      };
    };

    let snapshot = await readSnapshot();
    let verifyError: string | null = null;
    const shouldVerify =
      snapshot.payment?.tx_hash &&
      ['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED'].includes(snapshot.order.status) &&
      ['pending', 'confirming'].includes(snapshot.payment.payment_status);

    if (shouldVerify) {
      try {
        await this.verifyTransaction(snapshot.payment.tx_hash);
        snapshot = await readSnapshot();
      } catch (error: any) {
        verifyError = error?.message || 'Verification failed';
        logger.warn('Read-through verify failed, returning best-known payment status', {
          order_id: orderId,
          tx_hash: snapshot.payment.tx_hash,
          error: error.message,
        });
      }
    }

    const verificationMeta = buildPaymentVerificationMeta({
      chainId: snapshot.order.chain_id ?? snapshot.payment.chain_id ?? null,
      orderStatus: snapshot.order.status,
      paymentStatus: snapshot.payment.payment_status,
      confirmations: snapshot.payment.confirmations,
      requiredConfirmations: snapshot.payment.chain_id
        ? this.getRequiredConfirmations(snapshot.payment.chain_id)
        : undefined,
      verifyError,
    });

    return {
      ...snapshot.order,
      ...snapshot.payment,
      ...verificationMeta,
      last_verified_at: snapshot.payment.updated_at || null,
      stuck_reason: verifyError || null,
    };
  }

  async getPaymentReconciliationCases(input: {
    orderId?: number;
    limit?: number;
    problemsOnly?: boolean;
  } = {}): Promise<PaymentReconciliationCase[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const orderParams: unknown[] = [];
    let whereClause = `WHERE o.payment_method = 'crypto'`;

    if (input.orderId) {
      orderParams.push(input.orderId);
      whereClause += ` AND o.order_id = $1`;
    }

    const orderRowsResult = await mainQuery(
      `SELECT o.order_id,
              o.order_number,
              o.status AS order_status,
              o.updated_at AS order_updated_at,
              o.tx_hash AS order_tx_hash,
              o.chain_id AS order_chain_id,
              o.amount_token AS order_amount_token,
              o.total_amount AS order_total_amount,
              o.payment_projection_updated_at,
              o.payment_projection_version,
              buyer.username AS buyer_name,
              buyer.email AS buyer_email
       FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       ${whereClause}
       ORDER BY o.updated_at DESC
       LIMIT ${limit}`,
      orderParams
    );

    const orderIds = orderRowsResult.rows.map((row: any) => row.order_id);
    if (orderIds.length === 0) {
      return [];
    }

    const paymentRowsResult = await query(
      `SELECT DISTINCT ON (p.order_id)
              p.payment_id,
              p.order_id,
              p.status AS payment_status,
              p.tx_hash AS payment_tx_hash,
              p.chain_id AS payment_chain_id,
              p.confirmations AS payment_confirmations,
              p.updated_at AS payment_updated_at
       FROM payments p
       WHERE p.order_id = ANY($1::int[])
       ORDER BY p.order_id, p.created_at DESC`,
      [orderIds]
    );

    const paymentByOrderId = new Map<number, any>(
      paymentRowsResult.rows.map((row: any) => [row.order_id, row])
    );

    const rows = orderRowsResult.rows.map((order: any) => {
      const payment = paymentByOrderId.get(order.order_id);
      const effectiveChainId = payment?.payment_chain_id ?? order.order_chain_id ?? null;
      const row: PaymentReconciliationRow = {
        order_id: order.order_id,
        order_number: order.order_number ?? null,
        buyer_name: order.buyer_name ?? null,
        buyer_email: order.buyer_email ?? null,
        order_status: order.order_status,
        order_updated_at: order.order_updated_at ?? null,
        order_tx_hash: order.order_tx_hash ?? null,
        order_chain_id: order.order_chain_id ?? null,
        order_amount_token: order.order_amount_token ?? null,
        order_total_amount: order.order_total_amount ?? null,
        payment_projection_updated_at: order.payment_projection_updated_at ?? null,
        payment_projection_version: order.payment_projection_version ?? null,
        payment_id: payment?.payment_id ?? null,
        payment_status: payment?.payment_status ?? null,
        payment_tx_hash: payment?.payment_tx_hash ?? null,
        payment_chain_id: payment?.payment_chain_id ?? null,
        payment_confirmations: payment?.payment_confirmations ?? null,
        payment_required_confirmations: effectiveChainId ? this.getRequiredConfirmations(Number(effectiveChainId)) : null,
        payment_updated_at: payment?.payment_updated_at ?? null,
      };

      return derivePaymentReconciliationCase(row, new Date());
    });

    return input.problemsOnly === false ? rows : rows.filter((row) => row.has_issue);
  }

  async retryVerifyOrderPayment(orderId: number) {
    const paymentResult = await query(
      `SELECT tx_hash
       FROM payments
       WHERE order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    );

    const txHash = paymentResult.rows[0]?.tx_hash;
    if (!txHash) {
      throw new AppError('No payment tx hash found for this order', 404);
    }

    const verification = await this.verifyTransaction(txHash);
    const [snapshot] = await this.getPaymentReconciliationCases({
      orderId,
      limit: 1,
      problemsOnly: false,
    });

    return {
      verification,
      snapshot: snapshot ?? null,
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

    // Only release if order is in a valid paid state — NEVER release for UNPAID/CANCELLED/etc.
    const releasableStatuses = ['COMPLETED', 'ONCHAIN_CONFIRMED', 'PAID', 'PAID_PAYPAL'];
    if (!releasableStatuses.includes(order.status)) {
      throw new AppError(
        `Cannot release funds: order ${orderId} is in '${order.status}' status. Expected one of: ${releasableStatuses.join(', ')}`,
        400
      );
    }

    const provider = this.providers.get(order.chain_id);
    if (!provider) throw new AppError('Unsupported chain', 400);

    const privateKey = resolveOperatorPrivateKey(process.env);
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

      const paymentResult = await query(
        `SELECT * FROM payments
         WHERE order_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [orderId]
      );

      const payment = paymentResult.rows[0];
      if (payment) {
        await this.paymentEventService.recordTransition({
          orderId,
          paymentId: payment.payment_id,
          sessionId: null,
          txHash: tx.hash,
          chainId: payment.chain_id,
          eventType: PAYMENT_EVENT_TYPES.RELEASED,
          toState: payment.status,
          metadata: {
            release_tx_hash: tx.hash,
          },
        });
      }

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

    const privateKey = resolveOperatorPrivateKey(process.env);
    if (!privateKey) throw new AppError('Admin private key not configured', 500);

    const wallet = new ethers.Wallet(privateKey, provider);
    const escrowAddress = order.escrow_contract || process.env.ESCROW_CONTRACT_ADDRESS;
    const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, wallet);

    const orderId32 = ethers.keccak256(ethers.toUtf8Bytes(order.internal_order_id));

    try {
      const tx = await escrowContract.refund(orderId32);
      await tx.wait(1);

      logger.info('Payment refunded from Escrow', { orderId, txHash: tx.hash });

      const paymentResult = await query(
        `SELECT * FROM payments
         WHERE order_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [orderId]
      );

      const payment = paymentResult.rows[0];
      if (payment) {
        await this.paymentEventService.recordTransition({
          orderId,
          paymentId: payment.payment_id,
          sessionId: null,
          txHash: tx.hash,
          chainId: payment.chain_id,
          eventType: PAYMENT_EVENT_TYPES.REFUNDED,
          toState: payment.status,
          metadata: {
            refund_tx_hash: tx.hash,
          },
        });
      }

      return { success: true, tx_hash: tx.hash };
    } catch (error: any) {
      logger.error('Error refunding payment', { orderId, error: error.message });
      throw new AppError(`Failed to refund payment: ${error.message}`, 500);
    }
  }
}
