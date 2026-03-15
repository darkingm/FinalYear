'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient, paymentClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Shield, Zap, CreditCard, Wallet,
  Clock, CheckCircle, RefreshCw, AlertCircle, Package,
  Lock, AlertTriangle, Copy, ExternalLink, ChevronDown,
} from 'lucide-react';
import {
  useAccount, useWalletClient, useSwitchChain,
  useBalance, useReadContract, useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { parseUnits, formatUnits, erc20Abi, type Address } from 'viem';
import { getCoinLogo } from '@/lib/utils/coin-logos';
import { ESCROW_CONTRACTS } from '@/lib/web3/config';

/* ─── Types ─────────────────────────────────────────────────── */
interface Order {
  order_id: number; internal_order_id: string; product_id: number;
  product_name: string; quantity: number; price_usd: number;
  token_id?: number | null; amount_token?: number | null; total_amount?: number;
  status: string; payment_method: string | null;
  buyer_name: string; seller_name: string;
  product_metadata: { images?: string[]; category?: string; accepted_tokens?: { crypto?: string[]; fiat?: string[] } };
}

interface CryptoQuote {
  order_id: number; escrow_contract: string; token_address: string;
  chain_id: number; amount_token: number; amount_wei: string;
  calldata: string; token_price: number; expires_at: number;
  seller_wallet?: string;
}

/* ─── Constants ─────────────────────────────────────────────── */
const DEFAULT_TOKENS = ['USDT', 'USDC', 'MATIC', 'ETH', 'BNB'];

const CHAIN_META: Record<number, { name: string; color: string; icon: string; nativeSym: string }> = {
  137:    { name: 'Polygon',        color: '#8247e5', icon: '🔷', nativeSym: 'MATIC' },
  80002:  { name: 'Polygon Amoy',  color: '#8247e5', icon: '🔷', nativeSym: 'MATIC' },
  80001:  { name: 'Mumbai',        color: '#8247e5', icon: '🔷', nativeSym: 'MATIC' },
  42161:  { name: 'Arbitrum',      color: '#12aaff', icon: '⚡', nativeSym: 'ETH'  },
  421614: { name: 'Arbitrum Sep.', color: '#12aaff', icon: '⚡', nativeSym: 'ETH'  },
  56:     { name: 'BNB Chain',     color: '#f0b90b', icon: '🟡', nativeSym: 'BNB'  },
  97:     { name: 'BNB Testnet',   color: '#f0b90b', icon: '🟡', nativeSym: 'tBNB' },
  1:      { name: 'Ethereum',      color: '#627eea', icon: '💎', nativeSym: 'ETH'  },
  11155111: { name: 'Sepolia',     color: '#627eea', icon: '💎', nativeSym: 'ETH'  },
  31337:  { name: 'Localhost',     color: '#22c55e', icon: '🖥️', nativeSym: 'ETH'  },
};

// ERC-20 approve ABI (minimal)
const APPROVE_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

/* ─── Coin Price Hook ────────────────────────────────────────── */
function useCoinPrices(tokens: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!tokens.length) return;
    const fetchPrices = async () => {
      try {
        const stables = new Set(['USDT', 'USDC', 'DAI', 'BUSD']);
        const queryTokens = tokens.filter(t => !stables.has(t));
        if (!queryTokens.length) { setPrices(Object.fromEntries(tokens.map(t => [t, 1]))); return; }
        const syms = queryTokens.map(t => `"${t}USDT"`).join(',');
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=[${syms}]`);
        const data = await res.json();
        const map: Record<string, number> = {};
        tokens.filter(t => stables.has(t)).forEach(t => { map[t] = 1; });
        if (Array.isArray(data)) data.forEach((d: any) => { map[d.symbol.replace('USDT', '')] = parseFloat(d.price); });
        setPrices(map);
      } catch { }
    };
    fetchPrices();
    const iv = setInterval(fetchPrices, 30000);
    return () => clearInterval(iv);
  }, [tokens.join(',')]);
  return prices;
}

/* ─── Token Balance Display ──────────────────────────────────── */
function TokenBalance({ address, tokenAddr, symbol, chainId }: {
  address: Address; tokenAddr?: Address; symbol: string; chainId?: number;
}) {
  const isNative = !tokenAddr || tokenAddr === '0x0000000000000000000000000000000000000000';

  const { data: nativeBal } = useBalance({ address, chainId, query: { enabled: isNative && !!address } });
  const { data: erc20Bal } = useReadContract({
    address: tokenAddr as Address, abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !isNative && !!tokenAddr && !!address },
  });
  const { data: decimals } = useReadContract({
    address: tokenAddr as Address, abi: erc20Abi, functionName: 'decimals',
    query: { enabled: !isNative && !!tokenAddr },
  });

  const bal = isNative
    ? nativeBal ? parseFloat(nativeBal.formatted).toFixed(4) : '...'
    : erc20Bal !== undefined && decimals !== undefined
      ? parseFloat(formatUnits(erc20Bal as bigint, decimals as number)).toFixed(4)
      : '...';

  return (
    <span className="font-mono font-bold text-emerald-400">{bal} {symbol}</span>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params?.orderId === 'string' ? parseInt(params.orderId, 10) : 0;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'crypto' | 'paypal'>('crypto');
  const [selectedToken, setSelectedToken] = useState('USDT');
  const [quote, setQuote] = useState<CryptoQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'approve' | 'sending' | 'done'>('idle');
  const [step, setStep] = useState(1);
  const [showAddresses, setShowAddresses] = useState(false);

  const acceptedCrypto = order?.product_metadata?.accepted_tokens?.crypto || DEFAULT_TOKENS;
  const acceptPayPal = order?.product_metadata?.accepted_tokens?.fiat?.includes('paypal') ?? true;
  const coinPrices = useCoinPrices(acceptedCrypto);

  // Is current chain correct for the quote?
  const isWrongChain = quote && chainId !== undefined && chainId !== quote.chain_id;
  const quoteChainMeta = quote ? (CHAIN_META[quote.chain_id] || { name: `Chain ${quote.chain_id}`, color: '#888', icon: '🔗', nativeSym: 'ETH' }) : null;
  const currentChainMeta = chainId ? CHAIN_META[chainId] : null;
  const isNativePayment = !quote?.token_address || quote?.token_address === '0x0000000000000000000000000000000000000000';

  // Allowance check for ERC-20
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: quote?.token_address as Address,
    abi: APPROVE_ABI,
    functionName: 'allowance',
    args: address && quote ? [address, quote.escrow_contract as Address] : undefined,
    query: { enabled: !!quote && !isNativePayment && !!address && !isWrongChain },
  });
  const { data: tokenDecimals } = useReadContract({
    address: quote?.token_address as Address,
    abi: APPROVE_ABI,
    functionName: 'decimals',
    query: { enabled: !!quote && !isNativePayment },
  });

  const needsApprove = !isNativePayment && allowance !== undefined && tokenDecimals !== undefined
    && (allowance as bigint) < BigInt(quote?.amount_wei || '0');

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
    if (!isConnected || !address) { toast.error('Vui lòng kết nối ví MetaMask trước'); return; }
    setQuote(null); setQuoteError(null); setQuoteLoading(true);
    try {
      const res = await paymentClient.post('/api/payments/crypto/quote', {
        order_id: orderId, token_symbol: selectedToken, buyer_wallet: address,
      });
      setQuote(res.data.quote);
      setStep(3);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Lấy báo giá thất bại';
      setQuoteError(msg); toast.error(msg);
    } finally { setQuoteLoading(false); }
  };

  // Step 1: Switch to correct chain if needed
  const handleSwitchChain = async () => {
    if (!quote) return;
    try {
      await switchChainAsync({ chainId: quote.chain_id });
      toast.success(`Đã chuyển sang ${quoteChainMeta?.name}`);
    } catch (e: any) {
      toast.error('Không thể chuyển mạng. Vui lòng đổi thủ công trong MetaMask');
    }
  };

  // Step 2: Approve ERC-20 spend
  const handleApprove = async () => {
    if (!quote || !address) return;
    setPayStep('approve');
    try {
      const hash = await writeContractAsync({
        address: quote.token_address as Address,
        abi: APPROVE_ABI,
        functionName: 'approve',
        args: [quote.escrow_contract as Address, BigInt(quote.amount_wei)],
        chainId: quote.chain_id,
      });
      toast.loading('Đang xác nhận Approve...', { id: 'approve' });
      // Wait a bit then refetch allowance
      await new Promise(r => setTimeout(r, 3000));
      await refetchAllowance();
      toast.success('Đã Approve token thành công!', { id: 'approve' });
      setPayStep('idle');
    } catch (e: any) {
      const msg = e.shortMessage || e.message || 'Approve thất bại';
      if (e.code === 4001 || msg.includes('rejected')) toast.info('Bạn đã hủy Approve');
      else toast.error(msg);
      setPayStep('idle');
    }
  };

  // Step 3: Send transaction
  const handlePayWithMetaMask = async () => {
    if (!quote || !walletClient || !address) { toast.error('Kết nối ví MetaMask'); return; }
    if (isWrongChain) { await handleSwitchChain(); return; }

    setSubmitLoading(true); setPayStep('sending');
    try {
      let hash: string;

      if (isNativePayment) {
        // Native token (MATIC, ETH, BNB) — direct send
        const tx = await walletClient.sendTransaction({
          to: quote.escrow_contract as Address,
          data: quote.calldata as `0x${string}`,
          value: BigInt(quote.amount_wei),
          chainId: quote.chain_id,
        });
        hash = typeof tx === 'string' ? tx : (tx as any).hash;
      } else {
        // ERC-20 — call escrow contract with calldata (which includes transferFrom logic)
        const tx = await walletClient.sendTransaction({
          to: quote.escrow_contract as Address,
          data: quote.calldata as `0x${string}`,
          value: 0n,
          chainId: quote.chain_id,
        });
        hash = typeof tx === 'string' ? tx : (tx as any).hash;
      }

      toast.loading('Đang chờ xác nhận on-chain...', { id: 'tx' });
      await paymentClient.post('/api/payments/crypto/submit', { order_id: orderId, tx_hash: hash });
      toast.success('Giao dịch thành công! 🎉', { id: 'tx' });
      setPayStep('done');
      router.push(`/orders/${orderId}`);
    } catch (e: any) {
      const msg = e.shortMessage || e.message || 'Giao dịch thất bại';
      if (e.code === 4001 || msg.includes('rejected')) toast.info('Bạn đã hủy giao dịch');
      else toast.error(msg);
      setPayStep('idle');
    } finally { setSubmitLoading(false); }
  };

  const handleSubmitTxHash = async () => {
    const hash = txHash.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) { toast.error('Tx hash không hợp lệ (phải bắt đầu bằng 0x và có 66 ký tự)'); return; }
    setSubmitLoading(true);
    try {
      await paymentClient.post('/api/payments/crypto/submit', { order_id: orderId, tx_hash: hash });
      toast.success('Đã gửi tx hash! Đơn hàng đang được xác nhận.');
      router.push(`/orders/${orderId}`);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Gửi tx hash thất bại'); }
    finally { setSubmitLoading(false); }
  };

  const handleCancelOrder = async () => {
    setCancelLoading(true);
    try { await apiClient.post(`/api/orders/${orderId}/cancel`); toast.success('Đã hủy đơn hàng'); router.push('/orders'); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Hủy đơn thất bại'); }
    finally { setCancelLoading(false); }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  const quoteTimeLeft = quote ? Math.max(0, Math.floor((quote.expires_at * 1000 - Date.now()) / 1000)) : 0;
  const estimatedToken = coinPrices[selectedToken]
    ? (Number(order?.total_amount || order?.price_usd || 0) / coinPrices[selectedToken]).toFixed(5)
    : '...';

  if (authLoading || loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#f0b90b]/30 border-t-[#f0b90b] rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Đang tải đơn hàng...</p>
      </div>
    </div>
  );

  if (!order || Number.isNaN(orderId)) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Không tìm thấy đơn hàng.</p>
          <Link href="/orders" className="text-primary hover:underline">Về danh sách đơn hàng →</Link>
        </div>
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#f0b90b]/4 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/4 blur-[120px] rounded-full pointer-events-none" />
      <Header />

      <main className="flex-1 py-8 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Back + Title */}
          <div className="flex items-center gap-3 mb-6">
            <Link href={`/products/${order.product_id}`}>
              <button className="p-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-black text-foreground">Thanh toán an toàn</h1>
              <p className="text-xs text-muted-foreground font-mono">#{order.internal_order_id?.split('-')[0]?.toUpperCase()}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Escrow Protected</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            {/* ─── LEFT COLUMN ─── */}
            <div className="space-y-5">

              {/* Progress */}
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
                {[{ id: 1, label: 'Đơn hàng' }, { id: 2, label: 'Phương thức' }, { id: 3, label: 'Thanh toán' }].map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step > s.id ? 'bg-[#f0b90b] text-black' : step === s.id ? 'border-2 border-[#f0b90b] text-[#f0b90b] bg-transparent' : 'bg-muted text-muted-foreground'
                    }`}>
                      {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
                    </div>
                    <span className={`text-xs font-semibold ${step >= s.id ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                    {i < 2 && <div className={`flex-1 h-px mx-2 ${step > s.id ? 'bg-[#f0b90b]' : 'bg-border'}`} />}
                  </div>
                ))}
              </div>

              {/* Order Summary Row */}
              <div className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-center">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  {order.product_metadata?.images?.[0]
                    ? <Image src={order.product_metadata.images[0]} alt={order.product_name} width={64} height={64} className="w-full h-full object-cover" unoptimized />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate">{order.product_name}</h3>
                  <p className="text-sm text-muted-foreground">Người bán: <span className="text-foreground font-medium">{order.seller_name}</span></p>
                  <p className="text-sm text-muted-foreground">Số lượng: {order.quantity}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black text-[#f0b90b]">${Number(order.total_amount || order.price_usd).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">USD</p>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#f0b90b] rounded-full" />
                  Phương thức thanh toán
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setPaymentMethod('crypto'); setStep(2); }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${paymentMethod === 'crypto' ? 'border-[#f0b90b] bg-[#f0b90b]/8' : 'border-border hover:border-[#f0b90b]/50'}`}
                  >
                    <Wallet className={`w-6 h-6 mb-2 ${paymentMethod === 'crypto' ? 'text-[#f0b90b]' : 'text-muted-foreground'}`} />
                    <p className="font-bold text-sm text-foreground">Crypto (Web3)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{acceptedCrypto.join(', ')}</p>
                  </button>
                  <button
                    onClick={() => acceptPayPal && setPaymentMethod('paypal')}
                    disabled={!acceptPayPal}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${!acceptPayPal ? 'opacity-40 cursor-not-allowed' : ''} ${paymentMethod === 'paypal' ? 'border-blue-500 bg-blue-500/8' : 'border-border hover:border-blue-500/50'}`}
                  >
                    <CreditCard className={`w-6 h-6 mb-2 ${paymentMethod === 'paypal' ? 'text-blue-400' : 'text-muted-foreground'}`} />
                    <p className="font-bold text-sm text-foreground">PayPal</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{acceptPayPal ? 'Thẻ tín dụng / PayPal' : 'Không hỗ trợ'}</p>
                  </button>
                </div>
              </div>

              {/* ── CRYPTO PANEL ── */}
              {paymentMethod === 'crypto' && (
                <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-emerald-400 rounded-full" />
                    Chi tiết thanh toán Crypto
                  </h2>

                  {/* Token selector */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Chọn token thanh toán</p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {acceptedCrypto.map(token => (
                        <button key={token} onClick={() => { setSelectedToken(token); setQuote(null); setStep(2); }}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${selectedToken === token ? 'border-[#f0b90b] bg-[#f0b90b]/10' : 'border-border hover:border-[#f0b90b]/40 bg-background/50'}`}
                        >
                          <img src={getCoinLogo(token)} alt={token} className="w-8 h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-coin.png'; }} />
                          <span className={`text-xs font-bold ${selectedToken === token ? 'text-[#f0b90b]' : 'text-muted-foreground'}`}>{token}</span>
                          {coinPrices[token] ? <span className="text-[9px] text-muted-foreground font-mono">${coinPrices[token].toFixed(2)}</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estimated + Wallet Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Estimate */}
                    <div className="p-4 bg-background border border-border rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">Ước tính cần thanh toán</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black font-mono text-foreground">{estimatedToken}</p>
                        <span className="text-sm font-bold text-[#f0b90b]">{selectedToken}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <RefreshCw className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Giá thực từ Binance · cập nhật 30s</span>
                      </div>
                    </div>

                    {/* Wallet panel */}
                    <div className="p-4 bg-background border border-border rounded-xl">
                      {!isConnected ? (
                        <div className="h-full flex flex-col justify-center gap-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Chưa kết nối ví</p>
                          <ConnectButton.Custom>
                            {({ openConnectModal }) => (
                              <button onClick={openConnectModal}
                                className="w-full py-2.5 bg-[#f0b90b] text-black font-bold rounded-xl text-sm hover:bg-[#e6a800] transition-colors flex items-center justify-center gap-2">
                                <Wallet className="w-4 h-4" /> Kết nối ví
                              </button>
                            )}
                          </ConnectButton.Custom>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Ví đang kết nối</p>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                              <span className="text-[10px] text-emerald-400 font-bold">LIVE</span>
                            </div>
                          </div>
                          {/* Address with copy */}
                          <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg border border-border">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#f0b90b] to-[#8247e5] flex-shrink-0" />
                            <p className="font-mono text-sm text-foreground flex-1 truncate">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
                            <button onClick={() => copyToClipboard(address || '', 'địa chỉ ví')} className="text-muted-foreground hover:text-foreground transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Network */}
                          <div className={`flex items-center justify-between p-2.5 rounded-lg border ${currentChainMeta ? `border-${currentChainMeta.color}/30 bg-${currentChainMeta.color}/5` : 'border-border bg-muted/30'}`}
                            style={{ borderColor: currentChainMeta ? `${currentChainMeta.color}40` : undefined }}>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{currentChainMeta?.icon || '🔗'}</span>
                              <span className="text-xs font-medium text-foreground">{currentChainMeta?.name || `Chain ${chainId}`}</span>
                            </div>
                            <ConnectButton.Custom>
                              {({ openChainModal }) => (
                                <button onClick={openChainModal}
                                  className="text-xs text-[#f0b90b] hover:text-[#e6a800] font-semibold flex items-center gap-1">
                                  Đổi mạng <ChevronDown className="w-3 h-3" />
                                </button>
                              )}
                            </ConnectButton.Custom>
                          </div>
                          {/* Balance */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Số dư {selectedToken}</span>
                            <TokenBalance address={address!} symbol={selectedToken} chainId={chainId} />
                          </div>
                          {/* Switch account */}
                          <ConnectButton.Custom>
                            {({ openAccountModal }) => (
                              <button onClick={openAccountModal}
                                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 hover:bg-muted rounded-lg transition-colors text-center">
                                Quản lý / đổi tài khoản ví
                              </button>
                            )}
                          </ConnectButton.Custom>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wrong chain alert */}
                  {isWrongChain && quote && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-amber-300">Sai mạng blockchain!</p>
                          <p className="text-xs text-amber-400/80">
                            MetaMask đang ở <b>{currentChainMeta?.name || chainId}</b>, cần chuyển sang <b>{quoteChainMeta?.name}</b>
                          </p>
                        </div>
                      </div>
                      <button onClick={handleSwitchChain}
                        className="px-4 py-2 bg-amber-500 text-black font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors flex-shrink-0 ml-3">
                        Chuyển ngay
                      </button>
                    </motion.div>
                  )}

                  {/* Get Quote Button */}
                  {!quote && (
                    <button onClick={handleGetQuote} disabled={quoteLoading || !isConnected}
                      className="w-full py-4 bg-gradient-to-r from-[#f0b90b] to-[#f3ba2f] text-black font-black rounded-xl text-base hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20">
                      {quoteLoading ? <><Loader2 className="w-5 h-5 animate-spin" />Đang tạo hóa đơn...</> : <><Shield className="w-5 h-5" />Xác nhận & Lấy hóa đơn</>}
                    </button>
                  )}
                  {!isConnected && !quote && (
                    <p className="text-xs text-center text-amber-400">⚠ Kết nối ví trước khi lấy báo giá</p>
                  )}

                  {/* Quote Error */}
                  {quoteError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {quoteError}
                    </div>
                  )}

                  {/* Quote Result */}
                  {quote && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="border-2 border-[#f0b90b]/40 rounded-2xl overflow-hidden">
                      {/* Quote header */}
                      <div className="bg-[#f0b90b]/10 border-b border-[#f0b90b]/20 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-[#f0b90b]" />
                          <span className="font-bold text-[#f0b90b] text-sm">Smart Contract Invoice</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                          <Clock className="w-3 h-3 text-red-400" />
                          <span className="text-xs font-bold text-red-400 font-mono">
                            {Math.floor(quoteTimeLeft / 60)}:{(quoteTimeLeft % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Amount to pay */}
                        <div className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-border">
                          <p className="text-muted-foreground text-sm font-medium">Cần thanh toán</p>
                          <div className="text-right">
                            <p className="text-2xl font-black font-mono text-foreground">{quote.amount_token.toFixed(6)}</p>
                            <p className="text-sm font-bold text-[#f0b90b]">{selectedToken}</p>
                          </div>
                        </div>

                        {/* Addresses & Chain info */}
                        <div className="space-y-2">
                          <button onClick={() => setShowAddresses(v => !v)}
                            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                            <span className="font-semibold uppercase tracking-wider">Chi tiết địa chỉ & mạng</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showAddresses ? 'rotate-180' : ''}`} />
                          </button>

                          <AnimatePresence>
                            {showAddresses && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden space-y-2">
                                {/* Chain */}
                                <div className="flex items-center justify-between p-3 bg-background/50 border border-border rounded-xl">
                                  <p className="text-xs text-muted-foreground">Mạng blockchain</p>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ background: quoteChainMeta?.color }} />
                                    <span className="text-sm font-bold text-foreground">{quoteChainMeta?.name}</span>
                                  </div>
                                </div>
                                {/* Escrow contract = Recipient */}
                                <div className="p-3 bg-background/50 border border-border rounded-xl">
                                  <p className="text-xs text-muted-foreground mb-1">Địa chỉ nhận (Smart Contract Escrow)</p>
                                  <div className="flex items-center gap-2">
                                    <p className="font-mono text-xs text-foreground flex-1 break-all">{quote.escrow_contract}</p>
                                    <button onClick={() => copyToClipboard(quote.escrow_contract, 'địa chỉ escrow')} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> Tiền không đến thẳng người bán. Escrow giữ đến khi hoàn tất.
                                  </p>
                                </div>
                                {/* Token address */}
                                {!isNativePayment && (
                                  <div className="p-3 bg-background/50 border border-border rounded-xl">
                                    <p className="text-xs text-muted-foreground mb-1">Địa chỉ token ({selectedToken})</p>
                                    <div className="flex items-center gap-2">
                                      <p className="font-mono text-xs text-foreground flex-1 break-all">{quote.token_address}</p>
                                      <button onClick={() => copyToClipboard(quote.token_address, 'địa chỉ token')} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {/* Your wallet */}
                                <div className="p-3 bg-background/50 border border-border rounded-xl">
                                  <p className="text-xs text-muted-foreground mb-1">Ví của bạn (người gửi)</p>
                                  <p className="font-mono text-xs text-foreground break-all">{address}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* ERC-20 Approve step */}
                        {needsApprove && !isWrongChain && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <p className="text-sm font-bold text-amber-300 mb-1">Bước 1: Authorize Token</p>
                            <p className="text-xs text-amber-400/80 mb-3">
                              Cần approve hợp đồng escrow chi tiêu {quote.amount_token.toFixed(6)} {selectedToken} từ ví bạn.
                              Đây là bước bắt buộc cho ERC-20 token (chỉ làm 1 lần cho lần đầu).
                            </p>
                            <button onClick={handleApprove} disabled={payStep === 'approve'}
                              className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl text-sm hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                              {payStep === 'approve' ? <><Loader2 className="w-4 h-4 animate-spin" />Đang Approve...</> : <>✅ Approve {selectedToken}</>}
                            </button>
                          </div>
                        )}

                        {/* Pay button */}
                        {isWrongChain ? (
                          <button onClick={handleSwitchChain}
                            className="w-full py-4 bg-amber-500 text-black font-black rounded-xl text-base hover:bg-amber-400 transition-colors flex items-center justify-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Chuyển sang {quoteChainMeta?.name}
                          </button>
                        ) : needsApprove ? (
                          <p className="text-center text-xs text-muted-foreground py-2">Hoàn tất Approve ở trên trước khi thanh toán</p>
                        ) : (
                          <button onClick={handlePayWithMetaMask}
                            disabled={submitLoading || !isConnected || !walletClient || payStep === 'approve'}
                            className="w-full py-4 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-black rounded-xl text-base transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20">
                            {submitLoading ? <><Loader2 className="w-5 h-5 animate-spin" />Đang xử lý giao dịch...</>
                              : payStep === 'done' ? <><CheckCircle className="w-5 h-5" />Hoàn tất!</>
                              : <><Wallet className="w-5 h-5" />Ký & Thanh toán qua MetaMask</>}
                          </button>
                        )}

                        {/* Manual tx hash */}
                        <div className="relative flex items-center">
                          <div className="flex-grow border-t border-border" />
                          <span className="mx-4 text-xs text-muted-foreground whitespace-nowrap">Hoặc nhập Tx Hash thủ công</span>
                          <div className="flex-grow border-t border-border" />
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="0x... (transaction hash)" value={txHash}
                            onChange={e => setTxHash(e.target.value)}
                            className="flex-1 px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/50 transition-colors" />
                          <button onClick={handleSubmitTxHash} disabled={submitLoading || !txHash}
                            className="px-4 py-2.5 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            Xác nhận
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── PAYPAL PANEL ── */}
              {paymentMethod === 'paypal' && acceptPayPal && (
                <div className="bg-card border border-[#003087]/30 rounded-2xl p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-[#003087]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#003087]/30">
                      <CreditCard className="w-8 h-8 text-[#0070ba]" />
                    </div>
                    <h3 className="text-lg font-bold">Thanh toán PayPal</h3>
                    <p className="text-sm text-muted-foreground mt-1">An toàn, nhanh chóng, hỗ trợ tranh chấp</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-background border border-border rounded-xl mb-4">
                    <span className="text-muted-foreground">Tổng cộng</span>
                    <span className="text-xl font-black">${Number(order.price_usd).toFixed(2)} USD</span>
                  </div>
                  <button onClick={async () => {
                    try {
                      const res = await paymentClient.post('/api/payments/paypal/create-order', { order_id: orderId });
                      if (res.data.approval_url) window.location.href = res.data.approval_url;
                    } catch (e: any) { toast.error(e.response?.data?.message || 'Tạo đơn PayPal thất bại'); }
                  }}
                    className="w-full py-4 bg-gradient-to-r from-[#003087] to-[#0070ba] text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
                    Đến cổng thanh toán PayPal →
                  </button>
                </div>
              )}
            </div>

            {/* ─── RIGHT SIDEBAR ─── */}
            <div>
              <div className="bg-card border border-border rounded-2xl p-5 sticky top-24 space-y-4">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Chi tiết hóa đơn
                </h2>

                {/* Product image */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted">
                  {order.product_metadata?.images?.[0]
                    ? <Image src={order.product_metadata.images[0]} alt={order.product_name} fill className="object-cover" unoptimized />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-muted-foreground" /></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="font-bold text-white text-sm leading-tight line-clamp-2">{order.product_name}</p>
                    <p className="text-xs text-white/70 mt-0.5">Người bán: {order.seller_name}</p>
                  </div>
                </div>

                {/* Invoice lines */}
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Số lượng', value: `x${order.quantity}` },
                    { label: 'Giá sản phẩm', value: `$${Number(order.price_usd).toFixed(2)}` },
                    { label: 'Phí giao dịch', value: '~Miễn phí', green: true },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center pb-3 border-b border-border">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={`font-semibold ${row.green ? 'text-emerald-400' : 'text-foreground'}`}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold text-foreground">Tổng thanh toán</span>
                    <span className="text-xl font-black text-[#f0b90b]">${Number(order.total_amount || order.price_usd).toFixed(2)}</span>
                  </div>
                </div>

                {/* Escrow info */}
                <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">Escrow bảo vệ 100%</span>
                  </div>
                  <p className="text-xs text-emerald-400/70 leading-relaxed">
                    Tiền giữ trong Smart Contract. Người bán chỉ nhận được khi bạn xác nhận đã nhận hàng.
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Link href={`/orders/${order.order_id}`} className="block">
                    <button className="w-full py-3 bg-muted border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted/80 transition-colors">
                      Theo dõi đơn hàng
                    </button>
                  </Link>
                  <button onClick={handleCancelOrder} disabled={cancelLoading}
                    className="w-full py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Hủy đơn hàng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
