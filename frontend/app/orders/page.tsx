'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Package, Clock, CheckCircle, XCircle, Search, Truck,
  AlertTriangle, ShoppingBag, RefreshCw, ArrowRight, Filter,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Order {
  order_id: number;
  internal_order_id?: string;
  order_number?: string;
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

const STATUS_CONFIG: Record<string, { label: string; textColor: string; bgColor: string; borderColor: string; icon: any }> = {
  UNPAID: { label: 'Chờ thanh toán', textColor: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', icon: Clock },
  TX_SUBMITTED: { label: 'Đang xác nhận', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: Clock },
  ONCHAIN_CONFIRMED: { label: 'Đã xác nhận', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: CheckCircle },
  PAID: { label: 'Đã thanh toán', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: CheckCircle },
  DELIVERING: { label: 'Đang giao', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Truck },
  COMPLETED: { label: 'Hoàn thành', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: CheckCircle },
  DISPUTED: { label: 'Tranh chấp', textColor: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', icon: AlertTriangle },
  CANCELLED: { label: 'Đã hủy', textColor: 'text-gray-500', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', icon: XCircle },
  REFUNDED: { label: 'Hoàn tiền', textColor: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: XCircle },
};

const FILTER_TABS = [
  { value: 'all', label: 'Tất cả', statuses: [] },
  { value: 'pending', label: 'Chờ xử lý', statuses: ['UNPAID', 'TX_SUBMITTED', 'ONCHAIN_PENDING'] },
  { value: 'active', label: 'Đang xử lý', statuses: ['ONCHAIN_CONFIRMED', 'PAYMENT_VALIDATED', 'PAID', 'PROCESSING'] },
  { value: 'shipping', label: 'Đang giao', statuses: ['DELIVERING', 'SHIPPED'] },
  { value: 'done', label: 'Hoàn thành', statuses: ['DELIVERED', 'COMPLETED'] },
  { value: 'issue', label: 'Vấn đề', statuses: ['CANCELLED', 'REFUNDED', 'DISPUTED'] },
];

function OrderCard({ order, index }: { order: Order; index: number }) {
  const [imgError, setImgError] = useState(false);
  // Image: prefer direct primary_image → metadata.images[0] → null
  const imgSrc = order.primary_image
    || order.product_metadata?.primaryImage
    || order.product_metadata?.images?.[0]
    || null;
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.UNPAID;
  const StatusIcon = cfg.icon;

  // Price display: prefer token amount if available
  const tokenAmount = order.amount_token ?? (order.price_in_token ? Number(order.price_in_token) * order.quantity : null);
  const priceLabel = tokenAmount && order.token_symbol
    ? `${Number(tokenAmount).toFixed(['ETH','WBTC','BTC'].includes(order.token_symbol) ? 6 : 4)} ${order.token_symbol}`
    : `$${Number(order.price_usd ?? order.total_amount ?? 0).toFixed(2)}`;
  const priceIsToken = !!(tokenAmount && order.token_symbol);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link href={`/orders/${order.internal_order_id || order.order_id}`}>
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group backdrop-blur-md relative overflow-hidden">
          {/* Subtle hover glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:via-blue-500/5 transition-all duration-700 pointer-events-none" />

          <div className="flex flex-col sm:flex-row gap-5 relative z-10">
            {/* Image */}
            <div className="relative w-full sm:w-24 h-40 sm:h-24 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
              {imgSrc && !imgError ? (
                <Image
                  src={imgSrc}
                  alt={order.product_name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent sm:hidden pointer-events-none" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-bold text-white line-clamp-2 sm:line-clamp-1 group-hover:text-blue-400 transition-colors text-base">
                  {order.product_name}
                </h3>
                {/* Status badge */}
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 ${cfg.textColor} ${cfg.bgColor.replace('500/10', '500/20')} ${cfg.borderColor}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-4 sm:mb-0">
                <span className="font-mono bg-black/30 px-2 py-0.5 rounded text-gray-400">Order #{order.order_id}</span>
                <span className="flex items-center gap-1"><Package className="w-3 h-3" /> x{order.quantity}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
                {order.payment_method && (
                  <span className="flex items-center gap-1 text-[#f0b90b] font-medium uppercase tracking-wider">
                    {order.payment_method}
                  </span>
                )}
              </div>

              <div className="flex items-end justify-between mt-auto">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold font-mono ${priceIsToken ? 'text-[#f0b90b]' : 'text-emerald-400'}`}>
                    {priceLabel}
                  </span>
                  {!priceIsToken && <span className="text-xs text-gray-500 font-medium">USD</span>}
                </div>
                <span className="text-xs font-bold text-blue-400 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all translate-x-2 group-hover:translate-x-0">
                  Chi tiết <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar for active orders */}
          {['PAID', 'ONCHAIN_CONFIRMED', 'DELIVERING'].includes(order.status) && (
            <div className="mt-5 pt-4 border-t border-white/5 relative z-10">
              <div className="flex items-center gap-2">
                {['Đặt hàng', 'Thanh toán', 'Đang giao', 'Hoàn thành'].map((step, i) => {
                  const stepMap: Record<string, number> = { PAID: 2, ONCHAIN_CONFIRMED: 2, DELIVERING: 3 };
                  const currentStep = stepMap[order.status] || 1;
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center gap-2">
                      <div className={`w-full h-1 rounded-full transition-colors ${i < currentStep ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-white/10'}`} />
                      {i === currentStep - 1 && <span className="text-[10px] text-blue-400 font-bold whitespace-nowrap uppercase tracking-wider">{step}</span>}
                      {i !== currentStep - 1 && <span className="text-[10px] text-gray-600 font-medium whitespace-nowrap hidden sm:block">{step}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

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
  }, [isAuthenticated, isLoading]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/orders?limit=50');
      // Support both response shapes: { orders: [] } and { data: { orders: [] } }
      const data = res.data;
      setOrders(data.orders ?? data.data?.orders ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải đơn hàng');
    } finally { setLoading(false); }
  };

  const filteredOrders = orders.filter(order => {
    const tab = FILTER_TABS.find(t => t.value === filter);
    if (tab && tab.statuses.length > 0 && !tab.statuses.includes(order.status)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return order.product_name.toLowerCase().includes(q) || order.order_id.toString().includes(q);
    }
    return true;
  });

  const statusCounts = FILTER_TABS.reduce<Record<string, number>>((acc, tab) => {
    if (tab.value === 'all') { acc[tab.value] = orders.length; return acc; }
    acc[tab.value] = orders.filter(o => tab.statuses.includes(o.status)).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden selection:bg-blue-500 selection:text-white pb-20">
      {/* Ambient Backgrounds */}
      <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#f0b90b]/5 blur-[120px] rounded-full pointer-events-none" />

      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl relative z-10">
        {/* Header row */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Đơn hàng của tôi</h1>
              <p className="text-sm text-gray-400 mt-1">{orders.length} đơn hàng trong lịch sử</p>
            </div>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all text-sm font-medium w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </motion.div>

        {/* Search + Filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 mb-8 backdrop-blur-xl"
        >
          {/* Search bar */}
          <div className="relative mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm hoặc mã đơn hàng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-black/20 border border-white/5 rounded-2xl focus:outline-none focus:border-blue-500/50 focus:bg-black/40 text-sm text-white placeholder:text-gray-600 transition-all font-medium"
            />
          </div>

          {/* Filter tabs — Radix Tabs */}
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-full bg-black/20 border border-white/5 h-auto p-1 gap-1 flex overflow-x-auto justify-start">
              {FILTER_TABS.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-bold whitespace-nowrap data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(59,130,246,0.35)] text-gray-400"
                >
                  {tab.label}
                  {statusCounts[tab.value] > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/30 data-[state=active]:bg-white/20">
                      {statusCounts[tab.value]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Loading skeletons */}
        {(loading || isLoading) ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-3xl bg-white/5" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-md"
          >
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
              <Package className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {filter !== 'all' || searchQuery ? 'Không tìm thấy đơn hàng' : 'Bạn chưa có đơn hàng nào'}
            </h3>
            <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
              {filter !== 'all' || searchQuery 
                ? 'Không có đơn hàng nào phù hợp với bộ lọc hiện tại của bạn. Thử thay đổi để xem thêm.' 
                : 'Khám phá hàng ngàn sản phẩm đa dạng trên sàn của chúng tôi và bắt đầu mua sắm ngay hôm nay.'}
            </p>
            {filter === 'all' && !searchQuery && (
              <Link href="/products">
                <button className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 border-none text-white rounded-xl font-bold text-sm mx-auto transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:-translate-y-0.5">
                  <ShoppingBag className="w-5 h-5" />
                  Khám phá gian hàng
                </button>
              </Link>
            )}
          </motion.div>
        ) : (
          /* Order list */
          <div className="space-y-3">
            {filteredOrders.map((order, i) => (
              <OrderCard key={order.order_id} order={order} index={i} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
