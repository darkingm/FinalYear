/**
 * Smart contract ABIs used by the frontend.
 */

export const ESCROW_ABI = [
  'function deposit(string orderId, address token, uint256 amount, address seller) external',
  'function release(string orderId) external',
  'function refund(string orderId) external',
  'function pause() external',
  'function unpause() external',
  'event OrderCreated(string indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount)',
  'event OrderReleased(string indexed orderId)',
  'event OrderRefunded(string indexed orderId)',
] as const;

export type EscrowABI = typeof ESCROW_ABI;
