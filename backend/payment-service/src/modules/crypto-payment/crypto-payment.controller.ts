import { Request, Response, NextFunction } from 'express';
import { CryptoPaymentService } from './crypto-payment.service';
import { logger } from '../../utils/logger';

const cryptoPaymentService = new CryptoPaymentService();

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
