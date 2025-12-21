import express from 'express';
import { NetworkController } from '../controllers/network.controller';

const router = express.Router();

// Get all networks
router.get('/', NetworkController.getAllNetworks);

// Get network by ID
router.get('/:networkId', NetworkController.getNetworkById);

export default router;



