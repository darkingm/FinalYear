'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  Package, Clock, CheckCircle, XCircle, Search, Truck,
  AlertTriangle, ShoppingBag, RefreshCw, ArrowRight, Filter,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Order {
  order_id: number;
  product_name: string;
  product_metadata?: { images?: string[] };
  quantity: number;
  price_usd: number;
  total_price_usd?: number;
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
  const imgSrc = order.product_metadata?.images?.[0];
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.UNPAID;
  const StatusIcon = cfg.icon;
  const price = Number(order.price_usd ?? order.total_price_usd ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link href={`/orders/${order.order_id}`}>
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer group">
          <div className="flex gap-4">
            {/* Image */}
            <div className="relative w-18 h-18 md:w-20 md:h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border"
              style={{ width: '76px', height: '76px' }}>
              {imgSrc && !imgError ? (
                <Image
                  src={imgSrc}
                  alt={order.product_name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-7 h-7 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors text-sm md:text-base">
                  {order.product_name}
                </h3>
                {/* Status badge */}
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${cfg.textColor} ${cfg.bgColor} ${cfg.borderColor}`}>
                  <StatusIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">{cfg.label}</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                <span className="font-mono">#{order.order_id}</span>
                <span>x{order.quantity}</span>
                <span>{new Date(order.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                {order.payment_method && (
                  <span className="text-primary/70">{order.payment_method}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-primary">
                  ${price.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground group-hover:text-primary flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100">
                  Xem chi tiết <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar for active orders */}
          {['PAID', 'ONCHAIN_CONFIRMED', 'DELIVERING'].includes(order.status) && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                {['Đặt hàng', 'Thanh toán', 'Đang giao', 'Hoàn thành'].map((step, i) => {
                  const stepMap: Record<string, number> = { PAID: 2, ONCHAIN_CONFIRMED: 2, DELIVERING: 3 };
                  const currentStep = stepMap[order.status] || 1;
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full h-0.5 rounded-full ${i < currentStep ? 'bg-primary' : 'bg-border'}`} />
                      {i === 0 && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{step}</span>}
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
      const res = await apiClient.get('/api/orders');
      setOrders(res.data.orders || []);
    } catch { toast.error('Không thể tải đơn hàng'); }
    finally { setLoading(false); }
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
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Header row */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Đơn hàng của tôi</h1>
              <p className="text-xs text-muted-foreground">{orders.length} đơn hàng</p>
            </div>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </motion.div>

        {/* Search + Filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-3 mb-6"
        >
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm hoặc mã đơn..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 text-sm text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${filter === tab.value
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
                  }`}
              >
                {tab.label}
                {statusCounts[tab.value] > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === tab.value ? 'bg-black/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                    {statusCounts[tab.value]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Loading skeletons */}
        {(loading || isLoading) ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-card border border-border rounded-2xl"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {filter !== 'all' || searchQuery ? 'Không tìm thấy đơn hàng' : 'Bạn chưa có đơn hàng nào'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {filter !== 'all' || searchQuery ? 'Thử thay đổi bộ lọc' : 'Hãy mua sắm ngay hôm nay!'}
            </p>
            {filter === 'all' && !searchQuery && (
              <Link href="/products">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm mx-auto hover:opacity-90 transition-opacity">
                  <ShoppingBag className="w-4 h-4" />
                  Khám phá sản phẩm
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
