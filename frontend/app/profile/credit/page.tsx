'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CreditScoreBadge } from '@/components/web3/CreditScoreBadge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { motion } from 'framer-motion';
import { Shield, Award, TrendingUp, Info } from 'lucide-react';

export default function CreditScorePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#f0b90b]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl relative z-10">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#f0b90b]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground">Credit Score</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Hệ thống tín dụng phi tập trung trên Blockchain
            </p>
          </div>
        </motion.div>

        {/* Main badge */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <CreditScoreBadge variant="full" className="mb-6" />
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-3xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            Hệ thống Credit Score hoạt động như thế nào?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: '🏆',
                title: 'Tích điểm theo hành vi',
                desc: 'Mỗi đơn hàng hoàn thành, thanh toán đúng hạn, đánh giá 5 sao đều cộng điểm vào SBT của bạn.',
              },
              {
                icon: '⛓️',
                title: 'Lưu trữ trên Blockchain',
                desc: 'Điểm tín dụng được lưu vĩnh viễn trên Polygon, không thể giả mạo hoặc xóa.',
              },
              {
                icon: '💎',
                title: '4 cấp bậc đặc quyền',
                desc: 'Bronze → Silver → Gold → Diamond. Tier cao hơn = phí thấp hơn, quyền trả góp, ưu tiên listing.',
              },
              {
                icon: '🎖️',
                title: 'Soulbound Token (SBT)',
                desc: 'Mỗi ví nhận 1 NFT SBT duy nhất, không thể chuyển nhượng. Đại diện cho danh tính tín dụng Web3.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="p-4 bg-muted/50 rounded-2xl border border-border hover:border-[#f0b90b]/20 transition-colors"
              >
                <span className="text-2xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold text-sm text-foreground mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tier comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-3xl p-6"
        >
          <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#f0b90b]" />
            So sánh các bậc Credit
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-left text-muted-foreground font-medium">Bậc</th>
                  <th className="py-3 px-4 text-center text-muted-foreground font-medium">Điểm</th>
                  <th className="py-3 px-4 text-center text-muted-foreground font-medium">Phí</th>
                  <th className="py-3 px-4 text-center text-muted-foreground font-medium">Trả góp</th>
                  <th className="py-3 px-4 text-center text-muted-foreground font-medium">Ưu tiên</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { emoji: '🥉', name: 'Bronze', score: '0–99',    fee: '2.50%', install: '✗', priority: '✗', color: '#cd7f32' },
                  { emoji: '🥈', name: 'Silver', score: '100–299', fee: '2.00%', install: '✗', priority: '✗', color: '#9ca3af' },
                  { emoji: '🥇', name: 'Gold',   score: '300–599', fee: '1.50%', install: '✓', priority: '✓', color: '#f0b90b' },
                  { emoji: '💎', name: 'Diamond', score: '600+',   fee: '1.00%', install: '✓', priority: '✓', color: '#7dd3fc' },
                ].map(tier => (
                  <tr key={tier.name} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-2 font-bold" style={{ color: tier.color }}>
                        {tier.emoji} {tier.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-foreground">{tier.score}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-400">{tier.fee}</td>
                    <td className="py-3 px-4 text-center">{tier.install === '✓' ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-muted-foreground">✗</span>}</td>
                    <td className="py-3 px-4 text-center">{tier.priority === '✓' ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-muted-foreground">✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
