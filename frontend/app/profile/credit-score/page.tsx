'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAccount } from 'wagmi';
import { apiClient } from '@/lib/api/client';
import { Shield, Crown, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const TIER_CONFIG = {
  BRONZE:  { colors: 'from-amber-700 to-amber-900',   icon: '🥉', glow: 'shadow-amber-500/50',  label: 'Đồng',       next: 100  },
  SILVER:  { colors: 'from-gray-400 to-gray-600',      icon: '🥈', glow: 'shadow-gray-400/50',   label: 'Bạc',        next: 300  },
  GOLD:    { colors: 'from-yellow-400 to-yellow-600',  icon: '🥇', glow: 'shadow-yellow-400/50', label: 'Vàng',       next: 600  },
  DIAMOND: { colors: 'from-purple-500 to-purple-700',  icon: '💎', glow: 'shadow-purple-500/50', label: 'Kim Cương',  next: null },
};

export default function CreditScoreWebPage() {
  const { isAuthenticated } = useAuth();
  const { address: walletAddress } = useAccount();
  const [credit, setCredit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredit = async () => {
    if (!walletAddress) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/nft/credit/${walletAddress}`);
      setCredit(res.data.data);
    } catch {
      setCredit({ score: 0, tier: 'BRONZE', hasSBT: false, tierFee: 2.5, canInstallment: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress) fetchCredit();
    else setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const tier = TIER_CONFIG[(credit?.tier || 'BRONZE') as keyof typeof TIER_CONFIG];
  const progress = tier.next ? Math.min(((credit?.score || 0) / tier.next) * 100, 100) : 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full py-10 px-4">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
              <Shield className="w-8 h-8 text-yellow-500" />
              Blockchain Credit Score
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Hệ thống điểm tích lũy bằng Token không thể chuyển nhượng (SBT ERC-5192).
            </p>
          </div>
          {walletAddress && (
            <button
              onClick={fetchCredit}
              className="p-3 bg-card hover:bg-muted border border-border rounded-xl transition-colors text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* No wallet connected */}
        {!walletAddress ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] bg-card border border-border rounded-2xl p-10">
            <div className="p-4 bg-yellow-500/10 rounded-full mb-4">
              <Shield className="w-12 h-12 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Chưa kết nối Ví Web3</h2>
            <p className="text-muted-foreground mt-2 text-center max-w-md">
              Kết nối ví MetaMask trên mạng Polygon để xem Điểm uy tín SBT của tài khoản này.
            </p>
          </div>

        /* Loading */
        ) : loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
          </div>

        /* Content */
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Left — Score Card + Perks */}
            <div>
              <div className={`relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br ${tier.colors} shadow-2xl ${tier.glow} mb-6`}>
                <div className="absolute top-0 right-0 p-8 opacity-20">
                  <span className="text-9xl">{tier.icon}</span>
                </div>
                <div className="relative z-10 w-full mb-6 flex justify-between">
                  <span className="text-white/80 font-bold uppercase tracking-widest text-sm">Hạng ví</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {credit?.hasSBT ? 'SBT Đã đúc' : 'Chưa có SBT'}
                  </span>
                </div>
                <div className="relative z-10">
                  <h2 className="text-5xl font-black text-white mb-2">{tier.label}</h2>
                  <div className="flex items-end gap-2 text-white">
                    <span className="text-6xl font-black">{credit?.score || 0}</span>
                    <span className="text-xl mb-1 opacity-80 font-bold">PTS</span>
                  </div>
                </div>
                {tier.next && (
                  <div className="mt-8 relative z-10">
                    <div className="flex justify-between text-sm text-white/90 mb-2 font-semibold">
                      <span>{credit?.score || 0} điểm</span>
                      <span>Cần {tier.next - (credit?.score || 0)} điểm để thăng hạng</span>
                    </div>
                    <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Perks */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-foreground font-bold mb-4">Mở khóa đặc quyền:</h3>
                <ul className="space-y-4">
                  <li className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="bg-green-500/20 text-green-500 p-2 rounded-lg">💳</span>
                      Phí giao dịch sàn
                    </div>
                    <span className="font-bold text-green-400">{credit?.tierFee || 2.5}%</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className={`p-2 rounded-lg ${credit?.canInstallment ? 'bg-yellow-500/20 text-yellow-500' : 'bg-muted'}`}>⚡</span>
                      Mua hàng trả góp
                    </div>
                    <span className={`font-bold ${credit?.canInstallment ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                      {credit?.canInstallment ? 'Đã mở khóa' : 'Hạng Vàng'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right — Guide */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-xl font-bold text-foreground mb-6">Làm sao để tăng điểm?</h3>
              <div className="space-y-3">
                {[
                  { detail: 'Mua và Xác nhận hàng thành công',         point: '+15 PTS', cls: 'bg-green-500/10 text-green-500 border-green-500/20' },
                  { detail: 'Thanh toán giao dịch trong dưới 1 tiếng', point: '+05 PTS', cls: 'bg-green-500/10 text-green-500 border-green-500/20' },
                  { detail: 'Nhận đánh giá 5 sao từ người bán',        point: '+03 PTS', cls: 'bg-green-500/10 text-green-500 border-green-500/20' },
                  { detail: 'Huỷ giao dịch đã chốt / Trả hàng vô cớ', point: '-30 PTS', cls: 'bg-red-500/10   text-red-500   border-red-500/20'   },
                  { detail: 'Vi phạm KYC / Lừa đảo hệ thống',         point: '-50 PTS', cls: 'bg-red-500/10   text-red-500   border-red-500/20'   },
                ].map((r, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${r.cls}`}>
                    <span className="font-medium text-sm">{r.detail}</span>
                    <span className="font-bold text-sm whitespace-nowrap ml-3">{r.point}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                  <Crown className="w-5 h-5" /> Hệ Thống Vay KHÔNG Thế Chấp
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Với tài khoản từ <strong className="text-purple-400">Kim Cương (Diamond)</strong>, trong tương lai bạn có thể vay stablecoin từ Liquidity Pool mà không cần Deposit Token!
                </p>
              </div>
            </div>

          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
