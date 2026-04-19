import { Request, Response, NextFunction } from 'express';
import { CryptoPaymentService } from './crypto-payment.service';
import { logger } from '../../utils/logger';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query, mainQuery } from '../../config/database';
import { PaymentSessionService } from './payment-session.service';
import { PaymentBatchSessionService } from './payment-batch-session.service';
import { AppError } from '../../middleware/error-handler';

const cryptoPaymentService = new CryptoPaymentService();
const paymentSessionService = new PaymentSessionService({
  paymentQuery: query,
  mainQuery,
  quoteResolver: ({ orderId, tokenSymbol, preferredChainId, buyerWallet }) =>
    cryptoPaymentService.generateQuote(orderId, tokenSymbol, preferredChainId, buyerWallet),
});
const paymentBatchSessionService = new PaymentBatchSessionService({
  paymentQuery: query,
  mainQuery,
  quoteResolver: ({ orderIds, tokenSymbol, preferredChainId, buyerWallet }) =>
    cryptoPaymentService.generateQuoteBatch(orderIds, tokenSymbol, preferredChainId, buyerWallet),
});

function requireUserId(req: AuthRequest) {
  const userId = req.user?.user_id;
  if (!userId) {
    throw new AppError('Authentication required', 401);
  }
  return userId;
}

export async function createPaymentSession(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const { order_id, token_symbol, preferred_chain_id, buyer_wallet } = req.body;
    const session = await paymentSessionService.createSession({
      userId: requireUserId(authReq),
      orderId: order_id,
      tokenSymbol: token_symbol,
      chainId: preferred_chain_id,
      buyerWallet: buyer_wallet,
    });

    res.json({
      success: true,
      session,
    });
  } catch (error: any) {
    logger.error('Create payment session error:', error);
    next(error);
  }
}

export async function createPaymentBatchSession(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const { order_ids, token_symbol, preferred_chain_id, buyer_wallet } = req.body;
    const session = await paymentBatchSessionService.createSession({
      userId: requireUserId(authReq),
      orderIds: order_ids,
      tokenSymbol: token_symbol,
      chainId: preferred_chain_id,
      buyerWallet: buyer_wallet,
    });

    res.json({
      success: true,
      session,
    });
  } catch (error: any) {
    logger.error('Create batch payment session error:', error);
    next(error);
  }
}

export async function getPaymentSessionQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const quote = await paymentSessionService.getSessionQuote({
      sessionId: req.params.sessionId,
      nonce: req.body.nonce,
      userId: requireUserId(authReq),
    });

    res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    logger.error('Get payment session quote error:', error);
    next(error);
  }
}

export async function getPaymentBatchSessionQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const quote = await paymentBatchSessionService.getSessionQuote({
      sessionId: req.params.sessionId,
      nonce: req.body.nonce,
      userId: requireUserId(authReq),
    });

    res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    logger.error('Get batch payment session quote error:', error);
    next(error);
  }
}

export async function submitPaymentSession(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const userId = requireUserId(authReq);
    const session = await paymentSessionService.getAccessibleSession({
      sessionId: req.params.sessionId,
      nonce: req.body.nonce,
      userId,
    });

    await paymentSessionService.assertUsableSession({
      sessionId: session.session_id,
      nonce: req.body.nonce,
      userId,
      orderId: session.order_id,
      tokenSymbol: session.token_symbol,
      chainId: session.chain_id,
      amountToken: session.amount_token,
    });

    await cryptoPaymentService.submitTransactionWithSession(session, req.body.tx_hash);
    await paymentSessionService.markSessionSubmitted({
      sessionId: session.session_id,
      txHash: req.body.tx_hash,
    });

    setImmediate(async () => {
      try {
        await cryptoPaymentService.verifyTransaction(req.body.tx_hash);
        logger.info('Auto-verify completed after session submit', {
          order_id: session.order_id,
          tx_hash: req.body.tx_hash,
          session_id: session.session_id,
        });
      } catch (e: any) {
        logger.warn('Auto-verify after session submit failed (will retry):', {
          order_id: session.order_id,
          tx_hash: req.body.tx_hash,
          session_id: session.session_id,
          error: e.message,
        });
      }
    });

    res.json({
      success: true,
      message: 'Transaction submitted successfully',
      session_id: session.session_id,
    });
  } catch (error: any) {
    logger.error('Submit payment session error:', error);
    next(error);
  }
}

export async function submitPaymentBatchSession(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const userId = requireUserId(authReq);
    const session = await paymentBatchSessionService.getAccessibleSession({
      sessionId: req.params.sessionId,
      nonce: req.body.nonce,
      userId,
    });
    const quote = session.quote_snapshot as {
      order_ids: number[];
      token_symbol: string;
      chain_id: number;
      amount_token_total: number | string;
    };

    await paymentBatchSessionService.assertUsableSession({
      sessionId: session.session_id,
      nonce: req.body.nonce,
      userId,
      orderIds: quote.order_ids,
      tokenSymbol: session.token_symbol,
      chainId: session.chain_id,
      amountTokenTotal: session.amount_token_total,
    });

    await cryptoPaymentService.submitBatchTransactionWithSession(session, req.body.tx_hash);
    await paymentBatchSessionService.markSessionSubmitted({
      sessionId: session.session_id,
      txHash: req.body.tx_hash,
    });

    setImmediate(async () => {
      try {
        await cryptoPaymentService.verifyTransaction(req.body.tx_hash);
        logger.info('Auto-verify completed after batch session submit', {
          order_ids: quote.order_ids,
          tx_hash: req.body.tx_hash,
          session_id: session.session_id,
        });
      } catch (e: any) {
        logger.warn('Auto-verify after batch session submit failed (will retry):', {
          order_ids: quote.order_ids,
          tx_hash: req.body.tx_hash,
          session_id: session.session_id,
          error: e.message,
        });
      }
    });

    res.json({
      success: true,
      message: 'Batch transaction submitted successfully',
      session_id: session.session_id,
    });
  } catch (error: any) {
    logger.error('Submit batch payment session error:', error);
    next(error);
  }
}

export async function getPaymentSessionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const session = await paymentSessionService.getAccessibleSession({
      sessionId: req.params.sessionId,
      nonce: String(req.query.nonce || ''),
      userId: requireUserId(authReq),
    });

    if (session.tx_hash) {
      try {
        await cryptoPaymentService.verifyTransaction(session.tx_hash);
      } catch (error: any) {
        logger.warn('Session status verify failed, returning best-known status', {
          session_id: session.session_id,
          tx_hash: session.tx_hash,
          error: error.message,
        });
      }
    }

    const status = await cryptoPaymentService.getPaymentStatus(session.order_id);

    res.json({
      success: true,
      session: {
        session_id: session.session_id,
        nonce: session.nonce,
        status: session.status,
        expires_at: session.expires_at,
        tx_hash: session.tx_hash,
      },
      status,
    });
  } catch (error: any) {
    logger.error('Get payment session status error:', error);
    next(error);
  }
}

export async function getPaymentBatchSessionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const session = await paymentBatchSessionService.getAccessibleSession({
      sessionId: req.params.sessionId,
      nonce: String(req.query.nonce || ''),
      userId: requireUserId(authReq),
    });
    const quote = session.quote_snapshot as { order_ids: number[] };

    if (session.tx_hash) {
      try {
        await cryptoPaymentService.verifyTransaction(session.tx_hash);
      } catch (error: any) {
        logger.warn('Batch session status verify failed, returning best-known status', {
          session_id: session.session_id,
          tx_hash: session.tx_hash,
          error: error.message,
        });
      }
    }

    const orders = await Promise.all(
      quote.order_ids.map((orderId) => cryptoPaymentService.getPaymentStatus(orderId))
    );

    const overallState = orders.some((entry) => entry.status === 'TX_FAILED' || entry.payment_status === 'failed')
      ? 'failed'
      : orders.every((entry) => entry.status === 'PAID' || entry.payment_status === 'confirmed')
        ? 'confirmed'
        : orders.some((entry) => ['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED'].includes(entry.status) || ['pending', 'confirming'].includes(entry.payment_status))
          ? 'confirming'
          : session.status;

    res.json({
      success: true,
      session: {
        session_id: session.session_id,
        nonce: session.nonce,
        status: session.status,
        expires_at: session.expires_at,
        tx_hash: session.tx_hash,
      },
      status: {
        overall_state: overallState,
        orders,
      },
    });
  } catch (error: any) {
    logger.error('Get batch payment session status error:', error);
    next(error);
  }
}

export async function getPaymentReconciliationCases(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = req.query.order_id ? parseInt(String(req.query.order_id), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const problemsOnly = req.query.problems_only !== 'false';

    const cases = await cryptoPaymentService.getPaymentReconciliationCases({
      orderId,
      limit,
      problemsOnly,
    });

    res.json({
      success: true,
      cases,
    });
  } catch (error: any) {
    logger.error('Get payment reconciliation cases error:', error);
    next(error);
  }
}

export async function retryVerifyOrderPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const result = await cryptoPaymentService.retryVerifyOrderPayment(orderId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Retry verify order payment error:', error);
    next(error);
  }
}

export async function generateQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id, token_symbol, preferred_chain_id, buyer_wallet } = req.body;

    if (!order_id || !token_symbol) {
      return res.status(400).json({
        success: false,
        message: 'order_id and token_symbol are required',
      });
    }

    // preferred_chain_id lets frontend choose testnet vs mainnet
    const chainId = preferred_chain_id ? parseInt(preferred_chain_id, 10) : undefined;
    const quote = await cryptoPaymentService.generateQuote(order_id, token_symbol, chainId, buyer_wallet);

    res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    logger.error('Generate quote error:', error);
    next(error);
  }
}

export async function generateQuoteBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_ids, token_symbol, preferred_chain_id, buyer_wallet } = req.body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0 || !token_symbol) {
      return res.status(400).json({
        success: false,
        message: 'order_ids (array) and token_symbol are required',
      });
    }

    const chainId = preferred_chain_id ? parseInt(preferred_chain_id, 10) : undefined;
    const quote = await cryptoPaymentService.generateQuoteBatch(order_ids, token_symbol, chainId, buyer_wallet);

    res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    logger.error('Generate quote batch error:', error);
    next(error);
  }
}

export async function submitTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id, tx_hash } = req.body;

    if (!order_id || !tx_hash) {
      return res.status(400).json({
        success: false,
        message: 'order_id and tx_hash are required',
      });
    }

    await cryptoPaymentService.submitTransaction(order_id, tx_hash);

    // Auto-trigger verify immediately — critical for Hardhat (chain 31337, 0 confirmations needed)
    // Do NOT await — fire-and-forget so response returns fast
    setImmediate(async () => {
      try {
        await cryptoPaymentService.verifyTransaction(tx_hash);
        logger.info('Auto-verify completed after submit', { order_id, tx_hash });
      } catch (e: any) {
        // Non-critical: verification will be retried by cron/worker
        logger.warn('Auto-verify after submit failed (will retry):', { order_id, tx_hash, error: e.message });
      }
    });

    res.json({
      success: true,
      message: 'Transaction submitted successfully',
    });
  } catch (error: any) {
    logger.error('Submit transaction error:', error);
    next(error);
  }
}

export async function getPaymentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;

    const status = await cryptoPaymentService.getPaymentStatus(parseInt(orderId));

    res.json({
      success: true,
      status,
    });
  } catch (error: any) {
    logger.error('Get payment status error:', error);
    next(error);
  }
}

export async function verifyTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { txHash } = req.params;

    const result = await cryptoPaymentService.verifyTransaction(txHash);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    logger.error('Verify transaction error:', error);
    next(error);
  }
}

export async function releaseFunds(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id } = req.body;
    const result = await cryptoPaymentService.releaseFunds(order_id);
    res.json({ success: true, message: 'Funds released successfully', tx_hash: result.tx_hash });
  } catch (error: any) {
    logger.error('Release funds error:', error);
    next(error);
  }
}

export async function refundPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id } = req.body;
    const result = await cryptoPaymentService.refundPayment(order_id);
    res.json({ success: true, message: 'Payment refunded successfully', tx_hash: result.tx_hash });
  } catch (error: any) {
    logger.error('Refund payment error:', error);
    next(error);
  }
}
