import express from 'express';
import { TokenController } from '../controllers/token.controller';

const router = express.Router();

// Mint new token
router.post('/mint', TokenController.mintToken);

// Transfer token
router.post('/transfer', TokenController.transferToken);

// Get token details
router.get('/:tokenId', TokenController.getTokenDetails);

// Get user's tokens
router.get('/user/:userId', TokenController.getUserTokens);

// Get tokens by product
router.get('/product/:productId', TokenController.getTokensByProduct);

// Verify token ownership
router.get('/:tokenId/verify', TokenController.verifyOwnership);

export default router;

