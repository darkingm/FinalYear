import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getInventory } from './inventory.controller';

const router = Router();

router.get('/:productId', authenticate, getInventory);

export default router;
