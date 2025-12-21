import express from 'express';
import { SwapController } from '../controllers/swap.controller';

const router = express.Router();

// Get swap quote
router.get('/quote', SwapController.getQuote);

// Execute swap
router.post('/', SwapController.swap);

export default router;



