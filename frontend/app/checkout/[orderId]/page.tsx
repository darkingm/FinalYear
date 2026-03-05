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
import {
  ArrowLeft, Loader2, Shield, Zap, CreditCard, Wallet,
  Clock, CheckCircle, RefreshCw, AlertCircle, Package,
} from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { getCoinLogo } from '@/lib/utils/coin-logos';

interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  product_metadata: { images?: string[]; category?: string; accepted_tokens?: { crypto?: string[]; fiat?: string[] } };
  quantity: number;
  price_usd: number;
  pricing_mode?: string;
  product_token_id?: number | null;
  price_token?: number | null;
  subtotal_token?: number | null;
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
const CHAIN_IDS: Record<number, string> = { 137: 'Polygon', 80001: 'Mumbai', 42161: 'Arbitrum' };

// Coin prices updated every 30s
function useCoinPrices(tokens: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const syms = tokens.map(t => `${t}USDT`).join(',');
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=["${tokens.map(t => `${t}USDT`).join('","')}"]`);
        const data = await res.json();
        const map: Record<string, number> = {};
        if (Array.isArray(data)) {
          data.forEach((d: any) => { map[d.symbol.replace('USDT', '')] = parseFloat(d.price); });
        }
        setPrices(map);
      } catch { }
    };
    fetch_();
    const iv = setInterval(fetch_, 30000);
    return () => clearInterval(iv);
  }, [tokens.join(',')]);
  return prices;
}

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
  const [txHash, setTxHash] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const acceptedCrypto = order?.product_metadata?.accepted_tokens?.crypto || DEFAULT_TOKENS;
  const coinPrices = useCoinPrices(acceptedCrypto);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/login'); return; }
    if (isAuthenticated && orderId && !Number.isNaN(orderId)) fetchOrder();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, orderId]);

  const fetchOrder = async () => {
    try {
      const res = await apiClient.get(`/api/orders/${orderId}`);
      const o = res.data.order;
      if (o.status !== 'UNPAID') { toast.info('Đơn hàng đã được xử lý'); router.push(`/orders/${o.order_id}`); return; }
      setOrder(o);
      const tokens = o.product_metadata?.accepted_tokens?.crypto;
      if (tokens?.length) setSelectedToken(tokens[0]);
    } catch (e: any) {
      if (e.response?.status === 404) { toast.error('Không tìm thấy đơn hàng'); router.push('/orders'); }
      else toast.error(e.response?.data?.message || 'Tải đơn hàng thất bại');
    } finally { setLoading(false); }
  };

  const handleGetQuote = async () => {
    setQuote(null); setQuoteError(null); setQuoteLoading(true);
    try {
      const res = await paymentClient.post('/api/payments/crypto/quote', { order_id: orderId, token_symbol: selectedToken });
      setQuote(res.data.quote);
      setStep(3);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Lấy báo giá thất bại';
      setQuoteError(msg); toast.error(msg);
    } finally { setQuoteLoading(false); }
  };

  const handlePayWithMetaMask = async () => {
    if (!quote || !walletClient || !address) { toast.error('Kết nối ví MetaMask'); return; }
    setSubmitLoading(true);
    try {
      const tx = await walletClient.sendTransaction({
        to: quote.escrow_contract as `0x${string}`,
        data: quote.calldata as `0x${string}`,
        value: 0n,
        chainId: quote.chain_id,
      });
      const hash = typeof tx === 'string' ? tx : (tx as { hash: string }).hash;
      await paymentClient.post('/api/payments/crypto/submit', { order_id: orderId, tx_hash: hash });
      toast.success('Giao dịch đã gửi thành công!');
      router.push(`/orders/${orderId}`);
    } catch (e: any) {
      const msg = e.message || e.shortMessage || 'Giao dịch thất bại';
      if (msg.includes('rejected') || e.code === 4001) toast.info('Bạn đã hủy giao dịch');
      else toast.error(msg);
    } finally { setSubmitLoading(false); }
  };

  const handleSubmitTxHash = async () => {
    const hash = txHash.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) { toast.error('Tx hash không hợp lệ'); return; }
    setSubmitLoading(true);
    try {
      await paymentClient.post('/api/payments/crypto/submit', { order_id: orderId, tx_hash: hash });
      toast.success('Đã gửi tx hash!');
      router.push(`/orders/${orderId}`);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Gửi tx hash thất bại'); }
    finally { setSubmitLoading(false); }
  };

  const handleCancelOrder = async () => {
    setCancelLoading(true);
    try {
      await apiClient.post(`/api/orders/${orderId}/cancel`);
      toast.success('Đã hủy đơn hàng');
      router.push('/orders');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Hủy đơn thất bại'); }
    finally { setCancelLoading(false); }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen bg-[#0c0e14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Đang tải đơn hàng...</p>
      </div>
    </div>
  );

  if (!order || Number.isNaN(orderId)) return (
    <>
      <Header />
      <div className="min-h-screen bg-[#0c0e14] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">Không tìm thấy đơn hàng.</p>
          <Link href="/orders"><Button>Về danh sách đơn hàng</Button></Link>
        </div>
      </div>
      <Footer />
    </>
  );

  const acceptPayPal = order.product_metadata?.accepted_tokens?.fiat?.includes('paypal');
  const quoteTimeLeft = quote ? Math.max(0, Math.floor((quote.expires_at * 1000 - Date.now()) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-[#0c0e14] flex flex-col">
      <Header />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Back + Title */}
          <div className="flex items-center gap-3 mb-8">
            <Link href={`/products/${order.product_id}`}>
              <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Thanh toán</h1>
              <p className="text-gray-600 text-xs">Đơn hàng #{order.order_id}</p>
            </div>
            {/* Steps */}
            <div className="ml-auto hidden sm:flex items-center gap-2">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${step >= s ? 'bg-[#f0b90b] border-[#f0b90b] text-black' : 'border-white/20 text-gray-600'}`}>
                    {step > s ? <CheckCircle className="w-3.5 h-3.5" /> : s}
                  </div>
                  {s < 3 && <div className={`w-6 h-0.5 rounded ${step > s ? 'bg-[#f0b90b]' : 'bg-white/10'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1d26] border border-white/10 rounded-2xl p-5 mb-4">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#f0b90b]" />
              Tóm tắt đơn hàng
            </h2>
            <div className="flex gap-4">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                {order.product_metadata?.images?.[0] ? (
                  <Image src={order.product_metadata.images[0]} alt={order.product_name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{order.product_name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">Số lượng: {order.quantity}</p>
                <p className="text-sm text-gray-500">Người bán: {order.seller_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {order.pricing_mode === 'usd' ? (
                  <>
                    <p className="text-xl font-bold text-[#f0b90b]">${Number(order.price_usd).toFixed(2)}</p>
                    <p className="text-xs text-gray-600">USD</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-[#f0b90b]">{Number(order.subtotal_token).toFixed(4)}</p>
                    <p className="text-xs text-gray-600">Crypto Token</p>
                  </>
                )}
              </div>
            </div>
            {/* Escrow badge */}
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
              <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-gray-400">
                Thanh toán được bảo vệ bởi <span className="text-emerald-400 font-medium">Smart Contract Escrow</span>
              </p>
            </div>
          </motion.div>

          {/* Payment Method */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="bg-[#1a1d26] border border-white/10 rounded-2xl p-5 mb-4">
            <h2 className="text-sm font-bold text-white mb-4">Phương thức thanh toán</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setPaymentMethod('crypto'); setStep(2); }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${paymentMethod === 'crypto' ? 'border-[#f0b90b] bg-[#f0b90b]/8' : 'border-white/10 bg-white/3 hover:border-white/20'}`}
              >
                <Wallet className={`w-5 h-5 mb-2 ${paymentMethod === 'crypto' ? 'text-[#f0b90b]' : 'text-gray-500'}`} />
                <p className={`text-sm font-bold ${paymentMethod === 'crypto' ? 'text-[#f0b90b]' : 'text-gray-300'}`}>Crypto</p>
                <p className="text-xs text-gray-600 mt-0.5">{acceptedCrypto.join(', ')}</p>
              </button>
              <button
                onClick={() => acceptPayPal && setPaymentMethod('paypal')}
                disabled={!acceptPayPal}
                className={`p-4 rounded-xl border-2 transition-all text-left ${!acceptPayPal ? 'opacity-40 cursor-not-allowed' : ''} ${paymentMethod === 'paypal' ? 'border-blue-500 bg-blue-500/8' : 'border-white/10 bg-white/3 hover:border-white/20'}`}
              >
                <CreditCard className={`w-5 h-5 mb-2 ${paymentMethod === 'paypal' ? 'text-blue-400' : 'text-gray-500'}`} />
                <p className={`text-sm font-bold ${paymentMethod === 'paypal' ? 'text-blue-400' : 'text-gray-300'}`}>PayPal</p>
                <p className="text-xs text-gray-600 mt-0.5">{acceptPayPal ? 'USD trực tiếp' : 'Không hỗ trợ'}</p>
              </button>
            </div>
          </motion.div>

          {/* Crypto Details */}
          <AnimatePresence>
            {paymentMethod === 'crypto' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="bg-[#1a1d26] border border-white/10 rounded-2xl p-5 mb-4 space-y-4 overflow-hidden">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#f0b90b]" />
                  Chọn token thanh toán
                </h2>

                {/* Token selector */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {acceptedCrypto.map(token => (
                    <button
                      key={token}
                      onClick={() => { setSelectedToken(token); setQuote(null); }}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${selectedToken === token ? 'border-[#f0b90b] bg-[#f0b90b]/10' : 'border-white/10 bg-white/3 hover:border-white/20'}`}
                    >
                      <div className="w-6 h-6">
                        <Image src={getCoinLogo(token)} alt={token} width={24} height={24} className="object-contain" />
                      </div>
                      <span className={`text-xs font-bold ${selectedToken === token ? 'text-[#f0b90b]' : 'text-gray-400'}`}>{token}</span>
                      {coinPrices[token] && (
                        <span className="text-[10px] text-gray-600">${coinPrices[token].toFixed(2)}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Estimated amount preview */}
                {coinPrices[selectedToken] && (
                  <div className="flex items-center justify-between px-4 py-3 bg-white/3 border border-white/8 rounded-xl">
                    <div>
                      <p className="text-xs text-gray-600">Ước tính cần thanh toán</p>
                      <p className="text-base font-bold text-white font-mono">
                        {order?.pricing_mode !== 'crypto'
                          ? (Number(order?.price_usd) / coinPrices[selectedToken]).toFixed(6)
                          : 'Lấy báo giá để xem '} {selectedToken}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">Giá hiện tại</p>
                      <div className="flex items-center gap-1">
                        <p className="text-sm text-gray-300">${coinPrices[selectedToken].toFixed(2)}</p>
                        <RefreshCw className="w-3 h-3 text-gray-600" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Wallet Connect */}
                {!isConnected ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Kết nối ví để thanh toán tự động:</p>
                    <div className="flex justify-center">
                      <ConnectButton />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <p className="text-xs text-emerald-400 font-mono">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
                  </div>
                )}

                {/* Get Quote Button */}
                <button
                  onClick={handleGetQuote}
                  disabled={quoteLoading}
                  className="w-full py-3 bg-white/5 border border-white/15 hover:border-[#f0b90b]/40 hover:bg-[#f0b90b]/5 text-gray-300 hover:text-[#f0b90b] font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {quoteLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Đang lấy báo giá...</> : <><RefreshCw className="w-4 h-4" />Lấy báo giá {selectedToken}</>}
                </button>

                {/* Error */}
                {quoteError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">{quoteError}</p>
                  </div>
                )}

                {/* Quote Result */}
                {quote && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="border border-[#f0b90b]/30 bg-[#f0b90b]/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#f0b90b]">Báo giá xác nhận</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{quoteTimeLeft}s</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-600">Số lượng</p>
                        <p className="font-bold text-white font-mono">{quote.amount_token.toFixed(6)} {selectedToken}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Mạng lưới</p>
                        <p className="font-bold text-white">{CHAIN_IDS[quote.chain_id] || quote.chain_id}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-600">Escrow Contract</p>
                        <p className="font-mono text-gray-400 text-[10px] break-all">{quote.escrow_contract}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isConnected && walletClient ? (
                        <button onClick={handlePayWithMetaMask} disabled={submitLoading}
                          className="flex-1 py-2.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                          {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                          Thanh toán MetaMask
                        </button>
                      ) : null}
                    </div>
                    {/* Manual TX Hash */}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">Hoặc nhập tx hash thủ công:</p>
                      <div className="flex gap-2">
                        <input type="text" placeholder="0x..." value={txHash} onChange={e => setTxHash(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-700 focus:outline-none focus:border-white/20 font-mono" />
                        <button onClick={handleSubmitTxHash} disabled={submitLoading}
                          className="px-3 py-2 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-xs font-medium transition-colors">
                          Gửi
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* PayPal */}
          {paymentMethod === 'paypal' && acceptPayPal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-[#1a1d26] border border-white/10 rounded-2xl p-5 mb-4">
              <button
                onClick={async () => {
                  try {
                    const res = await paymentClient.post('/api/payments/paypal/create-order', { order_id: orderId });
                    const url = res.data.approval_url;
                    if (url) window.location.href = url;
                  } catch (e: any) { toast.error(e.response?.data?.message || 'Tạo đơn PayPal thất bại'); }
                }}
                className="w-full py-3 bg-[#003087] hover:bg-[#002070] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Thanh toán qua PayPal
              </button>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <button onClick={handleCancelOrder} disabled={cancelLoading}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-500 hover:text-red-400 rounded-xl hover:bg-red-500/8 transition-all text-sm">
              {cancelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Hủy đơn hàng
            </button>
            <Link href="/orders">
              <button className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-sm transition-all">
                Xem đơn hàng
              </button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

