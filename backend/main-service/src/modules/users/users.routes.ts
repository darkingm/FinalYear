import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getProfile, updateProfile } from './users.controller';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

export default router;
