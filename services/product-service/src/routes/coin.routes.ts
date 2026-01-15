import express from 'express';
import { CoinController } from '../controllers/coin.controller';

const router = express.Router();

// Get top 10 coins
router.get('/top10', CoinController.getTop10);

// Get all coins with limit - PHẢI ĐẶT TRƯỚC /:coinId
router.get('/', CoinController.getAllCoins);

// Search coins
router.get('/search', CoinController.search);

// Get coin by ID - PHẢI ĐẶT SAU route '/'
router.get('/:coinId', CoinController.getCoin);

// Get coin price history
router.get('/:coinId/history', CoinController.getPriceHistory);

export default router;

