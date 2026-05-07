'use client';

/**
 * SellerPayoutSummary — read-only widget for the seller dashboard.
 *
 * Surfaces three things sellers commonly get wrong:
 *   1. Their current `payout_wallet` (the address that receives crypto when
 *      escrow releases). If it's NULL, the backend will refuse to quote new
 *      crypto orders ("Seller has not connected a crypto wallet"), so the
 *      banner here links them straight to /wallet to fix it.
 *   2. The on-chain balance held by that wallet, on the active chain. This
 *      is just a sanity check — "did the last release actually arrive?".
 *   3. An obvious red banner if the wallet looks like a seed/placeholder
 *      address (`0xaaaa...aaaa`, `0xdead...dead`, etc.). Buyer escrow
 *      deposits to such an address are unrecoverable, so we want sellers to
 *      see it before they accept any orders.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useBalance } from 'wagmi';
import { AlertTriangle, ExternalLink, Wallet, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';

const PLACEHOLDER_PATTERNS = [
  /^0x([0-9a-f])\1{39}$/i,                  // 0xaaaa...aaaa, 0x0000...0000, 0xffff...ffff
  /^0xdead(dead)+([0-9a-f]{0,8})?$/i,       // 0xdeaddead...
  /^0xdeadbeef.*$/i,
];

function isPlaceholderAddress(addr: string | null | undefined): boolean {
  if (!addr) return false;
  const lower = addr.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((re) => re.test(lower));
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const EXPLORER_BY_CHAIN: Record<number, string> = {
  1: 'https://etherscan.io',
  137: 'https://polygonscan.com',
  56: 'https://bscscan.com',
  42161: 'https://arbiscan.io',
  80002: 'https://amoy.polygonscan.com',
  84532: 'https://sepolia.basescan.org',
  97: 'https://testnet.bscscan.com',
  421614: 'https://sepolia.arbiscan.io',
};

export function SellerPayoutSummary({ chainId = 31337 }: { chainId?: number }) {
  const [loading, setLoading] = useState(true);
  const [payoutWallet, setPayoutWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPayout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/seller/payout-wallet');
      setPayoutWallet(res.data?.payout_wallet ?? null);
    } catch {
      // Section is best-effort — don't block the dashboard.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayout(); }, [fetchPayout]);

  // Live balance for the configured chain. wagmi handles the no-address
  // case via the `enabled` flag below.
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: payoutWallet ? (payoutWallet as `0x${string}`) : undefined,
    chainId,
    query: { enabled: !!payoutWallet, refetchInterval: 30_000 },
  });

  const isPlaceholder = useMemo(() => isPlaceholderAddress(payoutWallet), [payoutWallet]);
  const explorerUrl = payoutWallet && EXPLORER_BY_CHAIN[chainId]
    ? `${EXPLORER_BY_CHAIN[chainId]}/address/${payoutWallet}`
    : null;

  const handleCopy = async () => {
    if (!payoutWallet) return;
    try {
      await navigator.clipboard.writeText(payoutWallet);
      setCopied(true);
      toast.success('Đã copy địa chỉ');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Không copy được');
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Ví nhận thanh toán</h2>
            <p className="text-xs text-muted-foreground">
              Địa chỉ nhận tiền khi escrow release sau khi buyer xác nhận giao hàng.
            </p>
          </div>
        </div>
        <Link href="/wallet" className="text-xs text-primary hover:underline shrink-0 mt-1">
          Quản lý ví →
        </Link>
      </div>

      {loading ? (
        <div className="h-16 flex items-center text-sm text-muted-foreground">Đang tải…</div>
      ) : !payoutWallet ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-600 dark:text-amber-400">
              Chưa cấu hình ví nhận tiền
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Buyer sẽ KHÔNG checkout được crypto vào sản phẩm của bạn cho đến khi bạn liên kết
              + chọn ví nhận tiền. Đi tới <Link href="/wallet" className="underline text-primary">/wallet</Link> để link MetaMask.
            </p>
          </div>
        </div>
      ) : isPlaceholder ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-500">⚠ Địa chỉ ví không hợp lệ</p>
            <p className="text-sm text-muted-foreground mt-1 break-all">
              <code className="text-xs">{payoutWallet}</code> trông giống địa chỉ placeholder/seed —
              KHÔNG ai có private key cho địa chỉ này. Mọi tiền release vào đây sẽ <strong>mất vĩnh viễn</strong>.
              Hãy đổi sang ví thật trong <Link href="/wallet" className="underline text-primary">/wallet</Link>.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Address card */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">Địa chỉ payout</p>
              <code className="text-sm font-mono break-all">{shortAddress(payoutWallet)}</code>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                title="Copy"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                  title="Mở explorer"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">
              Số dư on-chain (chain {chainId})
            </p>
            {balanceLoading ? (
              <span className="text-sm text-muted-foreground">…</span>
            ) : balance ? (
              <span className="text-sm font-semibold">
                {Number(balance.formatted).toFixed(6)} {balance.symbol}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">–</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
