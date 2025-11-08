import { Request, Response } from 'express';
import CartItem from '../models/Cart.model';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

export class CartController {
  // Get user's cart
  static async getCart(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      const cartItems = await CartItem.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
      });

      // Calculate totals
      const subtotalInCoins = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.priceInCoins.toString()) * item.quantity;
      }, 0);

      const subtotalInUSD = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.priceInUSD.toString()) * item.quantity;
      }, 0);

      res.json({
        success: true,
        data: {
          items: cartItems,
          itemCount: cartItems.length,
          totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotalInCoins: subtotalInCoins.toFixed(8),
          subtotalInUSD: subtotalInUSD.toFixed(2),
        },
      });
    } catch (error: any) {
      logger.error('Get cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cart',
      });
    }
  }

  // Add item to cart
  static async addToCart(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const {
        productId,
        productTitle,
        productImage,
        sellerId,
        sellerName,
        quantity,
        priceInCoins,
        priceInUSD,
      } = req.body;

      // Check if item already in cart
      let cartItem = await CartItem.findOne({
        where: { userId, productId },
      });

      if (cartItem) {
        // Update quantity
        cartItem.quantity += quantity;
        await cartItem.save();
      } else {
        // Create new cart item
        cartItem = await CartItem.create({
          userId,
          productId,
          productTitle,
          productImage,
          sellerId,
          sellerName,
          quantity,
          priceInCoins,
          priceInUSD,
        });
      }

      res.status(201).json({
        success: true,
        data: cartItem,
        message: 'Item added to cart',
      });
    } catch (error: any) {
      logger.error('Add to cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add item to cart',
        details: error.message,
      });
    }
  }

  // Update cart item quantity
  static async updateCartItem(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      const { quantity } = req.body;

      const cartItem = await CartItem.findOne({
        where: { id, userId },
      });

      if (!cartItem) {
        return res.status(404).json({
          success: false,
          error: 'Cart item not found',
        });
      }

      if (quantity <= 0) {
        await cartItem.destroy();
        return res.json({
          success: true,
          message: 'Item removed from cart',
        });
      }

      cartItem.quantity = quantity;
      await cartItem.save();

      res.json({
        success: true,
        data: cartItem,
      });
    } catch (error: any) {
      logger.error('Update cart item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update cart item',
      });
    }
  }

  // Remove item from cart
  static async removeFromCart(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const result = await CartItem.destroy({
        where: { id, userId },
      });

      if (result === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cart item not found',
        });
      }

      res.json({
        success: true,
        message: 'Item removed from cart',
      });
    } catch (error: any) {
      logger.error('Remove from cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove item from cart',
      });
    }
  }

  // Clear cart
  static async clearCart(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      await CartItem.destroy({
        where: { userId },
      });

      res.json({
        success: true,
        message: 'Cart cleared',
      });
    } catch (error: any) {
      logger.error('Clear cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cart',
      });
    }
  }
}

