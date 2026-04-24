import { Router } from 'express';
import { register, login, walletLogin, oauthLogin, refreshToken, logout, linkWallet, forgotPassword, resetPassword } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authLimiter, strictLimiter } from '../../middleware/rate-limit';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/wallet-login', authLimiter, walletLogin);
router.post('/oauth', authLimiter, oauthLogin);  // Rate limited — NextAuth server-to-server
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/link-wallet', authenticate, linkWallet);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', strictLimiter, resetPassword);

export default router;
