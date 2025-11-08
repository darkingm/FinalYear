import express from 'express';
import { WalletController } from '../controllers/wallet.controller';

const router = express.Router();

// Create wallet
router.post('/create', WalletController.createWallet);

// Get wallet by user ID
router.get('/user/:userId', WalletController.getWalletByUserId);

// Get wallet by address
router.get('/address/:address', WalletController.getWalletByAddress);

// Get wallet balance
router.get('/:address/balance', WalletController.getBalance);

// Verify wallet
router.put('/:address/verify', WalletController.verifyWallet);

export default router;

