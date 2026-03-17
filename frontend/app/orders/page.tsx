'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, Clock, CheckCircle, XCircle, Truck,
  AlertTriangle, ShoppingBag, RefreshCw, ArrowRight,
  Search, ShoppingCart, TrendingUp, Coins, Star,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

/* ─── Types ───────────────────────────────────────────────────── */
interface Order {
  order_id: number;
  internal_order_id?: string;
  product_name: string;
  product_metadata?: { images?: string[]; primaryImage?: string };
  primary_image?: string | null;
  quantity: number;
  price_usd: number;
  price_in_token?: number | null;
  token_symbol?: string | null;
  amount_token?: number | null;
  total_amount?: number;
  status: string;
  payment_method?: string;
  created_at: string;
}

/* ─── Config ──────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  icon: any;
  step: number;
}> = {
  UNPAID: { label: 'Chờ thanh toán', textColor: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', icon: Clock, step: 0 },
  TX_SUBMITTED: { label: 'Đang xác nhận', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: Clock, step: 1 },
  ONCHAIN_CONFIRMED: { label: 'Đã xác nhận', textColor: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', icon: CheckCircle, step: 2 },
  PAYMENT_VALIDATED: { label: 'Đã xác nhận', textColor: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', icon: CheckCircle, step: 2 },
  PAID: { label: 'Đã thanh toán', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: CheckCircle, step: 2 },
  PROCESSING: { label: 'Đang xử lý', textColor: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/30', icon: Package, step: 2 },
  DELIVERING: { label: 'Đang giao', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Truck, step: 3 },
  SHIPPED: { label: 'Đang giao', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Truck, step: 3 },
  DELIVERED: { label: 'Đã giao', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: CheckCircle, step: 4 },
  COMPLETED: { label: 'Hoàn thành', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: Star, step: 4 },
  DISPUTED: { label: 'Tranh chấp', textColor: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', icon: AlertTriangle, step: -1 },
  CANCELLED: { label: 'Đã hủy', textColor: 'text-gray-500', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', icon: XCircle, step: -1 },
  REFUNDED: { label: 'Hoàn tiền', textColor: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: XCircle, step: -1 },
};

const FILTERS = [
  { value: 'all', label: 'Tất cả', statuses: [] as string[] },
  { value: 'pending', label: 'Chờ TT', statuses: ['UNPAID', 'TX_SUBMITTED'] },
  { value: 'active', label: 'Đang xử lý', statuses: ['ONCHAIN_CONFIRMED', 'PAYMENT_VALIDATED', 'PAID', 'PROCESSING'] },
  { value: 'shipping', label: 'Đang giao', statuses: ['DELIVERING', 'SHIPPED'] },
  { value: 'done', label: 'Hoàn thành', statuses: ['DELIVERED', 'COMPLETED'] },
  { value: 'issue', label: 'Sự cố', statuses: ['CANCELLED', 'REFUNDED', 'DISPUTED'] },
];

const JOURNEY_STEPS = ['Đặt hàng', 'Thanh toán', 'Xác nhận', 'Giao hàng', 'Hoàn thành'];

/* ─── Journey Progress Bar ────────────────────────────────────── */
function JourneyBar({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  const currentStep = cfg?.step ?? 0;
  if (currentStep < 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-1">
        {JOURNEY_STEPS.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={label} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-full h-1.5 rounded-full transition-all ${done ? 'bg-[#8247e5]' : active ? 'bg-[#8247e5]/50' : 'bg-muted'}`} />
              {(done || active) && (
                <span className={`text-[9px] font-bold whitespace-nowrap hidden sm:block ${active ? 'text-[#8247e5]' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Order Card ──────────────────────────────────────────────── */
function OrderCard({ order, index }: { order: Order; index: number }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = order.primary_image
    || order.product_metadata?.primaryImage
    || order.product_metadata?.images?.[0]
    || null;

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.UNPAID;
  const StatusIcon = cfg.icon;

  const tokenAmount = order.amount_token
    ?? (order.price_in_token ? Number(order.price_in_token) * order.quantity : null);
  const priceIsToken = !!(tokenAmount && order.token_symbol);
  const priceLabel = priceIsToken
    ? `${Number(tokenAmount).toFixed(['ETH', 'WBTC', 'BTC'].includes(order.token_symbol!) ? 6 : 4)} ${order.token_symbol}`
    : `$${Number(order.price_usd ?? order.total_amount ?? 0).toFixed(2)}`;

  const orderId = order.internal_order_id || order.order_id;
  const showJourney = cfg.step >= 0 && cfg.step <= 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link href={`/orders/${orderId}`}>
        <div className="group bg-card border border-border rounded-2xl p-4 sm:p-5 hover:border-[#8247e5]/30 hover:shadow-lg hover:shadow-[#8247e5]/5 transition-all duration-300 cursor-pointer relative overflow-hidden">
          {/* Subtle gradient on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-[#8247e5]/3 via-transparent to-transparent pointer-events-none transition-opacity duration-500" />

          <div className="flex gap-4 relative">
            {/* Product image */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border">
              {imgSrc && !imgError ? (
                <Image
                  src={imgSrc}
                  alt={order.product_name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-2 group-hover:text-[#8247e5] transition-colors leading-snug">
                  {order.product_name}
                </h3>
                <span className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${cfg.textColor} ${cfg.bgColor} ${cfg.borderColor}`}>
                  <StatusIcon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">#{order.order_id}</span>
                <span>x{order.quantity}</span>
                <span>{new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
                {order.payment_method && (
                  <span className="text-[#f0b90b] font-semibold uppercase tracking-wide">
                    {order.payment_method}
                  </span>
                )}
              </div>

              {/* Bottom row: price + arrow */}
              <div className="flex items-end justify-between mt-2">
                <span className={`text-xl font-black font-mono ${priceIsToken ? 'text-[#f0b90b]' : 'text-[#8247e5]'}`}>
                  {priceLabel}
                </span>
                <span className="text-[#8247e5] opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-bold transition-all -translate-x-2 group-hover:translate-x-0">
                  Chi tiết <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>

          {/* Journey bar for in-progress orders */}
          {showJourney && cfg.step > 0 && <JourneyBar status={order.status} />}
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Stats Card ──────────────────────────────────────────────── */
function StatCard({ value, label, icon: Icon, color }: { value: string; label: string; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function OrdersPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) { router.push('/login'); return; }
    if (isAuthenticated) fetchOrders();
  }, [isAuthenticated, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/orders?limit=100');
      const data = res.data;
      setOrders(data.orders ?? data.data?.orders ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const tab = FILTERS.find(t => t.value === filter);
    return orders.filter(order => {
      if (tab && tab.statuses.length > 0 && !tab.statuses.includes(order.status)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return order.product_name.toLowerCase().includes(q) || order.order_id.toString().includes(q);
      }
      return true;
    });
  }, [orders, filter, searchQuery]);

  const counts = useMemo(() =>
    FILTERS.reduce<Record<string, number>>((acc, tab) => {
      acc[tab.value] = tab.value === 'all'
        ? orders.length
        : orders.filter(o => tab.statuses.includes(o.status)).length;
      return acc;
    }, {}),
    [orders]
  );

  // Summary stats
  const totalSpentUSD = orders.reduce((s, o) => s + Number(o.price_usd ?? o.total_amount ?? 0), 0);
  const completedCount = orders.filter(o => ['COMPLETED', 'DELIVERED'].includes(o.status)).length;
  const pendingCount = orders.filter(o => ['UNPAID', 'TX_SUBMITTED'].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Ambient glow blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-[#8247e5]/8 blur-[100px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-[#f0b90b]/6 blur-[100px] rounded-full pointer-events-none" />

      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl relative z-10">

        {/* ─── Page Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#8247e5]/10 border border-[#8247e5]/20 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-[#8247e5]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Đơn hàng của tôi</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? 'Đang tải...' : `${orders.length} đơn hàng tổng cộng`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/cart">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-[#8247e5]/30 text-sm font-semibold text-foreground transition-all hover:bg-muted">
                <ShoppingCart className="w-4 h-4 text-[#8247e5]" />
                Giỏ hàng
              </button>
            </Link>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-[#8247e5]/30 text-sm font-semibold text-foreground transition-all hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </motion.div>

        {/* ─── Stats Row ─── */}
        {!loading && orders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            <StatCard value={orders.length.toString()} label="Tổng đơn hàng" icon={Package} color="#8247e5" />
            <StatCard value={completedCount.toString()} label="Hoàn thành" icon={CheckCircle} color="#22c55e" />
            <StatCard value={pendingCount.toString()} label="Chờ thanh toán" icon={Clock} color="#f97316" />
            <StatCard value={`$${totalSpentUSD.toFixed(0)}`} label="Đã chi tiêu" icon={Coins} color="#f0b90b" />
          </motion.div>
        )}

        {/* ─── Search + Filters ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-card border border-border rounded-2xl p-4 mb-6 space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm hoặc mã đơn hàng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8247e5]/20 focus:border-[#8247e5]/40 transition-all"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filter === tab.value
                    ? 'bg-[#8247e5] text-white shadow-md shadow-purple-500/20'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
              >
                {tab.label}
                {counts[tab.value] > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${filter === tab.value ? 'bg-white/20' : 'bg-background'
                    }`}>
                    {counts[tab.value]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ─── Content ─── */}
        <AnimatePresence mode="wait">
          {(loading || isLoading) ? (
            <motion.div key="skeletons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </motion.div>
          ) : filteredOrders.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-card border border-border rounded-2xl"
            >
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-muted flex items-center justify-center">
                <Package className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-bold mb-2">
                {filter !== 'all' || searchQuery ? 'Không tìm thấy đơn hàng' : 'Bạn chưa có đơn hàng'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                {filter !== 'all' || searchQuery
                  ? 'Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                  : 'Khám phá sàn và bắt đầu mua sắm ngay hôm nay!'}
              </p>
              <div className="flex items-center gap-3 justify-center">
                {(filter !== 'all' || searchQuery) && (
                  <button
                    onClick={() => { setFilter('all'); setSearchQuery(''); }}
                    className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                )}
                <Link href="/products">
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-[#8247e5] hover:bg-[#723bc9] text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 transition-all">
                    <ShoppingBag className="w-4 h-4" />
                    Khám phá sản phẩm
                  </button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {filteredOrders.map((order, i) => (
                <OrderCard key={order.order_id} order={order} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </main>
      <Footer />
    </div>
  );
}
