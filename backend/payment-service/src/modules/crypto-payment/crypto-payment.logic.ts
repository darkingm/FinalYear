export interface PaymentRowRef {
  order_id: number | string; // pg BIGINT returns string
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function isValidEthAddress(wallet: string | null | undefined): wallet is string {
  if (!wallet) return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return false;
  // Reject the zero address — it is structurally a 40-hex string but is
  // never a meaningful destination on EVM chains. EscrowCore reverts on it
  // ("Invalid seller"), so we fail-fast here and surface a clearer error
  // before the buyer signs a doomed transaction.
  if (wallet.toLowerCase() === ZERO_ADDRESS) return false;
  return true;
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
    // pg BIGINT returns string — coerce before checking
    const id = Number(row.order_id);
    if (Number.isFinite(id) && id > 0) {
      uniqueIds.add(id);
    }
  }

  return [...uniqueIds];
}
