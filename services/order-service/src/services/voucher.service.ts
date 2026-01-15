import Voucher, { VoucherType, VoucherStatus } from '../models/Voucher.model';
import VoucherUsage from '../models/VoucherUsage.model';
import logger from '../utils/logger';

export interface VoucherValidationResult {
  valid: boolean;
  voucher?: Voucher;
  discountAmount?: number;
  error?: string;
}

export class VoucherService {
  /**
   * Validate voucher code
   */
  static async validateVoucher(
    code: string,
    userId: string,
    totalAmount: number,
    productIds?: string[],
    categories?: string[]
  ): Promise<VoucherValidationResult> {
    try {
      const voucher = await Voucher.findOne({
        where: { code: code.toUpperCase() },
      });

      if (!voucher) {
        return {
          valid: false,
          error: 'Voucher code not found',
        };
      }

      // Check if voucher is active
      if (voucher.status !== VoucherStatus.ACTIVE) {
        return {
          valid: false,
          error: 'Voucher is not active',
        };
      }

      // Check date validity
      const now = new Date();
      if (now < voucher.startDate || now > voucher.endDate) {
        return {
          valid: false,
          error: 'Voucher has expired or not yet started',
        };
      }

      // Check max uses
      if (voucher.maxUses && voucher.usedCount >= voucher.maxUses) {
        return {
          valid: false,
          error: 'Voucher usage limit exceeded',
        };
      }

      // Check min purchase amount
      if (voucher.minPurchaseAmount && totalAmount < voucher.minPurchaseAmount) {
        return {
          valid: false,
          error: `Minimum purchase amount of $${voucher.minPurchaseAmount} required`,
        };
      }

      // Check max uses per user
      if (voucher.maxUsesPerUser) {
        const userUsageCount = await VoucherUsage.count({
          where: {
            voucherId: voucher.id,
            userId,
          },
        });

        if (userUsageCount >= voucher.maxUsesPerUser) {
          return {
            valid: false,
            error: 'You have reached the maximum usage limit for this voucher',
          };
        }
      }

      // Check applicable products/categories
      if (voucher.applicableProducts && voucher.applicableProducts.length > 0) {
        if (!productIds || !productIds.some((id) => voucher.applicableProducts!.includes(id))) {
          return {
            valid: false,
            error: 'Voucher is not applicable to selected products',
          };
        }
      }

      if (voucher.applicableCategories && voucher.applicableCategories.length > 0) {
        if (!categories || !categories.some((cat) => voucher.applicableCategories!.includes(cat))) {
          return {
            valid: false,
            error: 'Voucher is not applicable to selected categories',
          };
        }
      }

      // Calculate discount amount
      const discountAmount = voucher.calculateDiscount(totalAmount);

      return {
        valid: true,
        voucher,
        discountAmount,
      };
    } catch (error: any) {
      logger.error('Voucher validation error:', error);
      return {
        valid: false,
        error: 'Failed to validate voucher',
      };
    }
  }

  /**
   * Calculate discount amount for an order
   */
  static calculateDiscount(
    voucher: Voucher,
    subtotal: number,
    shippingFee: number = 0
  ): { discountAmount: number; shippingDiscount: number } {
    let discountAmount = 0;
    let shippingDiscount = 0;

    if (voucher.type === VoucherType.FREE_SHIPPING) {
      shippingDiscount = shippingFee;
    } else {
      discountAmount = voucher.calculateDiscount(subtotal);
    }

    return { discountAmount, shippingDiscount };
  }

  /**
   * Record voucher usage
   */
  static async recordUsage(
    voucherId: string,
    userId: string,
    orderId: string,
    discountAmount: number
  ): Promise<boolean> {
    try {
      await VoucherUsage.create({
        voucherId,
        userId,
        orderId,
        discountAmount,
      });

      // Update voucher used count
      await Voucher.increment('usedCount', {
        where: { id: voucherId },
      });

      return true;
    } catch (error: any) {
      logger.error('Record voucher usage error:', error);
      return false;
    }
  }

  /**
   * Get vouchers for a seller
   */
  static async getSellerVouchers(sellerId: string): Promise<Voucher[]> {
    return await Voucher.findAll({
      where: { sellerId },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Get public vouchers (global vouchers)
   */
  static async getPublicVouchers(): Promise<Voucher[]> {
    return await Voucher.findAll({
      where: {
        sellerId: null,
        status: VoucherStatus.ACTIVE,
      },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Get voucher statistics
   */
  static async getVoucherStats(voucherId: string): Promise<{
    totalUses: number;
    totalDiscount: number;
    uniqueUsers: number;
  }> {
    const usages = await VoucherUsage.findAll({
      where: { voucherId },
    });

    const totalUses = usages.length;
    const totalDiscount = usages.reduce((sum, usage) => {
      return sum + parseFloat(usage.discountAmount.toString());
    }, 0);
    const uniqueUsers = new Set(usages.map((u) => u.userId)).size;

    return {
      totalUses,
      totalDiscount,
      uniqueUsers,
    };
  }
}


