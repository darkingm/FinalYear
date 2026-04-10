'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient, paymentClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import {
  Package, ArrowLeft, CheckCircle, XCircle, Loader2, Truck, Check,
  AlertTriangle, Star, Shield, ExternalLink, Upload, ImagePlus, X,
  Info, Clock, FileText
} from 'lucide-react';
import { OrderStepper, OrderStatus, OrderStatusIndicator } from '@/components/order/OrderStepper';
import { NFTOwnershipCard } from '@/components/web3/NFTOwnershipCard';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi, keccak256, toBytes } from 'viem';
import { CHAIN_META } from '@/lib/web3/config';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import { formatUSD, formatCrypto, calcPlatformFee, PLATFORM_FEE_LABEL } from '@/lib/utils/format-price';

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
  tx_hash?: string;
  tracking_number?: string;
  chain_id?: number;
  escrow_contract?: string;
  amount_token?: number;
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
  const [trackingInput, setTrackingInput] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeImages, setDisputeImages] = useState<string[]>([]); // Cloudinary URLs
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useClientTranslation();

  // Wagmi for on-chain buyerConfirmDelivery
  const { isConnected } = useAccount();
  const CONFIRM_ABI = parseAbi(['function buyerConfirmDelivery(bytes32 orderId) external']);
  const { writeContract, data: confirmTxData, isPending: confirmPending } = useWriteContract();
  const { isLoading: confirmWaiting, isSuccess: confirmSuccess } = useWaitForTransactionReceipt({ hash: confirmTxData });

  // After on-chain confirm, update backend
  useEffect(() => {
    if (!confirmSuccess || !order) return;
    // Use PATCH /:id/status — state machine now allows PAID/ONCHAIN_CONFIRMED → COMPLETED
    apiClient.patch(`/api/orders/${order.order_id}/status`, { status: 'COMPLETED' })
      .then(() => {
        toast.success(t('orderDetail.confirmSuccess'));
        fetchOrder();
      })
      .catch((e: any) => {
        const msg = e.response?.data?.message || 'Backend error';
        toast.error(t('orderDetail.updateFailed', { msg }));
        // Don't panic — on-chain tx succeeded, admin can manually release
        toast.info(t('orderDetail.onchainSuccessAdmin'), { duration: 8000 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmSuccess]);

  const isInternalId = UUID_REGEX.test(id);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated && id) fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, id]);

  // Auto poll order status while waiting for blockchain confirmation
  useEffect(() => {
    const pollingStatuses = ['TX_SUBMITTED', 'ONCHAIN_CONFIRMED'];
    const terminalStatuses = ['PAID', 'CANCELLED', 'TX_FAILED', 'REFUNDED', 'COMPLETED', 'SHIPPED', 'DELIVERED', 'DISPUTED'];

    if (!order?.status || terminalStatuses.includes(order.status)) return;
    if (!pollingStatuses.includes(order.status)) return;

    const interval = setInterval(() => {
      fetchOrder();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, id]);

  useEffect(() => {
    if (!order || !success || !order.paypal_order_id || capturing) return;
    if (order.status === 'PAID' || order.status === 'COMPLETED') return; // already done
    capturePayPal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        toast.error(t('orderDetail.orderNotFound'));
        router.push('/orders');
      } else {
        toast.error(e.response?.data?.message || t('orderDetail.loadOrderFailed'));
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
      toast.success(t('orderDetail.paypalComplete'));
      setOrder((prev) => prev ? { ...prev, status: 'PAID' } : null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', `/orders/${order.order_id}`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('orderDetail.paypalCaptureFailed'));
    } finally {
      setCapturing(false);
    }
  };

  const handleUpdateStatus = async (newStatus: OrderStatus, extra?: Record<string, string>) => {
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/orders/${order?.order_id}/status`, { status: newStatus, ...extra });
      toast.success(t('orderDetail.statusSuccess'));
      fetchOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('orderDetail.statusUpdateFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  // On-chain buyer confirm delivery
  const handleOnChainConfirm = () => {
    if (!order?.escrow_contract || !order?.chain_id) {
      // Fallback: backend-only for non-crypto orders (PayPal, etc.)
      handleUpdateStatus('COMPLETED');
      return;
    }
    if (!isConnected) {
      toast.error(t('orderDetail.connectWalletFirst'));
      return;
    }
    // IMPORTANT: orderId32 must match exactly what the backend/contract uses:
    // ethers.keccak256(ethers.toUtf8Bytes(internal_order_id))
    // toBytes() from viem encodes as UTF-8, matching ethers.toUtf8Bytes()
    const orderId32 = keccak256(toBytes(order.internal_order_id));
    writeContract({
      address: order.escrow_contract as `0x${string}`,
      abi: CONFIRM_ABI,
      functionName: 'buyerConfirmDelivery',
      args: [orderId32],
      chainId: order.chain_id as any,
    });
  };

  // Upload evidence image to Cloudinary
  const uploadEvidenceImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'marketplace_evidence'); // unsigned preset
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'deyjlti3v';
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.secure_url) throw new Error(data.error?.message || 'Upload thất bại');
      setDisputeImages(prev => [...prev, data.secure_url]);
      toast.success(t('orderDetail.uploadSuccess'));
    } catch (e: any) {
      toast.error(e.message || t('orderDetail.uploadFailed'));
    } finally {
      setUploadingImg(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) { toast.error(t('orderDetail.disputeReasonRequired')); return; }
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/orders/${order?.order_id}/status`, {
        status: 'DISPUTED',
        reason: disputeReason,
        evidence_urls: disputeImages,   // ← gửi URLs ảnh bằng chứng
      });
      toast.success(t('orderDetail.disputeSubmitted'));
      setShowDisputeForm(false);
      setDisputeReason('');
      setDisputeImages([]);
      fetchOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('orderDetail.disputeSubmitFailed'));
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
      case 'ONCHAIN_CONFIRMED':
        return <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />;
      case 'TX_SUBMITTED':
        return <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />;
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
      case 'ONCHAIN_CONFIRMED':
        return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200';
      case 'TX_SUBMITTED':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
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
        <div className="min-h-screen bg-background py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{t('orderDetail.orderNotFound')}</p>
            <Link href="/orders">
              <Button>{t('orderDetail.backToOrders')}</Button>
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

          {/* ONCHAIN_CONFIRMED = escrow releasing funds */}
          {order.status === 'ONCHAIN_CONFIRMED' && (
            <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-300 text-sm">Đang giải ngân từ escrow...</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Thanh toán đã xác nhận on-chain. Hệ thống đang chuyển tiền cho người bán.</p>
              </div>
            </div>
          )}

          {/* TX_FAILED banner */}
          {order.status === 'TX_FAILED' && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-300 text-sm">{t('orderDetail.txFailedTitle')}</p>
                <p className="text-xs text-red-400/70 mt-0.5">{t('orderDetail.txFailedDesc')}</p>
              </div>
            </div>
          )}

          {success && order.status === 'TX_SUBMITTED' && order.paypal_order_id && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-3">
              {capturing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('orderDetail.paypalConfirming')}</span>
                </>
              ) : (
                <span>{t('orderDetail.paypalReturned')}</span>
              )}
            </div>
          )}

          {cancelled && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              {t('orderDetail.paypalCancelled')}
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
                    {t('orderDetail.updated')}: {new Date(order.created_at).toLocaleString(t('locale') === 'vi' ? 'vi-VN' : 'en-US')}
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
                  <span className="text-xs text-gray-400">{t('orderDetail.quantity')}:</span>
                  <span className="text-sm font-bold text-white">x{order.quantity}</span>
                </div>

                {order.pricing_mode === 'usd' || !order.pricing_mode ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold font-mono text-emerald-400">{formatUSD(Number(order.price_usd))}</span>
                    <span className="text-sm text-gray-500 font-medium tracking-wide">USD</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold font-mono text-[#f0b90b]">{formatCrypto(Number(order.subtotal_token), 'TOKEN')}</span>
                      <span className="text-sm text-gray-500 font-medium tracking-wide">Token</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">~ {formatUSD(Number(order.price_usd))}</p>
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
                  {t('orderDetail.buyer')} {isBuyer && <span className="text-blue-400 normal-case font-medium tracking-normal">{t('orderDetail.you')}</span>}
                </dt>
                <dd className="font-medium text-sm text-gray-200 truncate">{order.buyer_name}</dd>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <dt className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  {t('orderDetail.seller')} {isSeller && <span className="text-emerald-400 normal-case font-medium tracking-normal">{t('orderDetail.you')}</span>}
                </dt>
                <dd className="font-medium text-sm text-gray-200 truncate">{order.seller_name}</dd>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <dt className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5">{t('orderDetail.paymentMethod')}</dt>
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
                <dt className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1.5">{t('orderDetail.invoiceCode')}</dt>
                <dd className="font-mono text-xs text-gray-400 bg-black/30 px-2 py-1 rounded inline-block">
                  {order.internal_order_id.split('-')[0].toUpperCase()}
                </dd>
              </div>
            </div>
          </div>

          {/* ── ESCROW CONTRACT TRACKING PANEL ─── */}
          {order.payment_method === 'crypto' && order.escrow_contract && (
            <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <p className="font-semibold text-emerald-300 text-sm">{t('orderDetail.escrowContract')}</p>
                </div>
                {order.chain_id && CHAIN_META[order.chain_id] && (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full font-bold text-emerald-400">
                    {CHAIN_META[order.chain_id].name}
                  </span>
                )}
              </div>

              {/* Status explanation */}
              <p className="text-xs text-emerald-400/70">
                {order.status === 'TX_SUBMITTED' && t('orderDetail.escrowTxSubmitted')}
                {order.status === 'ONCHAIN_CONFIRMED' && t('orderDetail.escrowOnchainConfirmed')}
                {order.status === 'PAID' && t('orderDetail.escrowPaid')}
                {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && t('orderDetail.escrowShipped')}
                {order.status === 'COMPLETED' && t('orderDetail.escrowCompleted')}
                {order.status === 'DISPUTED' && t('orderDetail.escrowDisputed')}
              </p>

              {/* ── Blockchain Timeline ── */}
              <div className="flex items-center gap-0 text-[9px] font-bold select-none">
                {[
                  { label: 'Deposit', done: ['TX_SUBMITTED','ONCHAIN_CONFIRMED','PAID','SHIPPED','DELIVERED','COMPLETED'].includes(order.status) },
                  { label: 'Confirmed', done: ['ONCHAIN_CONFIRMED','PAID','SHIPPED','DELIVERED','COMPLETED'].includes(order.status) },
                  { label: 'Locked', done: ['PAID','SHIPPED','DELIVERED','COMPLETED'].includes(order.status) },
                  { label: 'Released', done: order.status === 'COMPLETED' },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center flex-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      step.done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/30'
                    }`}>
                      {step.done ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 transition-all ${step.done ? 'bg-emerald-500/60' : 'bg-white/10'}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex text-[8px] text-white/30 font-semibold">
                <span className="flex-1 text-center">Deposit</span>
                <span className="flex-1 text-center">Confirmed</span>
                <span className="flex-1 text-center">Locked</span>
                <span className="flex-1 text-center">Released</span>
              </div>

              {/* Contract address */}
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500">Escrow Contract</p>
                <div className="flex items-center gap-2 p-2.5 bg-black/20 rounded-lg">
                  <p className="font-mono text-[11px] text-emerald-300/80 flex-1 break-all">{order.escrow_contract}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(order.escrow_contract!); toast.success(t('orderDetail.copiedContract')); }}
                    className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-emerald-400/60 hover:text-emerald-400 transition-colors"
                    title="Copy address"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  {order.chain_id && CHAIN_META[order.chain_id]?.explorer && CHAIN_META[order.chain_id].explorer !== 'http://localhost:8545' && (
                    <a
                      href={`${CHAIN_META[order.chain_id].explorer}/address/${order.escrow_contract}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded text-[10px] font-bold text-emerald-400 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Explorer
                    </a>
                  )}
                </div>
              </div>

              {/* TX Hash */}
              {order.tx_hash && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500">{t('orderDetail.txHash')}</p>
                  <div className="flex items-center gap-2 p-2.5 bg-black/20 rounded-lg">
                    <p className="font-mono text-[11px] text-blue-300/80 flex-1 truncate">{order.tx_hash}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(order.tx_hash!); toast.success(t('orderDetail.copiedTxHash')); }}
                      className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-blue-400/60 hover:text-blue-400 transition-colors"
                      title="Copy TX hash"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    {order.chain_id && CHAIN_META[order.chain_id]?.explorer && CHAIN_META[order.chain_id].explorer !== 'http://localhost:8545' && (
                      <a
                        href={`${CHAIN_META[order.chain_id].explorer}/tx/${order.tx_hash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 rounded text-[10px] font-bold text-blue-400 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> TX
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Amount locked */}
              {order.amount_token && order.amount_token > 0 && (
                <div className="flex items-center justify-between text-xs p-2.5 bg-black/20 rounded-lg">
                  <span className="text-gray-500">{t('orderDetail.amountLocked')}</span>
                  <span className="font-mono font-bold text-emerald-400">{formatCrypto(order.amount_token, 'TOKEN')} Token</span>
                </div>
              )}
            </div>
          )}

          {/* ── TRACKING INFO CARD (SHIPPED) ─── */}
          {order.status === 'SHIPPED' && (
            <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-indigo-400" />
                <p className="font-semibold text-indigo-300 text-sm">{t('orderDetail.shippingInTransit')}</p>
              </div>
              {order.tracking_number ? (
                <p className="text-xs text-indigo-400/80">{t('orderDetail.trackingLabel')}: <span className="font-mono font-bold text-indigo-300">{order.tracking_number}</span></p>
              ) : (
                <p className="text-xs text-indigo-400/70">{t('orderDetail.noTrackingYet')}</p>
              )}
            </div>
          )}

          {order.status === 'UNPAID' && isBuyer && (
            <Link href={`/checkout/${order.order_id}`}>
              <button className="w-full relative overflow-hidden group py-4 bg-gradient-to-r from-[#f0b90b] to-[#f3ba2f] text-black font-bold rounded-2xl text-base transition-all shadow-[0_4px_20px_rgba(240,185,11,0.2)] hover:shadow-[0_4px_30px_rgba(240,185,11,0.35)] hover:-translate-y-0.5 mb-6">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10 block text-center">{t('orderDetail.continuePay')}</span>
              </button>
            </Link>
          )}

          {/* ── SELLER: Mark SHIPPED ─── */}
          {isSeller && (order.status === 'PAID' || order.status === 'ONCHAIN_CONFIRMED') && (
            <div className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-3xl shadow-lg shadow-blue-500/5 mb-6 border border-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2 text-blue-400 flex items-center gap-2">
                  <Package className="w-5 h-5" /> {t('orderDetail.sellerActions')}
                </h3>
                <p className="text-sm text-blue-200/70 mb-4">{t('orderDetail.sellerPaidDesc')}</p>
                <div className="mb-4">
                  <label className="text-xs text-blue-300/70 font-semibold mb-1.5 block">{t('orderDetail.trackingNumberLabel')}</label>
                  <input
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value)}
                    placeholder={t('orderDetail.trackingPlaceholder')}
                    className="w-full px-3 py-2.5 bg-blue-900/20 border border-blue-500/20 rounded-xl text-sm text-white placeholder-blue-400/40 focus:outline-none focus:border-blue-400/50"
                  />
                </div>
                <button
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70"
                  onClick={() => handleUpdateStatus('SHIPPED', trackingInput ? { tracking_number: trackingInput } : {})}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
                  {t('orderDetail.confirmShipped')}
                </button>
              </div>
            </div>
          )}

          {/* ── BUYER: Confirm Delivery (on-chain) ─── */}
          {/* Show when SHIPPED, or when PAID and buyer hasn't received goods after a while */}
          {isBuyer && (order.status === 'SHIPPED' || order.status === 'PAID') && (
            <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-3xl shadow-lg shadow-emerald-500/5 mb-6 border border-emerald-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2 text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> {t('orderDetail.confirmDeliveryTitle')}
                </h3>
                {order.status === 'PAID' && (
                  <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <p className="text-xs text-amber-300">{t('orderDetail.sellerNotShipped')}</p>
                  </div>
                )}
                <p className="text-sm text-emerald-200/70 mb-2 leading-relaxed">
                  {t('orderDetail.confirmDeliveryDesc')}
                </p>
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-300 font-semibold">{t('orderDetail.warningIrreversible')}</p>
                </div>
                {!isConnected && order.payment_method === 'crypto' && (
                  <p className="text-xs text-yellow-400/80 mb-3">{t('orderDetail.connectMetamask')}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Dispute button */}
                  <button
                    className="flex-1 py-3.5 px-4 bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                    onClick={() => setShowDisputeForm(v => !v)}
                  >
                    <AlertTriangle className="w-4 h-4" /> {t('orderDetail.dispute')}
                  </button>
                  {/* Confirm delivery button */}
                  <button
                    className="flex-1 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70"
                    onClick={handleOnChainConfirm}
                    disabled={confirmPending || confirmWaiting}
                  >
                    {confirmPending ? <><Loader2 className="w-4 h-4 animate-spin" />{t('orderDetail.waitingMetamask')}</> :
                      confirmWaiting ? <><Loader2 className="w-4 h-4 animate-spin" />{t('orderDetail.confirmingOnchain')}</> :
                        <><Check className="w-5 h-5" />{t('orderDetail.confirmedDelivery')}</>}
                  </button>
                </div>

                {/* Dispute form */}
                {showDisputeForm && (
                  <div className="mt-4 p-5 bg-red-950/40 border border-red-500/20 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-red-300 text-sm">{t('orderDetail.submitDispute')}</p>
                        <p className="text-xs text-red-400/70 mt-0.5">{t('orderDetail.disputeDesc')}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-amber-300">{t('orderDetail.transparencyNote')}</p>
                          <ul className="text-xs text-amber-400/80 space-y-1 list-disc list-inside">
                            <li>{t('orderDetail.transparencyRule1')}</li>
                            <li>{t('orderDetail.transparencyRule2')}</li>
                            <li>{t('orderDetail.transparencyRule3')}</li>
                            <li>{t('orderDetail.transparencyRule4')}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-red-300 font-semibold mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />{t('orderDetail.disputeReason')} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={disputeReason}
                        onChange={e => setDisputeReason(e.target.value)}
                        placeholder={t('orderDetail.disputeReasonPlaceholder')}
                        rows={4}
                        className="w-full px-3 py-2.5 bg-red-900/20 border border-red-500/20 rounded-xl text-sm text-white placeholder-red-400/40 focus:outline-none focus:border-red-400/50 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-red-300 font-semibold mb-2 flex items-center gap-1.5">
                        <ImagePlus className="w-3.5 h-3.5" />{t('orderDetail.evidencePhotos')} — <span className="text-red-400/70 font-normal">{t('orderDetail.evidenceHint')}</span>
                      </label>
                      {disputeImages.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                          {disputeImages.map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-red-500/20 bg-black/30 group">
                              <img src={url} alt={`Bằng chứng ${idx + 1}`} className="w-full h-full object-cover" />
                              <button onClick={() => setDisputeImages(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-600/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {disputeImages.length < 5 && (
                        <>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadEvidenceImage(f); e.target.value = ''; }} />
                          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}
                            className="w-full py-3 border border-dashed border-red-500/30 rounded-xl text-sm text-red-400/70 hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {uploadingImg
                              ? <><Loader2 className="w-4 h-4 animate-spin" />{t('orderDetail.uploadingPhoto')}</>
                              : <><Upload className="w-4 h-4" />{t('orderDetail.selectEvidence', { count: disputeImages.length })}</>}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="p-3 bg-white/3 border border-white/5 rounded-xl">
                      <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{t('orderDetail.disputeProcess')}</p>
                      <div className="space-y-1.5">
                        {[
                          { n: '1', txt: t('orderDetail.disputeStep1'), c: 'text-red-400' },
                          { n: '2', txt: t('orderDetail.disputeStep2'), c: 'text-amber-400' },
                          { n: '3', txt: t('orderDetail.disputeStep3'), c: 'text-blue-400' },
                          { n: '4', txt: t('orderDetail.disputeStep4'), c: 'text-gray-400' },
                        ].map(({ n, txt, c }) => (
                          <div key={n} className="flex items-start gap-2">
                            <span className={`text-xs font-bold ${c} flex-shrink-0 w-4`}>{n}.</span>
                            <span className="text-xs text-gray-500">{txt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setShowDisputeForm(false); setDisputeReason(''); setDisputeImages([]); }}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-all">
                        {t('orderDetail.cancelDispute')}
                      </button>
                      <button onClick={handleDispute} disabled={actionLoading || !disputeReason.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {actionLoading
                          ? <><Loader2 className="w-4 h-4 animate-spin" />{t('orderDetail.sendingDispute')}</>
                          : <><AlertTriangle className="w-4 h-4" />{t('orderDetail.submitDisputeBtn')}</>}
                      </button>
                    </div>
                  </div>
                )}

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
                    <p className="font-bold text-foreground text-sm">{t('orderDetail.reviewCta')}</p>
                    <p className="text-xs text-muted-foreground">{t('orderDetail.reviewCtaDesc')}</p>
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
