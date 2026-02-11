'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient, paymentClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Wallet, Loader2 } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';

interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  product_metadata: { images?: string[]; category?: string; accepted_tokens?: { crypto?: string[]; fiat?: string[] } };
  quantity: number;
  price_usd: number;
  status: string;
  payment_method: string | null;
  buyer_name: string;
  seller_name: string;
}

interface CryptoQuote {
  order_id: number;
  escrow_contract: string;
  token_address: string;
  chain_id: number;
  amount_token: number;
  amount_wei: string;
  calldata: string;
  token_price: number;
  expires_at: number;
}

const DEFAULT_TOKENS = ['USDT', 'USDC', 'DAI', 'MATIC', 'ETH'];
const CHAIN_IDS: Record<number, string> = {
  137: 'Polygon',
  80001: 'Polygon Mumbai',
  42161: 'Arbitrum',
};

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.orderId;
  const orderId = typeof rawId === 'string' ? parseInt(rawId, 10) : Number(rawId);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'crypto' | 'paypal'>('crypto');
  const [selectedToken, setSelectedToken] = useState('USDT');
  const [quote, setQuote] = useState<CryptoQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated && orderId && !Number.isNaN(orderId)) fetchOrder();
    else if (!authLoading && (Number.isNaN(orderId) || !orderId)) setLoading(false);
  }, [isAuthenticated, authLoading, orderId]);

  const fetchOrder = async () => {
    try {
      const res = await apiClient.get(`/api/orders/${orderId}`);
      const o = res.data.order;
      if (o.status !== 'UNPAID') {
        toast.info('Đơn hàng đã được xử lý');
        router.push(`/orders/${o.order_id}`);
        return;
      }
      setOrder(o);
      const tokens = o.product_metadata?.accepted_tokens?.crypto;
      if (tokens?.length) setSelectedToken(tokens[0]);
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

  const handleGetQuote = async () => {
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(true);
    try {
      const res = await paymentClient.post('/api/payments/crypto/quote', {
        order_id: orderId,
        token_symbol: selectedToken,
      });
      setQuote(res.data.quote);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Lấy báo giá thất bại';
      setQuoteError(msg);
      toast.error(msg);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handlePayWithMetaMask = async () => {
    if (!quote || !walletClient || !address) {
      toast.error('Vui lòng kết nối ví MetaMask');
      return;
    }
    setSubmitLoading(true);
    try {
      const tx = await walletClient.sendTransaction({
        to: quote.escrow_contract as `0x${string}`,
        data: quote.calldata as `0x${string}`,
        value: 0n,
        chainId: quote.chain_id,
      });
      const hash = typeof tx === 'string' ? tx : (tx as { hash: string }).hash;
      await paymentClient.post('/api/payments/crypto/submit', {
        order_id: orderId,
        tx_hash: hash,
      });
      toast.success('Giao dịch đã được gửi. Đang chờ xác nhận...');
      router.push(`/orders/${orderId}`);
    } catch (e: any) {
      const msg = e.message || e.shortMessage || 'Giao dịch thất bại';
      if (msg.includes('rejected') || e.code === 4001) {
        toast.info('Bạn đã hủy giao dịch');
      } else if (msg.includes('Internal JSON-RPC') || msg.includes('JSON-RPC')) {
        toast.error(
          'Lỗi kết nối RPC. Hãy: (1) Chuyển ví sang mạng Polygon hoặc Arbitrum, (2) Thử lại với token USDT/USDC trên Polygon, (3) Kiểm tra đã approve token chưa.'
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmitTxHash = async () => {
    const hash = txHash.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      toast.error('Định dạng tx hash không đúng (0x + 64 ký tự hex)');
      return;
    }
    setSubmitLoading(true);
    try {
      await paymentClient.post('/api/payments/crypto/submit', {
        order_id: orderId,
        tx_hash: hash,
      });
      toast.success('Đã gửi tx. Đang chờ xác nhận...');
      router.push(`/orders/${orderId}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gửi tx thất bại');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePayWithPayPal = async () => {
    setPaypalLoading(true);
    try {
      const res = await paymentClient.post('/api/payments/paypal/create-order', {
        order_id: orderId,
      });
      const url = res.data.approval_url;
      if (url) window.location.href = url;
      else toast.error('Không nhận được link thanh toán PayPal');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Tạo đơn PayPal thất bại');
    } finally {
      setPaypalLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    setCancelLoading(true);
    try {
      await apiClient.post(`/api/orders/${orderId}/cancel`);
      toast.success('Đã hủy đơn hàng');
      router.push('/orders');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Hủy đơn thất bại');
    } finally {
      setCancelLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!order || Number.isNaN(orderId)) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {Number.isNaN(orderId) ? 'Mã đơn hàng không hợp lệ.' : 'Không tìm thấy đơn hàng.'}
            </p>
            <Link href="/orders">
              <Button>Về đơn hàng</Button>
            </Link>
            <Link href="/" className="ml-2 inline-block">
              <Button variant="outline">Về trang chủ</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const acceptedCrypto = order.product_metadata?.accepted_tokens?.crypto || DEFAULT_TOKENS;
  const acceptPayPal = order.product_metadata?.accepted_tokens?.fiat?.includes('paypal');

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/products/${order.product_id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Thanh toán đơn hàng #{order.order_id}</h1>
          </div>

          {/* Order summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Thông tin đơn hàng</h2>
            <div className="flex gap-4">
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
                <h3 className="font-semibold truncate">{order.product_name}</h3>
                <p className="text-sm text-gray-500">Số lượng: {order.quantity}</p>
                <p className="text-lg font-bold text-primary mt-1">${Number(order.price_usd).toFixed(2)} USD</p>
              </div>
            </div>
          </div>

          {/* Payment method - Always show Crypto & PayPal options */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Chọn phương thức thanh toán</h2>
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={paymentMethod === 'crypto' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('crypto')}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Crypto
              </Button>
              <Button
                variant={paymentMethod === 'paypal' ? 'default' : 'outline'}
                onClick={() => acceptPayPal && setPaymentMethod('paypal')}
                disabled={!acceptPayPal}
                title={!acceptPayPal ? 'Sản phẩm này không chấp nhận PayPal' : undefined}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                PayPal
              </Button>
            </div>

            {paymentMethod === 'crypto' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Token</label>
                  <select
                    value={selectedToken}
                    onChange={(e) => { setSelectedToken(e.target.value); setQuote(null); }}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  >
                    {acceptedCrypto.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleGetQuote} disabled={quoteLoading}>
                  {quoteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Lấy báo giá
                </Button>
                {quoteError && (
                  <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                    {quoteError.includes('wallet_address') || quoteError.includes('Seller') ? (
                      <>
                        <p className="font-medium">Người bán chưa liên kết ví để nhận thanh toán crypto.</p>
                        <p className="mt-1">Bạn có thể chọn thanh toán bằng PayPal bên trên.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => { setPaymentMethod('paypal'); setQuoteError(null); }}
                        >
                          Chuyển sang PayPal
                        </Button>
                      </>
                    ) : (
                      quoteError
                    )}
                  </div>
                )}
                {quote && (
                  <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50 space-y-2">
                    <p className="font-medium">Số lượng: {quote.amount_token.toFixed(6)} {selectedToken}</p>
                    <p className="text-sm text-gray-500">Mạng: {CHAIN_IDS[quote.chain_id] || quote.chain_id}</p>
                    <p className="text-xs text-gray-500 break-all">Escrow: {quote.escrow_contract}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {isConnected && walletClient ? (
                        <Button onClick={handlePayWithMetaMask} disabled={submitLoading}>
                          {submitLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Thanh toán bằng MetaMask
                        </Button>
                      ) : (
                        <p className="text-sm text-amber-600">Kết nối ví (RainbowKit) để thanh toán bằng MetaMask.</p>
                      )}
                      <div className="flex gap-2 flex-1 items-end">
                        <input
                          type="text"
                          placeholder="0x... (tx hash)"
                          value={txHash}
                          onChange={(e) => setTxHash(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700"
                        />
                        <Button variant="outline" size="sm" onClick={handleSubmitTxHash} disabled={submitLoading}>
                          Gửi tx hash
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'paypal' && acceptPayPal && (
              <Button onClick={handlePayWithPayPal} disabled={paypalLoading}>
                {paypalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Chuyển đến PayPal để thanh toán
              </Button>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCancelOrder} disabled={cancelLoading}>
              {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Hủy đơn hàng
            </Button>
            <Link href="/orders">
              <Button variant="ghost">Xem đơn hàng của tôi</Button>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
