import { Router } from 'express';
import { register, login, walletLogin, oauthLogin, refreshToken, logout } from './auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/wallet-login', walletLogin);
router.post('/oauth', oauthLogin);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
