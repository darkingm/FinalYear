import { Request, Response } from 'express';
import P2PTrade, { P2PTradeStatus, P2PTradeType } from '../models/P2PTrade.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class P2PController {
  // Create P2P trade
  static async createTrade(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const {
        tradeType,
        coinAmount,
        coinType,
        fiatAmount,
        fiatCurrency,
        exchangeRate,
        bankName,
        bankAccountNumber,
        bankAccountName,
      } = req.body;

      const trade = await P2PTrade.create({
        userId,
        tradeType,
        coinAmount,
        coinType,
        fiatAmount,
        fiatCurrency,
        exchangeRate,
        bankName,
        bankAccountNumber,
        bankAccountName,
        status: P2PTradeStatus.PENDING,
      });

      // Publish event
      await publishEvent('p2p.trade.created', {
        tradeId: trade.id,
        userId,
        tradeType,
        coinAmount,
        coinType,
      });

      res.status(201).json({
        success: true,
        data: trade,
        message: 'P2P trade created successfully',
      });
    } catch (error: any) {
      logger.error('Create P2P trade error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create P2P trade',
        details: error.message,
      });
    }
  }

  // Get user's P2P trades
  static async getUserTrades(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { page = 1, limit = 20, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const where: any = { userId };
      if (status) where.status = status;

      const { count, rows } = await P2PTrade.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          trades: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get user trades error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trades',
      });
    }
  }

  // Get trade by ID
  static async getTradeById(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const trade = await P2PTrade.findOne({
        where: { id, userId },
      });

      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Trade not found',
        });
      }

      res.json({
        success: true,
        data: trade,
      });
    } catch (error: any) {
      logger.error('Get trade error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trade',
      });
    }
  }

  // Submit payment proof
  static async submitPaymentProof(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      const { paymentProofImage } = req.body;

      const trade = await P2PTrade.findOne({
        where: { id, userId },
      });

      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Trade not found',
        });
      }

      if (trade.status !== P2PTradeStatus.PENDING) {
        return res.status(400).json({
          success: false,
          error: 'Trade is not in pending status',
        });
      }

      trade.paymentProofImage = paymentProofImage;
      trade.status = P2PTradeStatus.PAYMENT_SUBMITTED;
      trade.paymentSubmittedAt = new Date();
      await trade.save();

      // Publish event
      await publishEvent('p2p.payment.submitted', {
        tradeId: trade.id,
        userId,
      });

      res.json({
        success: true,
        message: 'Payment proof submitted successfully',
      });
    } catch (error: any) {
      logger.error('Submit payment proof error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit payment proof',
      });
    }
  }

  // Cancel trade
  static async cancelTrade(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const trade = await P2PTrade.findOne({
        where: { id, userId },
      });

      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Trade not found',
        });
      }

      if (![P2PTradeStatus.PENDING, P2PTradeStatus.PAYMENT_PENDING].includes(trade.status)) {
        return res.status(400).json({
          success: false,
          error: 'Trade cannot be cancelled at this stage',
        });
      }

      trade.status = P2PTradeStatus.CANCELLED;
      trade.cancelledAt = new Date();
      await trade.save();

      // Publish event
      await publishEvent('p2p.trade.cancelled', {
        tradeId: trade.id,
        userId,
      });

      res.json({
        success: true,
        message: 'Trade cancelled successfully',
      });
    } catch (error: any) {
      logger.error('Cancel trade error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel trade',
      });
    }
  }

  // Admin: Get all P2P trades
  static async getAllTrades(req: Request, res: Response) {
    try {
      const { page = 1, limit = 50, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status) where.status = status;

      const { count, rows } = await P2PTrade.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          trades: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get all trades error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trades',
      });
    }
  }

  // Admin: Verify P2P trade
  static async verifyTrade(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { approved, notes } = req.body;
      const adminId = req.headers['x-user-id'] as string;

      const trade = await P2PTrade.findByPk(id);

      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Trade not found',
        });
      }

      if (trade.status !== P2PTradeStatus.PAYMENT_SUBMITTED) {
        return res.status(400).json({
          success: false,
          error: 'Trade is not awaiting verification',
        });
      }

      trade.verifiedByAdmin = adminId;
      trade.verificationNotes = notes;
      trade.verifiedAt = new Date();

      if (approved) {
        trade.status = P2PTradeStatus.COMPLETED;
        trade.completedAt = new Date();

        // Publish event for successful trade
        await publishEvent('p2p.trade.completed', {
          tradeId: trade.id,
          userId: trade.userId,
          coinAmount: trade.coinAmount,
          coinType: trade.coinType,
        });
      } else {
        trade.status = P2PTradeStatus.DISPUTED;

        // Publish event for disputed trade
        await publishEvent('p2p.trade.disputed', {
          tradeId: trade.id,
          userId: trade.userId,
          reason: notes,
        });
      }

      await trade.save();

      res.json({
        success: true,
        message: approved ? 'Trade verified and completed' : 'Trade marked as disputed',
      });
    } catch (error: any) {
      logger.error('Verify trade error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify trade',
      });
    }
  }

  // Get P2P statistics
  static async getP2PStats(req: Request, res: Response) {
    try {
      const totalTrades = await P2PTrade.count();
      const pendingTrades = await P2PTrade.count({
        where: { status: P2PTradeStatus.PAYMENT_SUBMITTED },
      });
      const completedTrades = await P2PTrade.count({
        where: { status: P2PTradeStatus.COMPLETED },
      });
      const disputedTrades = await P2PTrade.count({
        where: { status: P2PTradeStatus.DISPUTED },
      });

      res.json({
        success: true,
        data: {
          totalTrades,
          pendingTrades,
          completedTrades,
          disputedTrades,
        },
      });
    } catch (error: any) {
      logger.error('Get P2P stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }
}

