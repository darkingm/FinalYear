'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient, paymentClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { Package, ArrowLeft, CheckCircle, XCircle, Loader2, Truck, Check, AlertTriangle, Star } from 'lucide-react';
import { OrderStepper, OrderStatus, OrderStatusIndicator } from '@/components/order/OrderStepper';
import { NFTOwnershipCard } from '@/components/web3/NFTOwnershipCard';

interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  product_metadata: { images?: string[]; category?: string };
  quantity: number;
  price_usd: number;
  pricing_mode?: string;
  subtotal_token?: number;
  status: OrderStatus;
  payment_method: string | null;
  buyer_id: number;
  seller_id: number;
  buyer_name: string;
  seller_name: string;
  created_at: string;
  paypal_order_id?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const success = searchParams.get('success') === 'true';
  const cancelled = searchParams.get('cancelled') === 'true';

  const { isAuthenticated, isLoading: authLoading, session } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isInternalId = UUID_REGEX.test(id);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated && id) fetchOrder();
  }, [isAuthenticated, authLoading, id]);

  // Auto poll order status if waiting for blockchain confirmation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (order?.status === 'TX_SUBMITTED') {
      interval = setInterval(() => {
        fetchOrder();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [order?.status, id]);

  useEffect(() => {
    if (!order || !success || !order.paypal_order_id || capturing) return;
    capturePayPal();
  }, [order, success]);

  const fetchOrder = async () => {
    try {
      if (isInternalId) {
        const res = await apiClient.get(`/api/orders/internal/${id}`);
        setOrder(res.data.order);
      } else {
        const res = await apiClient.get(`/api/orders/${id}`);
        setOrder(res.data.order);
      }
    } catch (e: any) {
      if (e.response?.status === 404) {
        toast.error('Không tìm thấy đơn hàng');
        router.push('/orders');
      } else {
        toast.error(e.response?.data?.message || 'Tải đơn hàng thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const capturePayPal = async () => {
    if (!order?.paypal_order_id) return;
    setCapturing(true);
    try {
      await paymentClient.post('/api/payments/paypal/capture', {
        paypal_order_id: order.paypal_order_id,
      });
      toast.success('Thanh toán PayPal đã hoàn tất');
      setOrder((prev) => prev ? { ...prev, status: 'PAID' } : null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', `/orders/${order.order_id}`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xác nhận PayPal thất bại');
    } finally {
      setCapturing(false);
    }
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/orders/${order?.order_id}/status`, { status: newStatus });
      toast.success('Cập nhật trạng thái thành công!');
      fetchOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const isBuyer = session?.user?.id === String(order?.buyer_id);
  const isSeller = session?.user?.id === String(order?.seller_id);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'COMPLETED':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'CANCELLED':
      case 'REFUNDED':
      case 'TX_FAILED':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Package className="w-6 h-6 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'COMPLETED':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'CANCELLED':
      case 'REFUNDED':
      case 'TX_FAILED':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">Không tìm thấy đơn hàng</p>
            <Link href="/orders">
              <Button>Về danh sách đơn hàng</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden selection:bg-[#f0b90b] selection:text-black text-foreground">
      {/* Ambient Backgrounds */}
      <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#f0b90b]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Header />
      <main className="flex-1 py-12 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header Action */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/orders">
              <button className="p-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all hover:-translate-x-1 group">
                <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Chi tiết đơn hàng</h1>
              <p className="text-gray-500 font-mono text-sm mt-1">Order #{order.order_id}</p>
            </div>
          </div>

          {success && order.status === 'TX_SUBMITTED' && order.paypal_order_id && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-3">
              {capturing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang xác nhận thanh toán PayPal...</span>
                </>
              ) : (
                <span>Bạn đã quay lại từ PayPal. Thanh toán sẽ được xác nhận tự động.</span>
              )}
            </div>
          )}

          {cancelled && (
            <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              Bạn đã hủy thanh toán PayPal. Đơn hàng vẫn chờ thanh toán.
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 mb-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-white/5 pb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${getStatusColor(order.status).replace('text-', 'bg-').replace('bg-', 'bg-opacity-20 bg-')}`}>
                  {getStatusIcon(order.status)}
                </div>
                <div>
                  <span className={`text-lg font-bold uppercase tracking-wider ${getStatusColor(order.status).split(' ')[0]}`}>
                    {order.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    Cập nhật: {new Date(order.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 group">
                {order.product_metadata?.images?.[0] ? (
                  <Image
                    src={order.product_metadata.images[0]}
                    alt={order.product_name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h2 className="font-bold text-xl text-white mb-2 leading-tight">{order.product_name}</h2>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 w-fit mb-3">
                  <span className="text-xs text-gray-400">Số lượng:</span>
                  <span className="text-sm font-bold text-white">x{order.quantity}</span>
                </div>
                
                {order.pricing_mode === 'usd' || !order.pricing_mode ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold font-mono text-emerald-400">\${Number(order.price_usd).toFixed(2)}</span>
                    <span className="text-sm text-gray-500 font-medium tracking-wide">USD</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold font-mono text-[#f0b90b]">{Number(order.subtotal_token).toFixed(4)}</span>
                      <span className="text-sm text-gray-500 font-medium tracking-wide">Token</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">~ \${Number(order.price_usd).toFixed(2)} USD</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 bg-black/20 rounded-2xl border border-white/5 mb-8">
              <OrderStepper currentStatus={order.status} className="py-2" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <dt className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  Người mua {isBuyer && <span className="text-blue-400 normal-case font-medium tracking-normal">(Bạn)</span>}
                </dt>
                <dd className="font-medium text-sm text-gray-200 truncate">{order.buyer_name}</dd>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <dt className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  Trợ lý / Bán {isSeller && <span className="text-emerald-400 normal-case font-medium tracking-normal">(Bạn)</span>}
                </dt>
                <dd className="font-medium text-sm text-gray-200 truncate">{order.seller_name}</dd>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <dt className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5">Phương thức</dt>
                <dd className="font-medium text-sm text-gray-200 uppercase flex items-center gap-1.5">
                  {order.payment_method === 'crypto' ? (
                    <><span className="w-2 h-2 rounded-full bg-[#f0b90b]" /> Crypto Web3</>
                  ) : order.payment_method === 'paypal' ? (
                    <><span className="w-2 h-2 rounded-full bg-blue-500" /> PayPal</>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <dt className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5">Mã Invoice</dt>
                <dd className="font-mono text-xs text-gray-400 bg-black/30 px-2 py-1 rounded inline-block">
                  {order.internal_order_id.split('-')[0].toUpperCase()}
                </dd>
              </div>
            </div>
          </div>

          {order.status === 'UNPAID' && isBuyer && (
            <Link href={`/checkout/${order.order_id}`}>
              <button className="w-full relative overflow-hidden group py-4 bg-gradient-to-r from-[#f0b90b] to-[#f3ba2f] text-black font-bold rounded-2xl text-base transition-all shadow-[0_4px_20px_rgba(240,185,11,0.2)] hover:shadow-[0_4px_30px_rgba(240,185,11,0.35)] hover:-translate-y-0.5">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10 block text-center">Tiếp tục thanh toán an toàn &rarr;</span>
              </button>
            </Link>
          )}

          {/* Action Buttons for Seller */}
          {isSeller && (order.status === 'PAID' || order.status === 'ONCHAIN_CONFIRMED') && (
            <div className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-3xl shadow-lg shadow-blue-500/5 mb-6 border border-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2 text-blue-400 flex items-center gap-2">
                  <Package className="w-5 h-5" /> Thao tác dành cho người bán
                </h3>
                <p className="text-sm text-blue-200/70 mb-5">Người mua đã thanh toán. Vui lòng đóng gói và giao hàng qua các đơn vị vận chuyển hỗ trợ.</p>
                <button
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={() => handleUpdateStatus('SHIPPED')}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
                  Xác nhận Đã Giao Hàng
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons for Buyer */}
          {isBuyer && order.status === 'SHIPPED' && (
            <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-3xl shadow-lg shadow-emerald-500/5 mb-6 border border-emerald-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2 text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Xác nhận nhận hàng
                </h3>
                <p className="text-sm text-emerald-200/70 mb-5 leading-relaxed">
                  Bạn đã nhận được sản phẩm và hoàn toàn hài lòng với chất lượng? 
                  Xác nhận ngay để hợp đồng thông minh tự động giải ngân cho người bán.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    className="flex-1 py-3.5 px-4 bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    onClick={() => handleUpdateStatus('DISPUTED')}
                    disabled={actionLoading}
                  >
                    <AlertTriangle className="w-4 h-4" /> Báo cáo / Yêu cầu hoàn tiền
                  </button>
                  <button
                    className="flex-1 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70"
                    onClick={() => handleUpdateStatus('COMPLETED')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    Đã Nhận Hàng Tốt
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* NFT Ownership for this product */}
          <NFTOwnershipCard
            productId={order.product_id}
            productName={order.product_name}
            variant="compact"
            className="mt-6"
          />

          {/* Review CTA for completed buyer orders */}
          {isBuyer && order.status === 'COMPLETED' && (
            <Link href={`/products/${order.product_id}#reviews`}>
              <div className="mt-4 p-5 bg-gradient-to-r from-[#f0b90b]/10 to-transparent border border-[#f0b90b]/20 rounded-2xl flex items-center justify-between group hover:border-[#f0b90b]/40 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/20 flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-[#f0b90b]" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">Đánh giá sản phẩm này</p>
                    <p className="text-xs text-muted-foreground">Chia sẻ trải nghiệm · Nhận +3 Credit Score nếu đánh giá 5★</p>
                  </div>
                </div>
                <ArrowLeft className="w-5 h-5 text-[#f0b90b] rotate-180 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </div>
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
