export function toNumericAmount(amount: number | string | null | undefined): number {
  if (typeof amount === 'number') {
    return Number.isFinite(amount) ? amount : 0;
  }

  if (typeof amount === 'string') {
    const parsed = Number.parseFloat(amount.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function hasPositiveAmount(amount: number | string | null | undefined): boolean {
  return toNumericAmount(amount) > 0;
}

export function formatEscrowAmount(amount: number | string | null | undefined, decimals = 6): string {
  return toNumericAmount(amount).toFixed(decimals);
}
