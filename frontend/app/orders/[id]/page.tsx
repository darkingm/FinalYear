'use client';

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
import { Package, ArrowLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  product_metadata: { images?: string[]; category?: string };
  quantity: number;
  price_usd: number;
  status: string;
  payment_method: string | null;
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

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const isInternalId = UUID_REGEX.test(id);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated && id) fetchOrder();
  }, [isAuthenticated, authLoading, id]);

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
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/orders">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Đơn hàng
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Đơn hàng #{order.order_id}</h1>
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

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                {getStatusIcon(order.status)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {new Date(order.created_at).toLocaleString('vi-VN')}
              </p>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                {order.product_metadata?.images?.[0] ? (
                  <Image
                    src={order.product_metadata.images[0]}
                    alt={order.product_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Ảnh</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-lg mb-1">{order.product_name}</h2>
                <p className="text-sm text-gray-500">Số lượng: {order.quantity}</p>
                <p className="text-xl font-bold text-primary mt-1">${Number(order.price_usd).toFixed(2)} USD</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-gray-500">Người mua</dt>
              <dd>{order.buyer_name}</dd>
              <dt className="text-gray-500">Người bán</dt>
              <dd>{order.seller_name}</dd>
              <dt className="text-gray-500">Phương thức</dt>
              <dd>{order.payment_method || '—'}</dd>
            </dl>
          </div>

          {order.status === 'UNPAID' && (
            <Link href={`/checkout/${order.order_id}`}>
              <Button className="w-full">Tiếp tục thanh toán</Button>
            </Link>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
