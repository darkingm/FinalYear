import express from 'express';
import { ShopController } from '../controllers/shop.controller';

const router = express.Router();

// Get shop by seller ID
router.get('/seller/:sellerId', ShopController.getShopBySellerId);

// Get shop by shop ID
router.get('/:shopId', ShopController.getShopById);

// Get shop products
router.get('/:shopId/products', ShopController.getShopProducts);

// Create or update shop (requires authentication)
router.post('/', ShopController.createOrUpdateShop);
router.put('/', ShopController.createOrUpdateShop);

// Get top shops
router.get('/top/list', ShopController.getTopShops);

export default router;

