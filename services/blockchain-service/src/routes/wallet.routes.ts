import express from 'express';
import { WalletController } from '../controllers/wallet.controller';

const router = express.Router();

// Create wallet
router.post('/create', WalletController.createWallet);

// Create wallet for specific network
router.post('/user/:userId/networks', WalletController.createNetworkWallet);

// Get wallet by user ID
router.get('/user/:userId', WalletController.getWalletByUserId);

// Get wallet by address
router.get('/address/:address', WalletController.getWalletByAddress);

// Get all balances for address on network
router.get('/:address/balance/:networkId/all', WalletController.getAllBalances);

// Get wallet balance (supports networkId query param)
router.get('/:address/balance', WalletController.getBalance);

// Verify wallet
router.put('/:address/verify', WalletController.verifyWallet);

export default router;

