import { Request, Response } from 'express';
import Voucher, { VoucherType, VoucherStatus } from '../models/Voucher.model';
import { VoucherService } from '../services/voucher.service';
import logger from '../utils/logger';

export class VoucherController {
  // Get all vouchers (public + seller-specific)
  static async getVouchers(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const sellerId = req.query.sellerId as string | undefined;
      const { publicOnly } = req.query;

      let vouchers: Voucher[];

      if (publicOnly === 'true') {
        // Get only public vouchers
        vouchers = await VoucherService.getPublicVouchers();
      } else if (sellerId) {
        // Get seller-specific vouchers
        vouchers = await VoucherService.getSellerVouchers(sellerId);
      } else {
        // Get all active vouchers (public + user's seller vouchers if applicable)
        const publicVouchers = await VoucherService.getPublicVouchers();
        let sellerVouchers: Voucher[] = [];

        if (userId && sellerId) {
          sellerVouchers = await VoucherService.getSellerVouchers(sellerId);
        }

        vouchers = [...publicVouchers, ...sellerVouchers];
      }

      res.json({
        success: true,
        data: { vouchers },
      });
    } catch (error: any) {
      logger.error('Get vouchers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch vouchers',
      });
    }
  }

  // Get voucher by code
  static async getVoucherByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const voucher = await Voucher.findOne({
        where: { code: code.toUpperCase() },
      });

      if (!voucher) {
        return res.status(404).json({
          success: false,
          error: 'Voucher not found',
        });
      }

      res.json({
        success: true,
        data: { voucher },
      });
    } catch (error: any) {
      logger.error('Get voucher by code error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch voucher',
      });
    }
  }

  // Create voucher (seller only)
  static async createVoucher(req: Request, res: Response) {
    try {
      const sellerId = req.headers['x-user-id'] as string;
      const {
        code,
        title,
        description,
        type,
        discountValue,
        minPurchaseAmount,
        maxDiscountAmount,
        maxUses,
        maxUsesPerUser,
        startDate,
        endDate,
        applicableCategories,
        applicableProducts,
      } = req.body;

      // Validate required fields
      if (!code || !title || !type || !discountValue || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      // Validate type
      if (!Object.values(VoucherType).includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid voucher type',
        });
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        return res.status(400).json({
          success: false,
          error: 'End date must be after start date',
        });
      }

      // Check if code already exists
      const existingVoucher = await Voucher.findOne({
        where: { code: code.toUpperCase() },
      });

      if (existingVoucher) {
        return res.status(400).json({
          success: false,
          error: 'Voucher code already exists',
        });
      }

      // Create voucher
      const voucher = await Voucher.create({
        code: code.toUpperCase(),
        sellerId,
        title,
        description,
        type,
        discountValue: parseFloat(discountValue),
        minPurchaseAmount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : undefined,
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : undefined,
        maxUses: maxUses ? parseInt(maxUses) : undefined,
        maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser) : undefined,
        startDate: start,
        endDate: end,
        status: VoucherStatus.ACTIVE,
        applicableCategories: applicableCategories || [],
        applicableProducts: applicableProducts || [],
      });

      res.status(201).json({
        success: true,
        data: { voucher },
        message: 'Voucher created successfully',
      });
    } catch (error: any) {
      logger.error('Create voucher error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create voucher',
        details: error.message,
      });
    }
  }

  // Update voucher (seller only)
  static async updateVoucher(req: Request, res: Response) {
    try {
      const sellerId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      const updateData = req.body;

      const voucher = await Voucher.findOne({
        where: { id, sellerId },
      });

      if (!voucher) {
        return res.status(404).json({
          success: false,
          error: 'Voucher not found',
        });
      }

      // Validate dates if provided
      if (updateData.startDate || updateData.endDate) {
        const start = new Date(updateData.startDate || voucher.startDate);
        const end = new Date(updateData.endDate || voucher.endDate);
        if (end <= start) {
          return res.status(400).json({
            success: false,
            error: 'End date must be after start date',
          });
        }
      }

      // Don't allow updating code
      if (updateData.code) {
        delete updateData.code;
      }

      // Update voucher
      await voucher.update(updateData);

      res.json({
        success: true,
        data: { voucher },
        message: 'Voucher updated successfully',
      });
    } catch (error: any) {
      logger.error('Update voucher error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update voucher',
        details: error.message,
      });
    }
  }

  // Delete voucher (seller only)
  static async deleteVoucher(req: Request, res: Response) {
    try {
      const sellerId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const voucher = await Voucher.findOne({
        where: { id, sellerId },
      });

      if (!voucher) {
        return res.status(404).json({
          success: false,
          error: 'Voucher not found',
        });
      }

      await voucher.destroy();

      res.json({
        success: true,
        message: 'Voucher deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete voucher error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete voucher',
      });
    }
  }

  // Validate voucher code
  static async validateVoucher(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { code, totalAmount, productIds, categories } = req.body;

      if (!code || !totalAmount) {
        return res.status(400).json({
          success: false,
          error: 'Code and totalAmount are required',
        });
      }

      const validation = await VoucherService.validateVoucher(
        code,
        userId,
        parseFloat(totalAmount),
        productIds,
        categories
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      res.json({
        success: true,
        data: {
          voucher: validation.voucher,
          discountAmount: validation.discountAmount,
        },
      });
    } catch (error: any) {
      logger.error('Validate voucher error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate voucher',
      });
    }
  }

  // Apply voucher to cart/order (calculate discount)
  static async applyVoucher(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { code, subtotal, shippingFee, productIds, categories } = req.body;

      if (!code || !subtotal) {
        return res.status(400).json({
          success: false,
          error: 'Code and subtotal are required',
        });
      }

      const totalAmount = parseFloat(subtotal) + (parseFloat(shippingFee) || 0);

      const validation = await VoucherService.validateVoucher(
        code,
        userId,
        totalAmount,
        productIds,
        categories
      );

      if (!validation.valid || !validation.voucher) {
        return res.status(400).json({
          success: false,
          error: validation.error || 'Invalid voucher',
        });
      }

      const { discountAmount, shippingDiscount } = VoucherService.calculateDiscount(
        validation.voucher,
        parseFloat(subtotal),
        parseFloat(shippingFee) || 0
      );

      res.json({
        success: true,
        data: {
          voucher: validation.voucher,
          discountAmount,
          shippingDiscount,
          finalTotal: totalAmount - discountAmount - shippingDiscount,
        },
      });
    } catch (error: any) {
      logger.error('Apply voucher error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply voucher',
      });
    }
  }

  // Get voucher statistics
  static async getVoucherStats(req: Request, res: Response) {
    try {
      const sellerId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const voucher = await Voucher.findOne({
        where: { id, sellerId },
      });

      if (!voucher) {
        return res.status(404).json({
          success: false,
          error: 'Voucher not found',
        });
      }

      const stats = await VoucherService.getVoucherStats(id);

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error: any) {
      logger.error('Get voucher stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch voucher statistics',
      });
    }
  }
}


