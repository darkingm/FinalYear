import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
    getWallets, addWallet, removeWallet, setPrimary,
    getDepositHistory, getDepositAddresses, getSupportedChains, getChainTokens,
} from './wallets.controller';

const router = Router();

// Public: chains & deposit addresses
router.get('/chains', getSupportedChains);
router.get('/chains/:chainId/tokens', getChainTokens);
router.get('/deposit-addresses', getDepositAddresses);

// Auth required
router.get('/', authenticate, getWallets);
router.post('/', authenticate, addWallet);
router.delete('/:id', authenticate, removeWallet);
router.patch('/:id/primary', authenticate, setPrimary);
router.get('/deposits', authenticate, getDepositHistory);

export default router;
