export interface PaymentRowRef {
  order_id: number;
}

export function isValidEthAddress(wallet: string | null | undefined): wallet is string {
  return !!wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet);
}

export function resolveSellerWallet(rawWallet: string | null | undefined): string | null {
  return isValidEthAddress(rawWallet) ? rawWallet.toLowerCase() : null;
}

export function resolveOperatorPrivateKey(env: NodeJS.ProcessEnv): string | null {
  const candidate = env.ADMIN_PRIVATE_KEY || env.PRIVATE_KEY || env.BLOCKCHAIN_PRIVATE_KEY;
  return candidate && candidate.trim() ? candidate : null;
}

export function resolveBuyerWallet(input: {
  sessionBuyerWallet?: string | null;
  userWallet?: string | null;
  buyerId: number | string;
}): string {
  if (isValidEthAddress(input.sessionBuyerWallet)) {
    return input.sessionBuyerWallet.toLowerCase();
  }

  if (isValidEthAddress(input.userWallet)) {
    return input.userWallet.toLowerCase();
  }

  return String(input.buyerId);
}

export function collectAffectedOrderIds(rows: PaymentRowRef[]): number[] {
  const uniqueIds = new Set<number>();

  for (const row of rows) {
    if (Number.isInteger(row.order_id) && row.order_id > 0) {
      uniqueIds.add(row.order_id);
    }
  }

  return [...uniqueIds];
}
