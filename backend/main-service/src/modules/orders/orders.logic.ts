export function isBuyerOnchainCompletionSync(
  status: string,
  paymentMethod: string | null,
  completionSource?: string | null,
): boolean {
  return status === 'COMPLETED'
    && paymentMethod === 'crypto'
    && completionSource === 'buyer_onchain';
}

export function shouldTriggerEscrowRelease(
  status: string,
  paymentMethod: string | null,
  completionSource?: string | null,
): boolean {
  return status === 'COMPLETED'
    && paymentMethod === 'crypto'
    && completionSource !== 'buyer_onchain';
}
