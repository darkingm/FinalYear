'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Info, Clock, FileText, RefreshCw
} from 'lucide-react';
import { OrderStepper, OrderStatus, OrderStatusIndicator } from '@/components/order/OrderStepper';
import { OrderTrackingSnapshot } from '@/components/order/OrderTrackingSnapshot';
import { NFTOwnershipCard } from '@/components/web3/NFTOwnershipCard';
import { TokenAmountInline, UsdtAmountInline } from '@/components/checkout/CheckoutPriceValue';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseAbi, keccak256, toBytes } from 'viem';
import { CHAIN_META, CHAIN_TOKENS } from '@/lib/web3/config';
import { ensureCorrectChainRpc } from '@/lib/web3/ensure-chain';
import { formatEscrowAmount, hasPositiveAmount } from '@/lib/orders/amount';
import { getOrderPricingDisplay, getOrderStatusMeta, resolveOrderProductImage, type OrderVerificationContext } from '@/lib/orders/presentation';
import { paymentPageTheme, getPaymentAccentPanelClass } from '@/lib/payments/payment-page-theme';
import { EscrowStatusPanel } from '@/components/escrow/EscrowStatusPanel';
import { EscrowExpiryActions } from '@/components/escrow/EscrowExpiryActions';

/** Translate buyerConfirmDelivery revert reasons into human-friendly messages */
function parseConfirmRevertReason(error: Error | null | undefined): string | null {
  if (!error) return null;
  const msg = (error as any)?.shortMessage || error.message || '';
  if (msg.includes('Invalid status'))  return 'Đơn hàng chưa ở trạng thái "Đã thanh toán" trên blockchain. Có thể đã được xác nhận hoặc hoàn tiền trước đó.';
  if (msg.includes('Not the buyer'))   return 'Ví MetaMask hiện tại không phải ví buyer của đơn này. Hãy đổi sang ví đã thanh toán.';
  if (msg.includes('Order expired'))   return 'Đơn hàng đã hết hạn trên blockchain. Liên hệ admin để xử lý.';
  if (msg.includes('Seller transfer')) return 'Chuyển tiền cho seller thất bại. Ví seller có thể không nhận được ETH.';
  if (msg.includes('Fee transfer'))    return 'Chuyển phí giao dịch thất bại. Liên hệ admin.';
  if (msg.includes('rejected') || msg.includes('denied') || msg.includes('4001')) return 'Bạn đã từ chối giao dịch trong MetaMask.';
  if (msg.includes('insufficient funds')) return 'Ví không đủ ETH để trả phí gas.';
  return null;
}
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';

type ProductImageLike = string | { url?: string; image_url?: string; is_primary?: boolean; sort_order?: number };

interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  product_metadata: { images?: ProductImageLike[]; category?: string; primaryImage?: string };
  primary_image?: string | null;
  quantity: number;
  price_usd: number;
  total_amount?: number | string;
  pricing_mode?: string;
  subtotal_token?: number | string;
  token_symbol?: string | null;
  status: OrderStatus;
  payment_method: string | null;
  buyer_id: number;
  seller_id: number;
  buyer_name: string;
  seller_name: string;
  seller_slug?: string | null;
  created_at: string;
  paypal_order_id?: string;
  tx_hash?: string;
  tracking_number?: string;
  chain_id?: number;
  escrow_contract?: string;
  amount_token?: number | string;
  buyer_wallet?: string | null;
  seller_wallet?: string | null;
  token_address?: string | null;
  token_decimals?: number | null;
}

interface PaymentStatusSnapshot extends OrderVerificationContext {
  status?: string;
  confirmations?: number | null;
  requiredConfirmations?: number | null;
  stuck_reason?: string | null;
  last_verified_at?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const success = searchParams.get('success') === 'true';
  const cancelled = searchParams.get('cancelled') === 'true';

  const { isAuthenticated, isLoading: authLoading, session, reauthRequired } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeImages, setDisputeImages] = useState<string[]>([]); // Cloudinary URLs
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [paymentSnapshot, setPaymentSnapshot] = useState<PaymentStatusSnapshot | null>(null);
  const [paymentSnapshotLoading, setPaymentSnapshotLoading] = useState(false);
  // On-chain escrow status: null = not checked yet, 0-5 = OrderStatus enum
  const [escrowOnChainStatus, setEscrowOnChainStatus] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wagmi for on-chain buyerConfirmDelivery
  const { isConnected } = useAccount();
  const CONFIRM_ABI = parseAbi(['function buyerConfirmDelivery(bytes32 orderId) external']);
  const GETORDER_ABI = parseAbi(['function getOrder(bytes32 orderId) external view returns (address buyer, address seller, address token, uint256 amount, uint256 fee, uint8 status, uint256 createdAt, uint256 expiresAt)']);
  const publicClient = usePublicClient();
  const { writeContract, data: confirmTxData, isPending: confirmPending, error: writeError } = useWriteContract();
  const { isLoading: confirmWaiting, isSuccess: confirmSuccess, isError: confirmError, error: receiptError } = useWaitForTransactionReceipt({ hash: confirmTxData });

  // After on-chain confirm, update backend
  useEffect(() => {
    if (!confirmSuccess || !order || !confirmTxData) return;
    // Sync backend to the on-chain completion without triggering a second release call.
    apiClient.patch(`/api/orders/${order.order_id}/status`, {
      status: 'COMPLETED',
      completion_source: 'buyer_onchain',
      release_tx_hash: confirmTxData,
    })
      .then(() => {
        toast.success('✅ Xác nhận nhận hàng thành công! Hệ thống đang đồng bộ trạng thái đơn hàng.');
        fetchOrder();
      })
      .catch((e: any) => {
        const msg = e.response?.data?.message || 'Lỗi cập nhật backend';
        toast.error(`Cập nhật thất bại: ${msg}`);
        // Don't panic — on-chain tx already succeeded, backend can sync it later.
        toast.info('Giao dịch on-chain đã thành công. Admin có thể đồng bộ trạng thái thủ công nếu cần.', { duration: 8000 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmSuccess]);

  const isInternalId = UUID_REGEX.test(id);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(buildLoginRedirectUrl(`/orders/${id}`, reauthRequired ? 'reauth_required' : undefined));
      return;
    }
    if (isAuthenticated && id) fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, id, reauthRequired]);

  useEffect(() => {
    if (!order || !success || !order.paypal_order_id || capturing) return;
    if (order.status === 'PAID' || order.status === 'PAID_PAYPAL' || order.status === 'COMPLETED') return; // already done
    capturePayPal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, success]);

  // ── Auto-sync: read on-chain escrow state when page loads for crypto orders ──
  // If on-chain is already Completed but DB is stale (PAID/SHIPPED), auto-patch backend.
  useEffect(() => {
    if (!order || order.payment_method !== 'crypto') return;
    if (!order.escrow_contract || !order.internal_order_id) return;
    // Only check for statuses where the confirm button might show
    if (!['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status)) return;
    if (!publicClient) return;

    const orderId32 = keccak256(toBytes(order.internal_order_id));
    publicClient.readContract({
      address: order.escrow_contract as `0x${string}`,
      abi: GETORDER_ABI,
      functionName: 'getOrder',
      args: [orderId32],
    }).then((result: any) => {
      const [onChainBuyer, , , , , onChainStatus] = result as [string, string, string, bigint, bigint, number, bigint, bigint];
      setEscrowOnChainStatus(onChainStatus);

      // Auto-heal: if on-chain is Completed (2) but DB still PAID/SHIPPED
      if (onChainStatus === 2 && ['PAID', 'SHIPPED'].includes(order.status)) {
        toast.info('Đơn hàng đã hoàn tất on-chain. Đang đồng bộ lại trạng thái...', { duration: 5000 });
        apiClient.patch(`/api/orders/${order.order_id}/status`, {
          status: 'COMPLETED',
          completion_source: 'auto_sync_onchain',
        }).then(() => {
          toast.success('✅ Đã đồng bộ trạng thái đơn hàng thành COMPLETED.');
          fetchOrder();
        }).catch(() => {
          // Non-fatal — user sees correct state via escrowOnChainStatus anyway
          console.warn('[auto-sync] Failed to patch backend, UI will still reflect on-chain state');
        });
      }

      // If order doesn't exist on-chain at all
      if (onChainBuyer === '0x0000000000000000000000000000000000000000') {
        setEscrowOnChainStatus(-1); // sentinel: not deposited
      }
    }).catch((err: any) => {
      console.warn('[escrow-sync] Could not read on-chain state:', err?.message);
      // Don't block UI — pre-flight in handleOnChainConfirm will catch it
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.order_id, order?.status, order?.escrow_contract, publicClient]);

  async function fetchOrder() {
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
  }

  const refreshBlockchainStatus = useCallback(async (manual = false) => {
    if (!order || order.payment_method !== 'crypto') {
      return null;
    }

    if (manual) {
      setPaymentSnapshotLoading(true);
    }

    try {
      const res = await paymentClient.get(`/api/payments/crypto/status/${order.order_id}`);
      const raw = res.data?.status ?? {};
      const snapshot: PaymentStatusSnapshot = {
        status: raw.status,
        verificationState: raw.verification_state ?? null,
        verificationMessage: raw.verification_message ?? null,
        confirmations: raw.confirmations ?? null,
        requiredConfirmations: raw.required_confirmations ?? null,
        stuck_reason: raw.stuck_reason ?? null,
        last_verified_at: raw.last_verified_at ?? null,
      };
      setPaymentSnapshot(snapshot);

      if (snapshot.status && snapshot.status !== order.status) {
        await fetchOrder();
      }

      if (manual && snapshot.verificationMessage) {
        toast.info(snapshot.verificationMessage, { duration: 5000 });
      }

      return snapshot;
    } catch (e: any) {
      if (manual) {
        toast.error(e.response?.data?.message || 'Kiểm tra blockchain thất bại');
      }
      return null;
    } finally {
      if (manual) {
        setPaymentSnapshotLoading(false);
      }
    }
  }, [fetchOrder, order]);

  // Auto poll order status while waiting for blockchain confirmation
  useEffect(() => {
    const pollingStatuses = ['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED', 'PAID'];
    const terminalStatuses = ['CANCELLED', 'TX_FAILED', 'REFUNDED', 'COMPLETED', 'SHIPPED', 'DELIVERED', 'DISPUTED'];

    if (!order?.status || terminalStatuses.includes(order.status)) return;
    if (!pollingStatuses.includes(order.status)) return;
    // Skip blockchain polling for non-crypto orders (e.g. PayPal pending)
    if (order.payment_method !== 'crypto') return;

    refreshBlockchainStatus().catch(() => null);
    const interval = setInterval(() => {
      refreshBlockchainStatus().catch(() => null);
    }, 15_000); // 15s — avoids 429 rate limit (100 req / 15 min)
    return () => clearInterval(interval);
  }, [order?.status, refreshBlockchainStatus]);

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

  const handleUpdateStatus = async (newStatus: OrderStatus, extra?: Record<string, string>) => {
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/orders/${order?.order_id}/status`, { status: newStatus, ...extra });
      toast.success('Cập nhật trạng thái thành công!');
      fetchOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  // On-chain buyer confirm delivery
  const handleOnChainConfirm = async () => {
    if (!order?.escrow_contract || !order?.chain_id) {
      // Fallback: backend-only for non-crypto orders (PayPal, etc.)
      handleUpdateStatus('COMPLETED');
      return;
    }
    if (!isConnected) {
      toast.error('Connect MetaMask wallet first');
      return;
    }
    // Fix stale RPC cache in MetaMask (e.g. localhost:8545 cached for chain 31337)
    await ensureCorrectChainRpc(order.chain_id);
    // IMPORTANT: orderId32 must match exactly what the backend/contract uses:
    // ethers.keccak256(ethers.toUtf8Bytes(internal_order_id))
    // toBytes() from viem encodes as UTF-8, matching ethers.toUtf8Bytes()
    const orderId32 = keccak256(toBytes(order.internal_order_id));

    // ── Pre-flight: read on-chain escrow state before sending write tx ──
    // This catches "Invalid status" reverts BEFORE they hit MetaMask,
    // giving the user a clear explanation instead of a cryptic error.
    const STATUS_LABELS: Record<number, string> = {
      0: 'Pending (chưa nạp tiền)',
      1: 'Paid',
      2: 'Completed (đã xác nhận trước đó)',
      3: 'Refunded (đã hoàn tiền)',
      4: 'Disputed (đang khiếu nại)',
      5: 'Expired (đã hết hạn)',
    };
    try {
      if (publicClient) {
        const result = await publicClient.readContract({
          address: order.escrow_contract as `0x${string}`,
          abi: GETORDER_ABI,
          functionName: 'getOrder',
          args: [orderId32],
        }) as [string, string, string, bigint, bigint, number, bigint, bigint];
        const [onChainBuyer, , , , , onChainStatus] = result;
        if (onChainBuyer === '0x0000000000000000000000000000000000000000') {
          toast.error('Đơn hàng này chưa được nạp tiền vào Escrow trên blockchain. Thanh toán trước khi xác nhận.', { duration: 8000 });
          return;
        }
        if (onChainStatus !== 1) { // 1 = Paid
          const label = STATUS_LABELS[onChainStatus] ?? `Unknown (${onChainStatus})`;
          toast.error(`Đơn hàng trên blockchain đang ở trạng thái: ${label}. Chỉ có thể xác nhận khi trạng thái là "Paid".`, { duration: 8000 });
          return;
        }
      }
    } catch (preflightErr: any) {
      // If pre-flight fails (RPC error), let it fall through to writeContract
      // which will show the revert error anyway.
      console.warn('[preflight] Could not read on-chain state:', preflightErr?.message);
    }

    writeContract({
      address: order.escrow_contract as `0x${string}`,
      abi: CONFIRM_ABI,
      functionName: 'buyerConfirmDelivery',
      args: [orderId32],
      chainId: order.chain_id as any,
      gas: 500_000n, // Explicit cap — prevents gas estimation from hitting block limit on revert
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
      toast.success('Ảnh đã tải lên thành công');
    } catch (e: any) {
      toast.error(e.message || 'Tải ảnh thất bại');
    } finally {
      setUploadingImg(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) { toast.error('Vui lòng nhập lý do khiếu nại'); return; }
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/orders/${order?.order_id}/status`, {
        status: 'DISPUTED',
        reason: disputeReason,
        evidence_urls: disputeImages,   // ← gửi URLs ảnh bằng chứng
      });
      toast.success('✅ Đã gửi khiếu nại — Admin sẽ xem xét trong 24h. Tiền vẫn giữ trong escrow.');
      setShowDisputeForm(false);
      setDisputeReason('');
      setDisputeImages([]);
      fetchOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gửi khiếu nại thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const isBuyer = session?.user?.id === String(order?.buyer_id);
  const isSeller = session?.user?.id === String(order?.seller_id);
  const statusMeta = order ? getOrderStatusMeta(order.status, paymentSnapshot, order.payment_method) : null;
  const pricingDisplay = order ? getOrderPricingDisplay(order) : null;
  const orderImage = order ? resolveOrderProductImage(order) : null;
  const orderTokenSymbol = order?.token_symbol ?? (order?.chain_id ? CHAIN_TOKENS[order.chain_id]?.[0] : null) ?? null;
  const showEscrowPanel = Boolean(order?.payment_method === 'crypto' && order.escrow_contract);
  const showTrackingCard = Boolean(order && ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status));
  const showPaymentCta = Boolean(order && isBuyer && ['UNPAID', 'TX_FAILED', 'TX_SUBMITTED'].includes(order.status));
  const paymentCtaLabel = order?.status === 'TX_FAILED'
    ? 'Thử thanh toán lại'
    : order?.status === 'TX_SUBMITTED' && order?.payment_method === 'paypal'
      ? 'Tiếp tục PayPal'
      : order?.status === 'TX_SUBMITTED'
        ? 'Mở lại trang thanh toán'
        : 'Tiếp tục thanh toán an toàn';
  const trackingTitle = order?.status === 'COMPLETED'
    ? 'Đơn hàng đã hoàn tất'
    : order?.status === 'DELIVERED'
      ? 'Đơn hàng đã được giao'
      : 'Hàng đang trên đường giao';
  const trackingDescription = order?.tracking_number
    ? `Mã vận đơn: ${order.tracking_number}`
    : order?.status === 'COMPLETED'
      ? 'Đơn hàng đã hoàn thành. Bạn có thể đối soát lại vận đơn nếu cần.'
      : 'Người bán chưa cập nhật mã vận đơn.';

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
    <div className={paymentPageTheme.pageShell}>
      {/* Ambient Backgrounds */}
      <div className={paymentPageTheme.darkAmbientTop} />
      <div className={paymentPageTheme.darkAmbientBottom} />

      <Header />
      <main className="flex-1 py-12 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header Action */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/orders">
              <button className={`p-2.5 rounded-full transition-all hover:-translate-x-1 group ${paymentPageTheme.ghostButton}`}>
                <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Chi tiết đơn hàng</h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">Order #{order.order_id}</p>
            </div>
          </div>

          {/* ONCHAIN_CONFIRMED = escrow releasing funds */}
          {order.status === 'ONCHAIN_CONFIRMED' && (
            <div className={`${getPaymentAccentPanelClass('amber')} mb-4 p-4 rounded-xl flex items-center gap-3`}>
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-300 text-sm">Đang đồng bộ thanh toán on-chain...</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">{statusMeta?.escrowCopy}</p>
              </div>
            </div>
          )}

          {/* TX_FAILED banner */}
          {order.status === 'TX_FAILED' && (
            <div className={`${getPaymentAccentPanelClass('red')} mb-4 p-4 rounded-xl flex items-center gap-3`}>
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300 text-sm">Giao dịch thất bại trên blockchain</p>
                <p className="text-xs text-red-700/80 dark:text-red-400/70 mt-0.5">Tiền chưa bị trừ. Vui lòng thử thanh toán lại.</p>
              </div>
            </div>
          )}

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

          <div className={`${paymentPageTheme.primarySurface} p-6 mb-6`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-white/5 pb-6">
              <div className="space-y-3">
                <OrderStatusIndicator status={order.status} paymentMethod={order.payment_method} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{statusMeta?.summary}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                    Cập nhật: {new Date(order.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex-shrink-0 group">
                {orderImage ? (
                  <Image
                    src={orderImage}
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
                <h2 className="font-bold text-xl text-foreground mb-2 leading-tight">{order.product_name}</h2>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200/70 rounded-lg dark:bg-white/5 dark:border-white/10 w-fit mb-3">
                  <span className="text-xs text-muted-foreground">Số lượng:</span>
                  <span className="text-sm font-bold text-foreground">x{order.quantity}</span>
                </div>

                {pricingDisplay?.mode !== 'token' ? (
                  <div className="flex flex-col gap-1.5">
                    <UsdtAmountInline
                      amount={pricingDisplay?.usdAmount ?? order.price_usd}
                      size="lg"
                      className="text-emerald-400"
                      amountClassName="text-emerald-400"
                    />
                    <p className="text-xs text-muted-foreground">Giá thanh toán trực tiếp theo USDT.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {pricingDisplay?.tokenSymbol && pricingDisplay.tokenAmountLabel ? (
                      <TokenAmountInline
                        amount={pricingDisplay.tokenAmountLabel}
                        symbol={pricingDisplay.tokenSymbol}
                        size="lg"
                        className="text-[#f0b90b]"
                        amountClassName="text-[#f0b90b]"
                      />
                    ) : null}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>≈</span>
                      <UsdtAmountInline amount={pricingDisplay?.usdAmount ?? order.price_usd} size="sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={`${paymentPageTheme.mutedSurface} p-5 mb-8`}>
              <OrderStepper currentStatus={order.status} paymentMethod={order.payment_method} className="py-2" />
            </div>

            <OrderTrackingSnapshot status={order.status} verification={paymentSnapshot} paymentMethod={order.payment_method} className="mb-8" />

            {order.payment_method === 'crypto' && ['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED', 'PAID'].includes(order.status) && (
              <div className={`${getPaymentAccentPanelClass('amber')} mb-8 p-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Theo dõi xác nhận blockchain</p>
                    <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
                      {paymentSnapshot?.verificationMessage || statusMeta?.escrowCopy}
                    </p>
                    {typeof paymentSnapshot?.confirmations === 'number' && typeof paymentSnapshot?.requiredConfirmations === 'number' && (
                      <p className="text-[11px] font-mono text-amber-700/90 dark:text-amber-300/90">
                        {paymentSnapshot.confirmations}/{paymentSnapshot.requiredConfirmations} block xác nhận
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => refreshBlockchainStatus(true)}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${paymentPageTheme.ghostButton}`}
                  >
                    {paymentSnapshotLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Kiểm tra lại blockchain
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`${paymentPageTheme.mutedSurface} p-4 rounded-xl`}>
                <dt className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  Người mua {isBuyer && <span className="text-blue-400 normal-case font-medium tracking-normal">(Bạn)</span>}
                </dt>
                <dd className="font-medium text-sm text-foreground truncate">{order.buyer_name}</dd>
              </div>
              <div className={`${paymentPageTheme.mutedSurface} p-4 rounded-xl`}>
                <dt className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  Trợ lý / Bán {isSeller && <span className="text-emerald-400 normal-case font-medium tracking-normal">(Bạn)</span>}
                </dt>
                <dd className="truncate text-sm font-medium text-foreground">
                  {order.seller_slug ? (
                    <Link href={`/seller/${order.seller_slug}`} className="transition-colors hover:text-primary hover:underline">
                      {order.seller_name}
                    </Link>
                  ) : (
                    order.seller_name
                  )}
                </dd>
              </div>
              <div className={`${paymentPageTheme.mutedSurface} p-4 rounded-xl`}>
                <dt className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-1.5">Phương thức</dt>
                <dd className="font-medium text-sm text-foreground uppercase flex items-center gap-1.5">
                  {order.payment_method === 'crypto' ? (
                    <><span className="w-2 h-2 rounded-full bg-[#f0b90b]" /> Crypto Web3</>
                  ) : order.payment_method === 'paypal' ? (
                    <><span className="w-2 h-2 rounded-full bg-blue-500" /> PayPal</>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className={`${paymentPageTheme.mutedSurface} p-4 rounded-xl`}>
                <dt className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-1.5">Mã Invoice</dt>
                <dd className={`${paymentPageTheme.codePill}`}>
                  {order.internal_order_id.split('-')[0].toUpperCase()}
                </dd>
              </div>
            </div>
          </div>

          {/* ── ESCROW CONTRACT TRACKING PANEL ─── */}
          {showEscrowPanel && (
            <div className={`${getPaymentAccentPanelClass('emerald')} p-5 mb-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">Smart Contract Escrow</p>
                </div>
                {order.chain_id && CHAIN_META[order.chain_id] && (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full font-bold text-emerald-400">
                    {CHAIN_META[order.chain_id].name}
                  </span>
                )}
              </div>

              {/* Status explanation */}
              <p className="text-xs text-emerald-400/70">
                {statusMeta?.escrowCopy}
              </p>

              {/* ── Blockchain Timeline ── */}
              <div className="flex items-center gap-0 text-[9px] font-bold select-none">
                {[
                  { label: 'Đã gửi', done: ['TX_SUBMITTED','ONCHAIN_PENDING','ONCHAIN_CONFIRMED','PAYMENT_VALIDATED','PAID','SHIPPED','DELIVERED','COMPLETED'].includes(order.status) },
                  { label: 'Xác nhận', done: ['ONCHAIN_PENDING','ONCHAIN_CONFIRMED','PAYMENT_VALIDATED','PAID','SHIPPED','DELIVERED','COMPLETED'].includes(order.status) || paymentSnapshot?.verificationState === 'confirmed' },
                  { label: 'Đang khóa', done: ['PAYMENT_VALIDATED','PAID','SHIPPED','DELIVERED','COMPLETED','DISPUTED'].includes(order.status) || paymentSnapshot?.verificationState === 'confirmed' },
                  { label: 'Giải ngân', done: ['COMPLETED','REFUNDED'].includes(order.status) },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center flex-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-white/30'
                    }`}>
                      {step.done ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 transition-all ${step.done ? 'bg-emerald-500/60' : 'bg-slate-200 dark:bg-white/10'}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex text-[8px] text-slate-400 dark:text-white/30 font-semibold">
                <span className="flex-1 text-center">Đã gửi</span>
                <span className="flex-1 text-center">Xác nhận</span>
                <span className="flex-1 text-center">Đang khóa</span>
                <span className="flex-1 text-center">Giải ngân</span>
              </div>

              {/* Contract address */}
              <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 dark:text-gray-500">Escrow Contract</p>
                  <div className={`${paymentPageTheme.subSurface} flex items-center gap-2 p-2.5`}>
                    <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300/80 flex-1 break-all">{order.escrow_contract}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(order.escrow_contract!); toast.success('Đã copy địa chỉ contract'); }}
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
                  <p className="text-[10px] text-slate-500 dark:text-gray-500">Transaction Hash</p>
                  <div className={`${paymentPageTheme.subSurface} flex items-center gap-2 p-2.5`}>
                    <p className="font-mono text-[11px] text-blue-700 dark:text-blue-300/80 flex-1 truncate">{order.tx_hash}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(order.tx_hash!); toast.success('Đã copy TX hash'); }}
                      className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-blue-400/60 hover:text-blue-400 transition-colors"
                      title="Copy TX hash"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    {order.chain_id && CHAIN_META[order.chain_id]?.explorer && (
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
              {hasPositiveAmount(order.amount_token) && (
                <div className={`${paymentPageTheme.subSurface} flex items-center justify-between text-xs p-2.5`}>
                  <span className="text-slate-500 dark:text-gray-500">Số tiền khóa trong escrow</span>
                  {orderTokenSymbol ? (
                    <TokenAmountInline
                      amount={formatEscrowAmount(order.amount_token)}
                      symbol={orderTokenSymbol}
                      size="sm"
                      className="text-emerald-400"
                      amountClassName="text-emerald-400"
                    />
                  ) : (
                    <span className="font-mono font-bold text-emerald-400">{formatEscrowAmount(order.amount_token)}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ON-CHAIN TRUTH PANEL (DB vs blockchain) ─── */}
          {showEscrowPanel && order.chain_id && (
            <EscrowStatusPanel
              internalOrderId={order.internal_order_id}
              chainId={order.chain_id}
              className="mb-6"
              db={{
                status: order.status,
                paymentStatus: paymentSnapshot?.status ?? null,
                buyerWallet: order.buyer_wallet ?? null,
                sellerWallet: order.seller_wallet ?? null,
                tokenAddress: order.token_address ?? null,
                tokenSymbol: orderTokenSymbol ?? null,
                tokenDecimals: order.token_decimals ?? null,
                amountWei: null /* amount_token is in display units, not wei — on-chain panel handles comparison */,
              }}
            />
          )}

          {/* ── BUYER SELF-RESCUE: countdown + refundExpired ─── */}
          {showEscrowPanel && order.chain_id && order.internal_order_id && (
            <EscrowExpiryActions
              orderId={order.order_id}
              internalOrderId={order.internal_order_id}
              chainId={order.chain_id}
              isBuyerOfOrder={isBuyer}
              onRefunded={fetchOrder}
            />
          )}

          {/* ── TRACKING INFO CARD (SHIPPED) ─── */}
          {showTrackingCard && (
            <div className={`${getPaymentAccentPanelClass('indigo')} p-5 mb-6`}>
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-indigo-400" />
                <p className="font-semibold text-indigo-300 text-sm">{trackingTitle}</p>
              </div>
              <p className="text-xs text-indigo-400/80">
                {order.tracking_number ? (
                  <>
                    Mã vận đơn: <span className="font-mono font-bold text-indigo-300">{order.tracking_number}</span>
                  </>
                ) : trackingDescription}
              </p>
            </div>
          )}

          {showPaymentCta && (
            <Link href={`/checkout/${order.order_id}`}>
              <button className="w-full relative overflow-hidden group py-4 bg-gradient-to-r from-[#f0b90b] to-[#f3ba2f] text-black font-bold rounded-2xl text-base transition-all shadow-[0_4px_20px_rgba(240,185,11,0.2)] hover:shadow-[0_4px_30px_rgba(240,185,11,0.35)] hover:-translate-y-0.5 mb-6">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10 block text-center">{paymentCtaLabel} &rarr;</span>
              </button>
            </Link>
          )}

          {/* ── SELLER: Mark SHIPPED ─── */}
          {isSeller && (order.status === 'PAID' || order.status === 'PAID_PAYPAL' || order.status === 'ONCHAIN_CONFIRMED') && (
            <div className={`${getPaymentAccentPanelClass('blue')} p-6 rounded-3xl shadow-lg shadow-blue-500/5 mb-6 relative overflow-hidden dark:bg-gradient-to-br dark:from-blue-500/10 dark:to-blue-600/5`}>
              <div className="absolute top-0 right-0 hidden w-32 h-32 bg-blue-500/20 blur-3xl rounded-full dark:block" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2 text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Package className="w-5 h-5" /> Thao tác dành cho người bán
                </h3>
                <p className="text-sm text-blue-700/80 dark:text-blue-200/70 mb-4">Người mua đã thanh toán. Tiền đang khóa trong escrow cho đến khi giao hàng xong.</p>
                <div className="mb-4">
                  <label className="text-xs text-blue-700/80 dark:text-blue-300/70 font-semibold mb-1.5 block">Mã vận đơn (tùy chọn)</label>
                  <input
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value)}
                    placeholder="VD: VN123456789..."
                    className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-400/50 ${paymentPageTheme.inputSurface} dark:bg-blue-950/25 dark:text-white dark:placeholder:text-blue-300/40 dark:border-blue-500/20`}
                  />
                </div>
                <button
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70"
                  onClick={() => handleUpdateStatus('SHIPPED', trackingInput ? { tracking_number: trackingInput } : {})}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
                  Xác nhận Đã Giao Hàng
                </button>
              </div>
            </div>
          )}

          {/* ── BUYER: Confirm Delivery (on-chain) ─── */}
          {/* Show when SHIPPED/PAID AND on-chain status is Paid (1) or not yet checked (null) */}
          {/* Hide entirely if on-chain status shows Completed/Refunded/etc to prevent stale-state clicks */}
          {isBuyer && (order.status === 'SHIPPED' || order.status === 'PAID' || order.status === 'PAID_PAYPAL') && escrowOnChainStatus !== 2 && escrowOnChainStatus !== -1 && (
            // If we've checked on-chain and it's not Paid, show a warning instead of the confirm button
            escrowOnChainStatus !== null && escrowOnChainStatus !== 1 ? (
              <div className={`${getPaymentAccentPanelClass('amber')} p-6 rounded-3xl shadow-lg mb-6`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-600 dark:text-amber-400">Không thể xác nhận nhận hàng</h3>
                    <p className="text-sm text-amber-700/80 dark:text-amber-300/70 mt-1">
                      Đơn hàng trên blockchain đang ở trạng thái: <strong>{{
                        0: 'Pending (chưa nạp tiền)',
                        3: 'Refunded (đã hoàn tiền)',
                        4: 'Disputed (đang khiếu nại)',
                        5: 'Expired (đã hết hạn)',
                      }[escrowOnChainStatus] ?? `Unknown (${escrowOnChainStatus})`}</strong>.
                      Chỉ có thể xác nhận khi trạng thái on-chain là "Paid".
                    </p>
                  </div>
                </div>
              </div>
            ) :
            <div className={`${getPaymentAccentPanelClass('emerald')} p-6 rounded-3xl shadow-lg shadow-emerald-500/5 mb-6 relative overflow-hidden dark:bg-gradient-to-br dark:from-emerald-500/10 dark:to-emerald-600/5`}>
              <div className="absolute top-0 right-0 hidden w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full dark:block" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Xác nhận nhận hàng
                </h3>
                {(order.status === 'PAID' || order.status === 'PAID_PAYPAL') && (
                  <div className={`${getPaymentAccentPanelClass('amber')} mb-3 p-3 rounded-xl`}>
                    <p className="text-xs text-amber-700 dark:text-amber-300">⚠️ Người bán chưa cập nhật trạng thái giao hàng. Nếu bạn đã nhận được hàng, bạn vẫn có thể xác nhận để giải ngân cho người bán.</p>
                  </div>
                )}
                <p className="text-sm text-emerald-700/80 dark:text-emerald-200/70 mb-2 leading-relaxed">
                  Bạn đã nhận được sản phẩm? Nhấn xác nhận để hợp đồng thông minh tự động giải ngân cho người bán.
                </p>
                <div className={`${getPaymentAccentPanelClass('red')} mb-4 p-3 rounded-xl`}>
                  <p className="text-xs text-red-700 dark:text-red-300 font-semibold">⚠️ Lưu ý quan trọng: Sau khi xác nhận, tiền sẽ chuyển thẳng cho người bán và KHÔNG THỂ hoàn lại. Chỉ nhấn khi bạn đã nhận hàng và hài lòng.</p>
                </div>
                {!isConnected && order.payment_method === 'crypto' && (
                  <p className="text-xs text-amber-700 dark:text-yellow-400/80 mb-3">&#9888; Kết nối MetaMask để xác nhận trustlessly on-chain.</p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Dispute button */}
                  <button
                    className="flex-1 py-3.5 px-4 bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                    onClick={() => setShowDisputeForm(v => !v)}
                  >
                    <AlertTriangle className="w-4 h-4" /> Khiếu nại / Hoàn tiền
                  </button>
                  {/* Confirm delivery button */}
                  <button
                    className={`flex-1 py-3.5 px-4 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${
                      confirmError || writeError
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:-translate-y-0.5'
                    }`}
                    onClick={handleOnChainConfirm}
                    disabled={confirmPending || confirmWaiting}
                  >
                    {confirmPending ? <><Loader2 className="w-4 h-4 animate-spin" />Đang chờ MetaMask...</> :
                      confirmWaiting ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xác nhận on-chain...</> :
                        confirmError || writeError ? <><AlertTriangle className="w-4 h-4" />Giao dịch thất bại — Thử lại</> :
                          <><Check className="w-5 h-5" />Xác nhận đã nhận hàng — Trả tiền seller</>}
                  </button>
                  {/* Error detail */}
                  {(confirmError || writeError) && (
                    <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-red-400 font-medium">
                        {parseConfirmRevertReason(writeError ?? receiptError as Error) || 'Giao dịch thất bại. Kiểm tra RPC hoặc số dư gas.'}
                      </p>
                      <p className="text-xs text-red-400/60 mt-1 break-words">
                        {(writeError as any)?.shortMessage || (receiptError as any)?.shortMessage || ''}
                      </p>
                    </div>
                  )}
                </div>

                {/* Dispute form */}
                {showDisputeForm && (
                  <div className={`${getPaymentAccentPanelClass('red')} mt-4 p-5 space-y-4`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-red-700 dark:text-red-300 text-sm">Gửi khiếu nại</p>
                        <p className="text-xs text-red-700/75 dark:text-red-400/70 mt-0.5">Tiền sẽ tiếp tục đóng băng trong escrow cho đến khi Admin phán quyết.</p>
                      </div>
                    </div>
                    <div className={`${getPaymentAccentPanelClass('amber')} p-3 rounded-xl`}>
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Lưu ý về tính minh bạch</p>
                          <ul className="text-xs text-amber-700/80 dark:text-amber-400/80 space-y-1 list-disc list-inside">
                            <li>Mọi khiếu nại đều được ghi lại trên hệ thống vĩnh viễn</li>
                            <li>Admin có thể xem toàn bộ lịch sử giao dịch blockchain</li>
                            <li>Khiếu nại gian lận sẽ bị ghi vào Credit Score và có thể bị khóa tài khoản</li>
                            <li>Nếu đã nhận hàng, Admin phát hiện qua TX on-chain — khiếu nại cố tình sẽ bị từ chối</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-red-700 dark:text-red-300 font-semibold mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />Mô tả vấn đề <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={disputeReason}
                        onChange={e => setDisputeReason(e.target.value)}
                        placeholder="Mô tả chi tiết: hàng không đúng mô tả, hàng hỏng, không nhận được hàng..."
                        rows={4}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-red-400/50 resize-none ${paymentPageTheme.inputSurface} dark:bg-red-950/25 dark:text-white dark:placeholder:text-red-300/40 dark:border-red-500/20`}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-red-700 dark:text-red-300 font-semibold mb-2 flex items-center gap-1.5">
                        <ImagePlus className="w-3.5 h-3.5" />Ảnh bằng chứng (tối đa 5) — <span className="text-red-600/70 dark:text-red-400/70 font-normal">Khuyến khích để tăng tính thuyết phục</span>
                      </label>
                      {disputeImages.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                          {disputeImages.map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-red-500/20 bg-slate-100 dark:bg-black/30 group">
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
                              ? <><Loader2 className="w-4 h-4 animate-spin" />Đang tải ảnh...</>
                              : <><Upload className="w-4 h-4" />Chọn ảnh bằng chứng ({disputeImages.length}/5)</>}
                          </button>
                        </>
                      )}
                    </div>
                    <div className={`${paymentPageTheme.subSurface} p-3`}>
                      <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Quy trình xử lý</p>
                      <div className="space-y-1.5">
                        {[
                          { n: '1', t: 'Bạn gửi khiếu nại + ảnh bằng chứng', c: 'text-red-400' },
                          { n: '2', t: 'Admin xem xét, liên hệ cả hai bên trong 24h', c: 'text-amber-400' },
                          { n: '3', t: 'Admin phán quyết: hoàn tiền bạn HOẶC giải ngân người bán', c: 'text-blue-400' },
                          { n: '4', t: 'Bên thua kiện bị trừ Credit Score vĩnh viễn', c: 'text-gray-400' },
                        ].map(({ n, t, c }) => (
                          <div key={n} className="flex items-start gap-2">
                            <span className={`text-xs font-bold ${c} flex-shrink-0 w-4`}>{n}.</span>
                            <span className="text-xs text-slate-600 dark:text-gray-500">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setShowDisputeForm(false); setDisputeReason(''); setDisputeImages([]); }}
                        className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${paymentPageTheme.ghostButton}`}>
                        Hủy
                      </button>
                      <button onClick={handleDispute} disabled={actionLoading || !disputeReason.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {actionLoading
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Đang gửi...</>
                          : <><AlertTriangle className="w-4 h-4" />Gửi Khiếu Nại & Đóng Băng Tiền</>}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── On-chain completed but DB stale: show auto-sync banner ─── */}
          {isBuyer && (order.status === 'PAID' || order.status === 'SHIPPED') && escrowOnChainStatus === 2 && (
            <div className={`${getPaymentAccentPanelClass('emerald')} p-6 rounded-3xl shadow-lg mb-6`}>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-emerald-600 dark:text-emerald-400">Đơn hàng đã hoàn tất on-chain</h3>
                  <p className="text-sm text-emerald-700/80 dark:text-emerald-300/70 mt-1">
                    Tiền đã được giải ngân cho người bán trên blockchain. Hệ thống đang đồng bộ trạng thái...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── On-chain not deposited: order never made it to escrow ─── */}
          {isBuyer && (order.status === 'PAID' || order.status === 'SHIPPED') && escrowOnChainStatus === -1 && (
            <div className={`${getPaymentAccentPanelClass('red')} p-6 rounded-3xl shadow-lg mb-6`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-600 dark:text-red-400">Đơn hàng chưa có trên Escrow</h3>
                  <p className="text-sm text-red-700/80 dark:text-red-300/70 mt-1">
                    Giao dịch deposit chưa được ghi nhận trên smart contract. Có thể do TX deposit chưa được confirm hoặc bị revert. Liên hệ admin để kiểm tra.
                  </p>
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
