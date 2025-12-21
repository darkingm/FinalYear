import { getNetworkById, NetworkType, NETWORKS } from '../config/networks';
import { NetworkConfig } from '../config/networks';

/**
 * Get network configuration by ID
 */
export const getNetworkConfig = (networkId: string): NetworkConfig | undefined => {
  return getNetworkById(networkId);
};

/**
 * Check if network is EVM compatible
 */
export const isEVMNetwork = (networkId: string): boolean => {
  const network = getNetworkById(networkId);
  return network?.type === NetworkType.EVM;
};

/**
 * Check if network is Bitcoin
 */
export const isBitcoinNetwork = (networkId: string): boolean => {
  const network = getNetworkById(networkId);
  return network?.type === NetworkType.BITCOIN;
};

/**
 * Get all supported networks
 */
export const getAllNetworks = (): NetworkConfig[] => {
  return Object.values(NETWORKS);
};

/**
 * Get networks by type
 */
export const getNetworksByType = (type: NetworkType): NetworkConfig[] => {
  return Object.values(NETWORKS).filter((network) => network.type === type);
};

/**
 * Get mainnet networks
 */
export const getMainnetNetworks = (): NetworkConfig[] => {
  return Object.values(NETWORKS).filter((network) => !network.isTestnet);
};

/**
 * Get testnet networks
 */
export const getTestnetNetworks = (): NetworkConfig[] => {
  return Object.values(NETWORKS).filter((network) => network.isTestnet);
};

/**
 * Get network by chain ID (for EVM networks)
 */
export const getNetworkByChainId = (chainId: number, isTestnet: boolean = false): NetworkConfig | undefined => {
  return Object.values(NETWORKS).find(
    (network) => network.chainId === chainId && network.isTestnet === isTestnet
  );
};

/**
 * Check if network is active
 */
export const isNetworkActive = (networkId: string): boolean => {
  const network = getNetworkById(networkId);
  return network !== undefined;
};



