import { Router } from 'express';
import { register, login, walletLogin, oauthLogin, refreshToken, logout, linkWallet, forgotPassword, resetPassword } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/wallet-login', walletLogin);
router.post('/oauth', oauthLogin);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/link-wallet', authenticate, linkWallet);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
