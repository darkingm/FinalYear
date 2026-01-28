import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

export async function getInventory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.productId);

    const result = await query(
      `SELECT i.*, p.name as product_name
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       WHERE i.product_id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Inventory not found', 404);
    }

    res.json({
      success: true,
      inventory: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Get inventory error:', error);
    next(error);
  }
}
