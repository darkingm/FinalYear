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
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import { TokenAmountInline, UsdtAmountInline } from '@/components/checkout/CheckoutPriceValue';
import { formatUSD } from '@/lib/utils/format-price';
import { getOrderPricingDisplay, resolveOrderProductImage } from '@/lib/orders/presentation';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';

/* ─── Types ───────────────────────────────────────────────────── */
interface Order {
  order_id: number;
  internal_order_id?: string;
  product_name: string;
  product_metadata?: { images?: string[]; primaryImage?: string };
  primary_image?: string | null;
  quantity: number;
  price_usd: number;
  token_symbol?: string | null;
  amount_token?: number | null;
  total_amount?: number;
  status: string;
  payment_method?: string;
  created_at: string;
}

/* ─── Config ──────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, {
  labelKey: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  icon: any;
  step: number;
}> = {
  UNPAID: { labelKey: 'orders.statusUnpaid', textColor: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', icon: Clock, step: 0 },
  TX_SUBMITTED: { labelKey: 'orders.statusTxSubmitted', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: Clock, step: 1 },
  ONCHAIN_PENDING: { labelKey: 'orders.statusTxSubmitted', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: Clock, step: 1 },
  ONCHAIN_CONFIRMED: { labelKey: 'orders.statusOnchainConfirmed', textColor: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', icon: CheckCircle, step: 2 },
  PAYMENT_VALIDATED: { labelKey: 'orders.statusPaymentValidated', textColor: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', icon: CheckCircle, step: 2 },
  PAID: { labelKey: 'orders.statusPaid', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: CheckCircle, step: 2 },
  PAID_PAYPAL: { labelKey: 'orders.statusPaid', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: CheckCircle, step: 2 },
  PROCESSING: { labelKey: 'orders.statusProcessing', textColor: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/30', icon: Package, step: 2 },
  DELIVERING: { labelKey: 'orders.statusDelivering', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Truck, step: 3 },
  SHIPPED: { labelKey: 'orders.statusShipped', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Truck, step: 3 },
  DELIVERED: { labelKey: 'orders.statusDelivered', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: CheckCircle, step: 4 },
  COMPLETED: { labelKey: 'orders.statusCompleted', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: Star, step: 4 },
  TX_FAILED: { labelKey: 'orders.statusCancelled', textColor: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', icon: XCircle, step: -1 },
  DISPUTED: { labelKey: 'orders.statusDisputed', textColor: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', icon: AlertTriangle, step: -1 },
  CANCELLED: { labelKey: 'orders.statusCancelled', textColor: 'text-gray-500', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', icon: XCircle, step: -1 },
  REFUNDED: { labelKey: 'orders.statusRefunded', textColor: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: XCircle, step: -1 },
};

const FILTERS = [
  { value: 'all', labelKey: 'orders.filterAll', statuses: [] as string[] },
  { value: 'pending', labelKey: 'orders.filterPending', statuses: ['UNPAID', 'TX_SUBMITTED', 'ONCHAIN_PENDING'] },
  { value: 'active', labelKey: 'orders.filterActive', statuses: ['ONCHAIN_CONFIRMED', 'PAYMENT_VALIDATED', 'PAID', 'PAID_PAYPAL', 'PROCESSING', 'SHIPPED'] },
  { value: 'shipping', labelKey: 'orders.filterShipping', statuses: ['DELIVERING', 'SHIPPED'] },
  { value: 'done', labelKey: 'orders.filterDone', statuses: ['DELIVERED', 'COMPLETED'] },
  { value: 'issue', labelKey: 'orders.filterIssue', statuses: ['CANCELLED', 'REFUNDED', 'DISPUTED', 'TX_FAILED'] },
];

const JOURNEY_KEYS = ['orders.journeyOrder', 'orders.journeyPayment', 'orders.journeyConfirm', 'orders.journeyShipping', 'orders.journeyComplete'];

/* ─── Journey Progress Bar ────────────────────────────────────── */
function JourneyBar({ status }: { status: string }) {
  const { t } = useClientTranslation();
  const cfg = STATUS_CONFIG[status];
  const currentStep = cfg?.step ?? 0;
  if (currentStep < 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-1">
        {JOURNEY_KEYS.map((key, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={key} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-full h-1.5 rounded-full transition-all ${done ? 'bg-[#8247e5]' : active ? 'bg-[#8247e5]/50' : 'bg-muted'}`} />
              {(done || active) && (
                <span className={`text-[9px] font-bold whitespace-nowrap hidden sm:block ${active ? 'text-[#8247e5]' : 'text-muted-foreground'}`}>
                  {t(key)}
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
  const { t } = useClientTranslation();
  const imgSrc = resolveOrderProductImage(order);

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.UNPAID;
  const StatusIcon = cfg.icon;
  const pricingDisplay = getOrderPricingDisplay({
    token_symbol: order.token_symbol,
    subtotal_token: order.amount_token,
    amount_token: order.amount_token,
    price_usd: order.price_usd ?? 0,
    total_amount: order.total_amount ?? null,
    primary_image: order.primary_image,
    product_metadata: order.product_metadata,
  });

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
                  {t(cfg.labelKey)}
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
                {pricingDisplay.mode === 'token' && pricingDisplay.tokenSymbol && pricingDisplay.tokenAmountLabel ? (
                  <div className="flex flex-col gap-1">
                    <TokenAmountInline
                      amount={pricingDisplay.tokenAmountLabel}
                      symbol={pricingDisplay.tokenSymbol}
                      size="lg"
                      className="text-[#f0b90b]"
                      amountClassName="text-[#f0b90b]"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>≈</span>
                      <UsdtAmountInline amount={pricingDisplay.usdAmount} size="sm" />
                    </div>
                  </div>
                ) : (
                  <UsdtAmountInline
                    amount={pricingDisplay.usdAmount}
                    size="lg"
                    className="text-[#8247e5]"
                    amountClassName="text-[#8247e5]"
                  />
                )}
                <span className="text-[#8247e5] opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-bold transition-all -translate-x-2 group-hover:translate-x-0">
                  {t('orders.details')} <ArrowRight className="w-3.5 h-3.5" />
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
  const { isAuthenticated, isLoading, reauthRequired } = useAuth();
  const router = useRouter();
  const { t } = useClientTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildLoginRedirectUrl('/orders', reauthRequired ? 'reauth_required' : undefined));
      return;
    }
    if (isAuthenticated) fetchOrders();
  }, [isAuthenticated, isLoading, reauthRequired, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/orders?limit=100');
      const data = res.data;
      setOrders(data.orders ?? data.data?.orders ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('orders.loadError'));
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
  const totalSpentUSD = orders.reduce((s, o) => s + Number(o.total_amount ?? o.price_usd ?? 0), 0);
  const completedCount = orders.filter(o => ['COMPLETED', 'DELIVERED'].includes(o.status)).length;
  const pendingCount = orders.filter(o => ['UNPAID', 'TX_SUBMITTED', 'ONCHAIN_PENDING'].includes(o.status)).length;

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
              <h1 className="text-2xl font-black text-foreground">{t('orders.title')}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? t('orders.loading') : t('orders.totalOrders', { count: orders.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/cart">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-[#8247e5]/30 text-sm font-semibold text-foreground transition-all hover:bg-muted">
                <ShoppingCart className="w-4 h-4 text-[#8247e5]" />
                {t('orders.cart')}
              </button>
            </Link>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-[#8247e5]/30 text-sm font-semibold text-foreground transition-all hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('orders.refresh')}
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
            <StatCard value={orders.length.toString()} label={t('orders.totalOrdersStat')} icon={Package} color="#8247e5" />
            <StatCard value={completedCount.toString()} label={t('orders.completedStat')} icon={CheckCircle} color="#22c55e" />
            <StatCard value={pendingCount.toString()} label={t('orders.pendingStat')} icon={Clock} color="#f97316" />
            <StatCard value={formatUSD(totalSpentUSD)} label={t('orders.totalSpentStat')} icon={Coins} color="#f0b90b" />
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
              placeholder={t('orders.searchPlaceholder')}
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
                {t(tab.labelKey)}
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
                {filter !== 'all' || searchQuery ? t('orders.noOrdersTitle') : t('orders.noOrdersEmpty')}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                {filter !== 'all' || searchQuery
                  ? t('orders.noOrdersDesc')
                  : t('orders.noOrdersEmptyDesc')}
              </p>
              <div className="flex items-center gap-3 justify-center">
                {(filter !== 'all' || searchQuery) && (
                  <button
                    onClick={() => { setFilter('all'); setSearchQuery(''); }}
                    className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
                  >
                    {t('orders.clearFilters')}
                  </button>
                )}
                <Link href="/products">
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-[#8247e5] hover:bg-[#723bc9] text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 transition-all">
                    <ShoppingBag className="w-4 h-4" />
                    {t('orders.exploreProducts')}
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
