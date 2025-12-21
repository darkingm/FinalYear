import express from 'express';
import { TransferController } from '../controllers/transfer.controller';

const router = express.Router();

// Transfer native coin
router.post('/native', TransferController.transferNative);

// Transfer token
router.post('/token', TransferController.transferToken);

export default router;



