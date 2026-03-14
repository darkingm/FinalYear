'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Package, Star, ShoppingBag, DollarSign,
  Users, AlertTriangle, RefreshCw, Calendar, ChevronDown,
  ArrowUpRight, ArrowDownRight, Zap, BarChart3, Eye,
  Award, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SellerOverview {
  revenue:      { total_revenue: string; period_revenue: string; today_revenue: string };
  orders:       { total_orders: string; period_orders: string; completed_period: string; cancelled: string; disputed: string; pending_payment: string };
  topProducts:  TopProduct[];
  dailyRevenue: { date: string; revenue: string; orders: string }[];
  reviews:      { avg_rating: string; total_reviews: string; star5: string; star4: string; star3: string; star2: string; star1: string };
  conversion:   { total_orders: string; unique_buyers: string };
  period:       number;
}

interface TopProduct {
  product_id: number; name: string; base_price_usd: string;
  order_count: string; revenue: string; rating: string; review_count: string; stock: string;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
const StatCard = memo(function StatCard({
  icon, label, value, sub, color, trend, delay = 0,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: string; trend?: { value: number; label: string }; delay?: number;
}) {
  const isUp = (trend?.value ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-card border border-border rounded-2xl p-5 hover:border-border/70 transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center`} style={{ background: `${color}18` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
            {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend.value).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-foreground mb-1">{value}</p>
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
    </motion.div>
  );
});

// Mini bar chart
function MiniBarChart({ data }: { data: { date: string; revenue: string; orders: string }[] }) {
  if (!data.length) return null;
  const maxRev = Math.max(...data.map(d => parseFloat(d.revenue)), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.slice(-30).map((d, i) => {
        const pct = (parseFloat(d.revenue) / maxRev) * 100;
        const date = new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${date}: $${parseFloat(d.revenue).toFixed(0)}`}>
            <motion.div
              className="w-full rounded-t-sm bg-gradient-to-t from-[#f0b90b] to-[#f3ba2f] min-h-[2px] cursor-pointer hover:from-[#f0b90b]/80 hover:to-[#f0b90b] transition-colors"
              style={{ height: `${Math.max(pct, 2)}%` }}
              initial={{ scaleY: 0, originY: 1 }}
              animate={{ scaleY: 1, originY: 1 }}
              transition={{ delay: i * 0.02, duration: 0.4 }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg px-2 py-1 text-xs text-foreground invisible group-hover:visible whitespace-nowrap z-10 shadow-xl">
              {date}<br />${parseFloat(d.revenue).toFixed(2)} · {d.orders} đơn
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Status badge
function OrderStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    COMPLETED: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Hoàn thành' },
    PAID: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Đã thanh toán' },
    DELIVERING: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Đang giao' },
    UNPAID: { color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Chờ TT' },
    CANCELLED: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Đã hủy' },
    DISPUTED: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Tranh chấp' },
  };
  const c = cfg[status] || { color: 'text-muted-foreground', bg: 'bg-muted', label: status };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.color} ${c.bg}`}>{c.label}</span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { value: 7,  label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
];

export default function SellerDashboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<SellerOverview | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders'>('overview');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, ordersRes] = await Promise.all([
        apiClient.get(`/api/seller/overview?days=${period}`),
        apiClient.get('/api/seller/orders?limit=8'),
      ]);
      setOverview(overviewRes.data.data);
      setRecentOrders(ordersRes.data.orders || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải dữ liệu bán hàng');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#f0b90b]/30 border-t-[#f0b90b] rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Đang tải dữ liệu...</p>
          </div>
        </div>
      </div>
    );
  }

  const rev   = overview?.revenue;
  const ords  = overview?.orders;
  const revs  = overview?.reviews;
  const daily = overview?.dailyRevenue || [];

  const periodRevChange = rev
    ? ((parseFloat(rev.period_revenue) / Math.max(parseFloat(rev.total_revenue) - parseFloat(rev.period_revenue), 0.01) - 1) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Ambient */}
      <div className="fixed top-0 right-0 w-[40%] h-[40%] bg-[#f0b90b]/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[30%] h-[30%] bg-blue-500/3 blur-[120px] rounded-full pointer-events-none" />

      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl relative z-10">

        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#f0b90b]" />
              </div>
              Seller Dashboard
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Xin chào, <span className="text-foreground font-semibold">{user?.name}</span>! Đây là tổng quan bán hàng của bạn.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period picker */}
            <div className="flex bg-muted rounded-xl p-1 border border-border">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    period === opt.value
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-card border border-border hover:border-border/70 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Doanh thu (kỳ)"
            value={`$${parseFloat(rev?.period_revenue || '0').toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            sub={`Tổng: $${parseFloat(rev?.total_revenue || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            color="#10b981"
            trend={{ value: periodRevChange, label: 'vs trước' }}
            delay={0}
          />
          <StatCard
            icon={<ShoppingBag className="w-5 h-5" />}
            label="Đơn hàng (kỳ)"
            value={ords?.period_orders || '0'}
            sub={`Hoàn thành: ${ords?.completed_period || 0}`}
            color="#3b82f6"
            delay={0.05}
          />
          <StatCard
            icon={<Star className="w-5 h-5" />}
            label="Đánh giá TB"
            value={`${parseFloat(revs?.avg_rating || '0').toFixed(1)}★`}
            sub={`${revs?.total_reviews || 0} đánh giá`}
            color="#f0b90b"
            delay={0.1}
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Khách hàng riêng"
            value={overview?.conversion?.unique_buyers || '0'}
            sub={`Hôm nay: $${parseFloat(rev?.today_revenue || '0').toFixed(2)}`}
            color="#a855f7"
            delay={0.15}
          />
        </div>

        {/* Revenue Chart + Order Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">Doanh thu theo ngày</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{period} ngày qua</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-[#f0b90b]" /> Doanh thu (USD)
              </div>
            </div>
            {daily.length > 0 ? (
              <>
                <MiniBarChart data={daily} />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground px-0.5">
                  {daily.length > 0 && <span>{new Date(daily[0]?.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>}
                  {daily.length > 0 && <span>{new Date(daily[daily.length - 1]?.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>}
                </div>
              </>
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                Chưa có dữ liệu trong kỳ này
              </div>
            )}
          </div>

          {/* Order Status Doughnut-like */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-bold text-foreground mb-5">Trạng thái đơn hàng</h2>
            <div className="space-y-3">
              {[
                { label: 'Hoàn thành', value: ords?.completed_period, color: '#10b981', icon: <CheckCircle className="w-4 h-4" /> },
                { label: 'Chờ thanh toán', value: ords?.pending_payment, color: '#f0b90b', icon: <Clock className="w-4 h-4" /> },
                { label: 'Đã hủy', value: ords?.cancelled, color: '#ef4444', icon: <XCircle className="w-4 h-4" /> },
                { label: 'Tranh chấp', value: ords?.disputed, color: '#dc2626', icon: <AlertTriangle className="w-4 h-4" /> },
              ].map(item => {
                const v = parseInt(item.value || '0');
                const total = parseInt(ords?.total_orders || '1');
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div style={{ color: item.color }}>{item.icon}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-bold text-foreground">{v} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: item.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Review rating breakdown */}
            <div className="mt-6 pt-5 border-t border-border">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-[#f0b90b] fill-[#f0b90b]" />
                Đánh giá từ khách hàng
              </h3>
              {[5, 4, 3, 2, 1].map(star => {
                const count = parseInt(revs?.[`star${star}` as keyof typeof revs] || '0');
                const total = parseInt(revs?.total_reviews || '1');
                const pct   = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-muted-foreground w-4">{star}★</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#f0b90b] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: (6 - star) * 0.05 }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-5 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Products Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl overflow-hidden mb-8"
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-[#f0b90b]" /> Top sản phẩm bán chạy
            </h2>
            <Link href="/seller/products" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Xem tất cả →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-semibold">#</th>
                  <th className="px-6 py-3 text-left font-semibold">Sản phẩm</th>
                  <th className="px-6 py-3 text-right font-semibold">Đơn</th>
                  <th className="px-6 py-3 text-right font-semibold">Doanh thu</th>
                  <th className="px-6 py-3 text-right font-semibold">Đánh giá</th>
                  <th className="px-6 py-3 text-right font-semibold">Tồn kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overview?.topProducts.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground text-sm">Chưa có dữ liệu sản phẩm</td></tr>
                ) : overview?.topProducts.map((p, i) => (
                  <motion.tr
                    key={p.product_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className={`font-black text-sm ${i === 0 ? 'text-[#f0b90b]' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-[#cd7f32]' : 'text-muted-foreground/50'}`}>
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/products/${p.product_id}`} className="flex items-center gap-3 group/link">
                        <span className="font-medium text-sm text-foreground truncate max-w-[200px] group-hover/link:text-[#f0b90b] transition-colors">
                          {p.name}
                        </span>
                      </Link>
                      <span className="text-xs text-muted-foreground">${parseFloat(p.base_price_usd).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-blue-400">{p.order_count}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-emerald-400">${parseFloat(p.revenue).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="flex items-center justify-end gap-1 text-[#f0b90b] font-bold text-sm">
                        ★ {parseFloat(p.rating).toFixed(1)}
                        <span className="text-muted-foreground font-normal">({p.review_count})</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold text-sm ${parseInt(p.stock) <= 0 ? 'text-red-400' : parseInt(p.stock) <= 5 ? 'text-orange-400' : 'text-foreground'}`}>
                        {p.stock ?? '–'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-400" /> Đơn hàng gần đây
            </h2>
            <Link href="/seller/orders" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Xem tất cả →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-semibold">Sản phẩm</th>
                  <th className="px-6 py-3 text-left font-semibold">Khách</th>
                  <th className="px-6 py-3 text-right font-semibold">Tổng tiền</th>
                  <th className="px-6 py-3 text-center font-semibold">Trạng thái</th>
                  <th className="px-6 py-3 text-right font-semibold">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-sm">Chưa có đơn hàng</td></tr>
                ) : recentOrders.map((order, i) => (
                  <motion.tr
                    key={order.order_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {order.product_image
                            ? <Image src={order.product_image} alt={order.product_name} width={40} height={40} className="object-cover" unoptimized />
                            : <Package className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/orders/${order.order_id}`} className="text-sm font-medium text-foreground hover:text-[#f0b90b] transition-colors truncate block max-w-[160px]">
                            {order.product_name}
                          </Link>
                          <span className="text-xs text-muted-foreground">x{order.quantity}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#f0b90b]/20 text-[#f0b90b] text-xs font-bold flex items-center justify-center uppercase">
                          {order.buyer_name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm text-foreground">{order.buyer_name || '–'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-emerald-400">${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('vi-VN')}
                    </td>
                  </motion.tr>
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
