/**
 * Smart contract ABIs used by the frontend.
 * Must match contracts/contracts/EscrowCore.sol
 */

export const ESCROW_ABI = [
  // Write functions
  'function deposit(string orderId, address token, uint256 amount, address seller) external',
  'function releasePayment(string orderId) external',
  'function refund(string orderId) external',
  'function raiseDispute(string orderId) external',
  'function pause() external',
  'function unpause() external',
  'function updatePlatformFee(uint256 newFeePercent) external',
  'function updateFeeVault(address newVault) external',
  // Read functions
  'function getOrder(string orderId) external view returns (tuple(string orderId, address buyer, address seller, address token, uint256 amount, uint256 fee, uint8 status, uint256 createdAt, uint256 expiresAt))',
  'function platformFeePercent() external view returns (uint256)',
  'function feeVault() external view returns (address)',
  'function paused() external view returns (bool)',
  // Events
  'event OrderCreated(string indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount, uint256 fee)',
  'event OrderCompleted(string indexed orderId)',
  'event OrderRefunded(string indexed orderId)',
  'event OrderDisputed(string indexed orderId)',
  'event FeeUpdated(uint256 newFee)',
  'event FeeVaultUpdated(address newVault)',
] as const;

export type EscrowABI = typeof ESCROW_ABI;

