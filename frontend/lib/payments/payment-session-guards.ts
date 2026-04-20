export function canCreateFreshPaymentSession(orderStatus: string | null | undefined) {
  return ['UNPAID', 'TX_FAILED'].includes(String(orderStatus || ''));
}

export function hasSubmittedPaymentInFlight(orderStatus: string | null | undefined) {
  return ['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED', 'PAID'].includes(
    String(orderStatus || '')
  );
}
