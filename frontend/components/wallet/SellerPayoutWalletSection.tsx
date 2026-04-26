'use client';

/**
 * SellerPayoutWalletSection — lets a seller pick which of their linked
 * EVM wallets receives funds when buyers pay them in crypto.
 *
 * Buyers' payments are deposited into EscrowCore.deposit(orderId, token,
 * amount, seller). The `seller` arg is read from
 * seller_profiles.payout_wallet on the backend. If that column is NULL,
 * the backend will auto-fall-back to the seller's primary linked wallet
 * — but it is still a strong UX win to let the seller see and curate the
 * choice explicitly so they understand exactly where the money will land.
 *
 * The component:
 *   - GETs /api/seller/payout-wallet to load the current value + linked wallets.
 *   - Shows a banner explaining the auto-heal fallback.
 *   - PATCHes /api/seller/payout-wallet on user selection.
 *   - Only addresses already linked in user_wallets are eligible (server-enforced).
 */

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, Star, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';

interface LinkedWallet {
  wallet_db_id: number;
  address: string;
  chain_type: string;
  chain_id: number | null;
  label: string | null;
  is_primary: boolean;
}

export function SellerPayoutWalletSection() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [payoutWallet, setPayoutWallet] = useState<string | null>(null);
  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/seller/payout-wallet');
      setPayoutWallet(res.data?.payout_wallet ?? null);
      setLinkedWallets(Array.isArray(res.data?.linked_wallets) ? res.data.linked_wallets : []);
    } catch {
      /* silent — section is optional */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelect = async (address: string) => {
    if (updating) return;
    if (payoutWallet && payoutWallet.toLowerCase() === address.toLowerCase()) return;
    setUpdating(true);
    try {
      const res = await apiClient.patch('/api/seller/payout-wallet', { address });
      setPayoutWallet(res.data?.payout_wallet ?? address.toLowerCase());
      toast.success('Đã cập nhật ví nhận tiền');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải cài đặt ví nhận tiền…
      </div>
    );
  }

  // No linked wallets at all → nothing useful to render. The wallets list
  // upstream already prompts the user to link a MetaMask wallet.
  if (linkedWallets.length === 0) return null;

  const activeWallet = payoutWallet?.toLowerCase() ?? null;
  const isUsingFallback = !payoutWallet;
  const fallbackWallet = linkedWallets.find(w => w.is_primary) ?? linkedWallets[0];

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <h3 className="font-bold text-sm">Ví nhận thanh toán khi bán hàng</h3>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Buyer thanh toán crypto sẽ được hợp đồng <strong>EscrowCore</strong> giải
        ngân vào ví bạn chọn ở đây. Chỉ những ví đã liên kết &amp; xác minh trên
        tài khoản này mới được phép.
      </p>

      {isUsingFallback && fallbackWallet && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300 flex-1">
            <p className="font-bold">Bạn chưa chọn ví nhận tiền</p>
            <p className="mt-0.5">
              Hệ thống sẽ tự dùng ví primary{' '}
              <span className="font-mono">{shortAddr(fallbackWallet.address)}</span>{' '}
              cho đến khi bạn chọn. Để chắc chắn, hãy bấm chọn 1 ví bên dưới.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {linkedWallets.map(w => {
          const isActive = activeWallet === w.address.toLowerCase();
          return (
            <button
              key={w.wallet_db_id}
              type="button"
              disabled={updating}
              onClick={() => handleSelect(w.address)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                isActive
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-border hover:border-emerald-500/40'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isActive ? 'bg-emerald-500/20' : 'bg-muted'
              }`}>
                {isActive ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono text-xs">{shortAddr(w.address)}</p>
                  {w.is_primary && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#f0b90b]/15 text-[#f0b90b] inline-flex items-center gap-1">
                      <Star className="w-2.5 h-2.5" /> PRIMARY
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                      ĐANG DÙNG
                    </span>
                  )}
                </div>
                {w.label && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{w.label}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shortAddr(addr: string) {
  if (!addr) return '';
  return addr.length < 14 ? addr : `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}
