import { BaseProvider } from '../providers/BaseProvider';
import { BitcoinProvider } from '../providers/BitcoinProvider';
import { EVMProvider } from '../providers/EVMProvider';
import { getNetworkById, NetworkType } from '../config/networks';
import logger from '../utils/logger';

class MultiChainService {
  private providers: Map<string, BaseProvider> = new Map();

  /**
   * Get or create provider for a network
   */
  getProvider(networkId: string): BaseProvider {
    // Check if provider already exists
    if (this.providers.has(networkId)) {
      return this.providers.get(networkId)!;
    }

    // Get network configuration
    const network = getNetworkById(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    // Create appropriate provider
    let provider: BaseProvider;
    if (network.type === NetworkType.BITCOIN) {
      provider = new BitcoinProvider(network);
    } else if (network.type === NetworkType.EVM) {
      provider = new EVMProvider(network);
    } else {
      throw new Error(`Unsupported network type: ${network.type}`);
    }

    // Cache provider
    this.providers.set(networkId, provider);
    logger.info(`Provider created for network: ${networkId}`);

    return provider;
  }

  /**
   * Check if network is supported
   */
  isNetworkSupported(networkId: string): boolean {
    const network = getNetworkById(networkId);
    return network !== undefined;
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(networkId: string) {
    const network = getNetworkById(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }
    return network;
  }

  /**
   * Clear provider cache (useful for testing or reconnection)
   */
  clearProviderCache(networkId?: string): void {
    if (networkId) {
      this.providers.delete(networkId);
      logger.info(`Provider cache cleared for network: ${networkId}`);
    } else {
      this.providers.clear();
      logger.info('All provider caches cleared');
    }
  }
}

export default new MultiChainService();



