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
  Clock, CheckCircle, RefreshCw, AlertCircle, Package, Lock
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
    <div className="min-h-screen bg-[#0c0e14] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#f0b90b]/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-[#f0b90b]/20 border-t-[#f0b90b] rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 bg-[#f0b90b] rounded-full animate-pulse blur-sm" />
          </div>
        </div>
        <p className="text-gray-400 font-medium tracking-wide">Đang chuẩn bị phiên thanh toán...</p>
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
    <div className="min-h-screen bg-[#0c0e14] flex flex-col relative overflow-hidden selection:bg-[#f0b90b] selection:text-black">
      {/* Ambient backgrounds */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#f0b90b]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Header />
      <main className="flex-1 py-12 px-4 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Order details and actions */}
          <div className="flex-1 space-y-6">
            
            {/* Steps & Title */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
              <div className="flex items-center gap-4 mb-6">
                <Link href={`/products/${order.product_id}`}>
                  <button className="p-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all hover:-translate-x-1 group">
                    <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Thanh toán an toàn</h1>
                  <p className="text-gray-500 font-mono text-xs mt-1">Ref: {order.internal_order_id.split('-')[0].toUpperCase()}</p>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center justify-between relative mt-8">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 rounded-full" />
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-[#f0b90b] to-[#f0b90b]/50 rounded-full transition-all duration-500"
                  style={{ width: `\${(step - 1) * 50}%` }}
                />
                
                {[
                  { id: 1, name: 'Tóm tắt' },
                  { id: 2, name: 'Phương thức' },
                  { id: 3, name: 'Hoàn tất' }
                ].map((s) => (
                  <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-300 \${
                      step > s.id 
                        ? 'bg-[#f0b90b] shadow-[#f0b90b]/30 text-black scale-100' 
                        : step === s.id
                        ? 'bg-[#2a2d36] border-2 border-[#f0b90b] text-[#f0b90b] shadow-[#f0b90b]/20 scale-110'
                        : 'bg-[#1a1d26] border border-white/10 text-gray-500 scale-100'
                    }`}>
                      {step > s.id ? <CheckCircle className="w-5 h-5" /> : s.id}
                    </div>
                    <span className={`text-[11px] font-medium tracking-wide uppercase \${step >= s.id ? 'text-gray-300' : 'text-gray-600'}`}>
                      {s.name}
                    </span>
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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
            <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
              Phương thức thanh toán
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => { setPaymentMethod('crypto'); setStep(2); }}
                className={`relative p-5 rounded-2xl border-2 transition-all text-left overflow-hidden group \${
                  paymentMethod === 'crypto' 
                    ? 'border-[#f0b90b] bg-[#f0b90b]/5 shadow-[0_0_20px_rgba(240,185,11,0.1)]' 
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {paymentMethod === 'crypto' && <div className="absolute inset-0 bg-gradient-to-br from-[#f0b90b]/10 to-transparent pointer-events-none" />}
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner \${
                    paymentMethod === 'crypto' ? 'bg-[#f0b90b] shadow-[#f0b90b]/50' : 'bg-[#2a2d36]'
                  }`}>
                    <Wallet className={`w-5 h-5 \${paymentMethod === 'crypto' ? 'text-black' : 'text-gray-400 group-hover:text-white'}`} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center \${
                    paymentMethod === 'crypto' ? 'border-[#f0b90b]' : 'border-gray-600'
                  }`}>
                    {paymentMethod === 'crypto' && <div className="w-2.5 h-2.5 bg-[#f0b90b] rounded-full" />}
                  </div>
                </div>
                <h3 className={`text-lg font-bold relative z-10 \${paymentMethod === 'crypto' ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>Crypto (Web3)</h3>
                <p className="text-xs text-gray-500 mt-1 relative z-10 leading-relaxed">Hỗ trợ các token: <span className={`font-medium \${paymentMethod === 'crypto' ? 'text-gray-300' : ''}`}>{acceptedCrypto.join(', ')}</span></p>
              </button>

              <button
                onClick={() => acceptPayPal && setPaymentMethod('paypal')}
                disabled={!acceptPayPal}
                className={`relative p-5 rounded-2xl border-2 transition-all text-left overflow-hidden group \${
                  !acceptPayPal ? 'opacity-40 cursor-not-allowed grayscale' : ''
                } \${
                  paymentMethod === 'paypal' 
                    ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {paymentMethod === 'paypal' && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />}
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner \${
                    paymentMethod === 'paypal' ? 'bg-[#003087] shadow-blue-500/50' : 'bg-[#2a2d36]'
                  }`}>
                    <CreditCard className={`w-5 h-5 \${paymentMethod === 'paypal' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center \${
                    paymentMethod === 'paypal' ? 'border-blue-500' : 'border-gray-600'
                  }`}>
                    {paymentMethod === 'paypal' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                  </div>
                </div>
                <h3 className={`text-lg font-bold relative z-10 \${paymentMethod === 'paypal' ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>PayPal</h3>
                <p className="text-xs text-gray-500 mt-1 relative z-10 leading-relaxed">{acceptPayPal ? 'Thanh toán bằng thẻ tín dụng hoặc số dư PayPal' : 'Sản phẩm này không hỗ trợ thanh toán qua PayPal'}</p>
              </button>
            </div>
          </motion.div>

          {/* Crypto Details */}
          <AnimatePresence>
            {paymentMethod === 'crypto' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 mb-4 overflow-hidden backdrop-blur-xl relative">
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#f0b90b]/5 rounded-full blur-3xl pointer-events-none" />
                
                <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#f0b90b] rounded-full" />
                  Chi tiết thanh toán Crypto
                </h2>

                {/* Token selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6">
                  {acceptedCrypto.map(token => (
                    <button
                      key={token}
                      onClick={() => { setSelectedToken(token); setQuote(null); }}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all overflow-hidden group \${
                        selectedToken === token 
                          ? 'border-[#f0b90b] bg-[#f0b90b]/10 shadow-lg shadow-[#f0b90b]/5' 
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {selectedToken === token && <div className="absolute inset-x-0 bottom-0 h-1 bg-[#f0b90b]" />}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center p-1 bg-white/5 backdrop-blur-sm border \${selectedToken===token?'border-[#f0b90b]/30':'border-white/10'}`}>
                        <Image src={getCoinLogo(token)} alt={token} width={28} height={28} className="object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-center">
                        <span className={`text-sm font-bold block \${selectedToken === token ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>{token}</span>
                        {coinPrices[token] ? (
                          <span className={`text-[11px] font-mono \${selectedToken === token ? 'text-[#f0b90b]' : 'text-gray-500'}`}>\${coinPrices[token].toFixed(2)}</span>
                        ) : (
                          <span className="text-[11px] text-gray-600 block h-4"/> 
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Estimated amount & Wallet */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Swap Estimate */}
                  {coinPrices[selectedToken] && (
                    <div className="relative p-4 bg-gradient-to-br from-[#1a1d26] to-[#12141a] border border-white/5 rounded-2xl overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-16 translate-x-16 group-hover:bg-white/10 transition-colors" />
                      <p className="text-xs text-gray-500 font-medium mb-1 relative z-10">Dự kiến thanh toán (ước tính)</p>
                      <div className="flex items-baseline gap-2 relative z-10">
                        <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300 font-mono tracking-tight">
                          {order?.pricing_mode !== 'crypto'
                            ? (Number(order?.price_usd) / coinPrices[selectedToken]).toFixed(5)
                            : 'Lấy báo giá'}
                        </p>
                        <span className="text-sm font-bold text-[#f0b90b]">{selectedToken}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 relative z-10">
                        <RefreshCw className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">Tỷ giá thời gian thực từ Binance</span>
                      </div>
                    </div>
                  )}

                  {/* Wallet Connection Status */}
                  <div className="p-4 bg-gradient-to-br from-[#1a1d26] to-[#12141a] border border-white/5 rounded-2xl flex flex-col justify-center">
                    {!isConnected ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-gray-400" />
                          <p className="text-xs font-medium text-gray-400">Kết nối ví Web3 để thanh toán 1 chạm</p>
                        </div>
                        <ConnectButton.Custom>
                          {({ openConnectModal }) => (
                            <button onClick={openConnectModal} className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 transition-all rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                              <Wallet className="w-4 h-4" /> Kết nối Ví
                            </button>
                          )}
                        </ConnectButton.Custom>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-400">Ví hiện tại</p>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-[10px] text-emerald-400 font-bold tracking-wider">ĐÃ KẾT NỐI</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
                            <p className="text-sm font-mono text-gray-300">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                          </div>
                          <ConnectButton.Custom>
                            {({ openAccountModal }) => (
                              <button onClick={openAccountModal} className="text-xs text-blue-400 hover:text-blue-300 font-medium">Đổi ví</button>
                            )}
                          </ConnectButton.Custom>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!quote && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    onClick={handleGetQuote}
                    disabled={quoteLoading}
                    className="w-full relative overflow-hidden group py-4 bg-gradient-to-r from-[#f0b90b] to-[#f3ba2f] text-black font-bold rounded-2xl text-base transition-all hover:shadow-[0_0_30px_rgba(240,185,11,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {quoteLoading ? <><Loader2 className="w-5 h-5 animate-spin" />Đang xử lý báo giá an toàn...</> 
                                    : <><Shield className="w-5 h-5" />Xác nhận tỷ giá & Lấy hóa đơn</>}
                    </span>
                  </motion.button>
                )}

                {/* Error */}
                {quoteError && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-200">{quoteError}</p>
                  </motion.div>
                )}

                {/* Quote Result & Final Pay Actions */}
                {quote && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-6 border-2 border-[#f0b90b]/40 bg-[#1a1d26] rounded-2xl overflow-hidden relative shadow-2xl shadow-[#f0b90b]/5">
                    {/* Header */}
                    <div className="bg-[#f0b90b]/10 border-b border-[#f0b90b]/20 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-[#f0b90b]" />
                        <h3 className="font-bold text-[#f0b90b]">Smart Contract Invoice</h3>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                        <Clock className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-bold text-red-400 font-mono">{Math.floor(quoteTimeLeft/60)}:{(quoteTimeLeft%60).toString().padStart(2,'0')}</span>
                      </div>
                    </div>
                    
                    {/* Body */}
                    <div className="p-5 space-y-5">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-gray-400 font-medium">Cần thanh toán</p>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white font-mono tracking-tighter">{quote.amount_token.toFixed(6)}</p>
                          <p className="text-sm text-[#f0b90b] font-bold">{selectedToken}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                          <p className="text-gray-500 text-xs mb-1">Mạng lưới (Chain)</p>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            {CHAIN_IDS[quote.chain_id] || `Chain \${quote.chain_id}`}
                          </p>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                          <p className="text-gray-500 text-xs mb-1">Ví người nhận an toàn</p>
                          <p className="font-mono font-medium text-gray-300 text-xs break-all leading-tight">{quote.escrow_contract}</p>
                        </div>
                      </div>

                      {/* Pay buttons */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        {isConnected && walletClient ? (
                          <button onClick={handlePayWithMetaMask} disabled={submitLoading}
                            className="flex-1 py-3.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl text-base shadow-[0_4px_14px_0_rgba(240,185,11,0.39)] transition-all hover:translate-y-[-1px] active:translate-y-[1px] flex items-center justify-center gap-2">
                            {submitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                            Ký xác nhận qua Web3 Wallet
                          </button>
                        ) : (
                          <div className="flex-1 p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl text-center">
                            <p className="text-sm text-blue-200 mb-3">Vui lòng kết nối ví để thực hiện thanh toán tự động via Smart Contract</p>
                            <ConnectButton />
                          </div>
                        )}
                      </div>

                      <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-white/10" />
                        <span className="flex-shrink-0 mx-4 text-xs text-gray-500 uppercase tracking-wider">Gửi Tx Hash Thủ công</span>
                        <div className="flex-grow border-t border-white/10" />
                      </div>

                      <div className="flex gap-2">
                        <input type="text" placeholder="Nhập Hash Giao Dịch (0x...)" value={txHash} onChange={e => setTxHash(e.target.value)}
                          className="flex-1 px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f0b90b]/50 focus:bg-white/5 font-mono transition-colors" />
                        <button onClick={handleSubmitTxHash} disabled={submitLoading || !txHash}
                          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 hover:border-white/30">
                          Xác nhận
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.02] border border-[#003087]/30 rounded-3xl p-6 mb-4 backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />
              <div className="text-center mb-6 relative z-10">
                <div className="w-16 h-16 bg-[#003087]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#003087]/40 shadow-lg shadow-[#003087]/20 text-[#0070ba]">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">Thanh toán bằng PayPal</h3>
                <p className="text-gray-400 text-sm mt-1">Đảm bảo an toàn, nhanh chóng và hỗ trợ giải quyết tranh chấp</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 relative z-10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Tổng cộng</span>
                  <span className="text-xl font-bold text-white font-mono">\${Number(order.price_usd).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Phí giao dịch</span>
                  <span className="text-emerald-400">Miễn phí</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    const res = await paymentClient.post('/api/payments/paypal/create-order', { order_id: orderId });
                    const url = res.data.approval_url;
                    if (url) window.location.href = url;
                  } catch (e: any) { toast.error(e.response?.data?.message || 'Tạo đơn PayPal thất bại'); }
                }}
                className="w-full relative overflow-hidden group py-4 bg-gradient-to-r from-[#003087] to-[#0070ba] hover:from-[#002060] hover:to-[#005090] text-white font-bold rounded-2xl text-base transition-all shadow-lg shadow-[#0070ba]/20"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10 block text-center">Đến cổng thanh toán PayPal &rarr;</span>
              </button>
            </motion.div>
          )}

          </div>

          {/* Right Column: Order Summary floating card */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl sticky top-24">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Chi tiết hóa đơn
              </h2>
              
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-6 group">
                {order.product_metadata?.images?.[0] ? (
                  <Image src={order.product_metadata.images[0]} alt={order.product_name} fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-bold text-white text-lg leading-tight line-clamp-2 drop-shadow-md">{order.product_name}</h3>
                  <p className="text-sm text-gray-300 mt-1 line-clamp-1">Trợ lý / Người bán: {order.seller_name}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Số lượng</span>
                  <span className="text-white font-medium bg-white/10 px-3 py-1 rounded-full text-sm">x{order.quantity}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Tạm tính USD</span>
                  <span className="text-white font-mono font-medium">\${Number(order.price_usd).toFixed(2)}</span>
                </div>
                {order.pricing_mode !== 'usd' && (
                  <div className="flex justify-between items-center pb-4 border-b border-white/5">
                    <span className="text-[#f0b90b]/80 text-sm">Báo giá Crypto</span>
                    <span className="text-[#f0b90b] font-mono font-bold">{Number(order.subtotal_token).toFixed(4)} Token</span>
                  </div>
                )}
              </div>

              {/* Escrow badge */}
              <div className="mt-4 flex flex-col gap-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">Escrow Protected</span>
                </div>
                <p className="text-xs text-emerald-400/80 leading-relaxed">
                  Tiền được giữ an toàn trong Smart Contract. Người bán chỉ nhận được thanh toán khi bạn đã nhận hàng thành công.
                </p>
              </div>

              {/* Actions */}
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3">
                <Link href={`/orders/${order.order_id}`} className="w-full">
                  <button className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all shadow-sm">
                    Theo dõi đơn hàng
                  </button>
                </Link>
                <button onClick={handleCancelOrder} disabled={cancelLoading}
                  className="w-full py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2">
                  {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Hủy đơn hàng này
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

