import { Request, Response } from 'express';
import { getAllNetworks, getMainnetNetworks, getTestnetNetworks, getNetworksByType } from '../utils/networkUtils';
import { NetworkType } from '../config/networks';
import logger from '../utils/logger';

export class NetworkController {
  /**
   * Get all supported networks
   */
  static async getAllNetworks(req: Request, res: Response) {
    try {
      const { environment, type } = req.query;

      let networks;
      if (environment === 'mainnet') {
        networks = getMainnetNetworks();
      } else if (environment === 'testnet') {
        networks = getTestnetNetworks();
      } else if (type === 'BITCOIN') {
        networks = getNetworksByType(NetworkType.BITCOIN);
      } else if (type === 'EVM') {
        networks = getNetworksByType(NetworkType.EVM);
      } else {
        networks = getAllNetworks();
      }

      res.json({
        success: true,
        data: networks,
        count: networks.length,
      });
    } catch (error: any) {
      logger.error('Get all networks error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch networks',
      });
    }
  }

  /**
   * Get network by ID
   */
  static async getNetworkById(req: Request, res: Response) {
    try {
      const { networkId } = req.params;
      const { getNetworkConfig } = require('../utils/networkUtils');
      
      const network = getNetworkConfig(networkId);
      if (!network) {
        return res.status(404).json({
          success: false,
          error: 'Network not found',
        });
      }

      res.json({
        success: true,
        data: network,
      });
    } catch (error: any) {
      logger.error('Get network by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch network',
      });
    }
  }
}



