'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Shield, Wallet,
  CheckCircle, Package, Lock, Info, CreditCard, AlertTriangle,
} from 'lucide-react';
import {
  useAccount, useWalletClient, useSwitchChain,
  useReadContract, useWriteContract, useBalance,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { type Address } from 'viem';
import { CoinImage } from '@/components/ui/CoinImage';
import { TokenAmountInline, UsdtAmountInline } from '@/components/checkout/CheckoutPriceValue';
import { PAYMENT_NETWORKS, CHAIN_TOKENS, CHAIN_META } from '@/lib/web3/config';
import { useCartStore } from '@/store/cart-store';
import {
  createPaymentBatchSession,
  getPaymentBatchSessionQuote,
  submitPaymentBatchSessionTransaction,
  getPaymentBatchSessionStatus,
  type PaymentBatchSession,
} from '@/lib/payments/payment-batch-session';
import {
  buildLockedCartPreviewItems,
  getLockedCartTotalUsd,
  type CartOrderSnapshot,
  type LockedCartPreviewItem,
} from '@/lib/payments/cart-pricing';
import { paymentPageTheme, getPaymentAccentPanelClass } from '@/lib/payments/payment-page-theme';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';
import { ensureCorrectChainRpc } from '@/lib/web3/ensure-chain';

/* ─── Types ────────────────────────────────────────────────────────────── */
interface CryptoQuoteBatch {
  order_ids: number[];
  escrow_contract: string;
  token_address: string;
  chain_id: number;
  amount_token_total: number;
  amount_wei_total: string;
  amounts_wei_split: string[];
  calldata: string;
  token_price: number;
  expires_at: number;
}

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

/* ─── Hooks ─────────────────────────────────────────────────────────────── */
function useCoinPrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    if (!symbol) return;
    const stables = new Set(['USDT', 'USDC', 'DAI', 'BUSD']);
    if (stables.has(symbol)) { setPrice(1); return; }
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`)
      .then(r => r.json())
      .then(d => d.price && setPrice(parseFloat(d.price)))
      .catch(() => { });
  }, [symbol]);
  return price;
}

/* ─── UI Sub-components ──────────────────────────────────────────────── */
function NetworkBadge({ net }: { net: typeof PAYMENT_NETWORKS[0] }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[net.badgeColor] || colors.emerald}`}>
      {net.badge}
    </span>
  );
}

function Steps({ current }: { current: number }) {
  const steps = ['Xem giỏ hàng', 'Chọn mạng & token', 'Ký & Thanh toán'];
  return (
    <div className={`${paymentPageTheme.secondarySurface} flex items-center gap-2 p-4`}>
      {steps.map((label, i) => {
        const id = i + 1;
        const done = current > id;
        const active = current === id;
        return (
          <div key={id} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${done ? 'bg-[#8247e5] text-white' : active ? 'border-2 border-[#8247e5] text-[#8247e5]' : 'bg-muted text-muted-foreground'
              }`}>
              {done ? <CheckCircle className="w-4 h-4" /> : id}
            </div>
            <span className={`text-xs font-semibold truncate ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-[#8247e5]' : 'bg-border'}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function CartCheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, reauthRequired } = useAuth();
  const { items, getTotal, getTotalItems, clearCart } = useCartStore();
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [loading, setLoading] = useState(true);
  const [selectedNet, setSelectedNet] = useState<number>(31337);
  const [selectedToken, setSelectedToken] = useState('ETH');

  const [quote, setQuote] = useState<CryptoQuoteBatch | null>(null);
  const [createdOrderIds, setCreatedOrderIds] = useState<number[]>([]);
  const [createdOrderSnapshots, setCreatedOrderSnapshots] = useState<CartOrderSnapshot[]>([]);
  const [lockedCartItems, setLockedCartItems] = useState<LockedCartPreviewItem[]>([]);
  const [paymentBatchSession, setPaymentBatchSession] = useState<PaymentBatchSession | null>(null);

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [payStep, setPayStep] = useState<'idle' | 'approve' | 'sending' | 'done'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Guard: must be authenticated; if cart is empty, go back
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push(buildLoginRedirectUrl('/checkout/cart', reauthRequired ? 'reauth_required' : undefined));
      return;
    }
    if (items.length === 0 && createdOrderIds.length === 0) { router.push('/cart'); return; }
    setLoading(false);
  }, [isAuthenticated, authLoading, items.length, createdOrderIds.length, router, reauthRequired]);

  // Quote countdown timer
  useEffect(() => {
    if (!quote) return;
    const update = () => setTimeLeft(Math.max(0, Math.floor((quote.expires_at * 1000 - Date.now()) / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [quote]);

  const acceptedCrypto = ['ETH', 'MATIC', 'USDT', 'USDC'];
  const coinPrice = useCoinPrice(selectedToken);

  const quoteNet = quote ? CHAIN_META[quote.chain_id] : null;
  const isWrongChain = !!quote && !!chainId && chainId !== quote.chain_id;
  const isNative = !quote?.token_address
    || quote.token_address === '0x0000000000000000000000000000000000000000'
    || quote.token_address === '0x0000000000000000000000000000000000001010';

  const chainSupportedTokens = CHAIN_TOKENS[selectedNet] || ['ETH'];
  const availableTokens = acceptedCrypto.filter(t => chainSupportedTokens.includes(t));
  const tokensToShow = availableTokens.length > 0 ? availableTokens : chainSupportedTokens;

  // Auto-correct token when chain changes
  useEffect(() => {
    if (!tokensToShow.includes(selectedToken)) {
      setSelectedToken(tokensToShow[0] || 'ETH');
      setQuote(null);
      setPaymentBatchSession(null);
    }
  }, [selectedNet]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Native Balance Check */
  const { data: nativeBalance } = useBalance({
    address: address,
    chainId: quote?.chain_id,
    query: { enabled: !!address && !!quote },
  });

  /* ERC-20 allowance */
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: quote?.token_address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && quote ? [address, quote.escrow_contract as Address] : undefined,
    query: { enabled: !!quote && !isNative && !!address && !isWrongChain },
  });
  const { data: tokenDecimals } = useReadContract({
    address: quote?.token_address as Address,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!quote && !isNative },
  });
  const needsApprove = !isNative
    && allowance !== undefined
    && tokenDecimals !== undefined
    && (allowance as bigint) < BigInt(quote?.amount_wei_total || '0');

  /* ─── Handlers ─────────────────────────────────────────────────────── */
  const handleGetQuote = async () => {
    if (!isConnected || !address) { toast.error('Kết nối ví MetaMask trước'); return; }
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(true);
    let orderIdsToQuote = createdOrderIds;

    try {
      // Step A: Create orders in DB if not already done
      if (orderIdsToQuote.length === 0) {
        toast.loading('Đang tạo đơn hàng...', { id: 'create-orders' });
        const resCreate = await apiClient.post('/api/orders/checkout/cart', {
          items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        });

        if (!resCreate.data.success || !resCreate.data.orders?.length) {
          throw new Error(resCreate.data.message || 'Không thể tạo đơn hàng từ giỏ hàng');
        }

        const createdOrders = Array.isArray(resCreate.data.orders) ? resCreate.data.orders : [];
        orderIdsToQuote = createdOrders.map((o: any) => o.order_id);
        setLockedCartItems(buildLockedCartPreviewItems(items, createdOrders));
        setCreatedOrderSnapshots(createdOrders);
        setCreatedOrderIds(orderIdsToQuote);
        toast.success(`Đã tạo ${orderIdsToQuote.length} đơn hàng!`, { id: 'create-orders' });
        clearCart(); // Cart items are now locked as DB orders
      }

      // Step B: Get batch crypto quote
      toast.loading('Đang lấy báo giá gộp...', { id: 'quote' });
      const session = await createPaymentBatchSession({
        orderIds: orderIdsToQuote,
        tokenSymbol: selectedToken,
        buyerWallet: address,
        preferredChainId: selectedNet,
      });
      const q = await getPaymentBatchSessionQuote({
        sessionId: session.session_id,
        nonce: session.nonce,
      }) as CryptoQuoteBatch;

      setPaymentBatchSession(session);
      setQuote(q);
      setStep(3);
      toast.success('Báo giá sẵn sàng!', { id: 'quote' });

      // Auto-switch chain in MetaMask
      if (chainId !== q.chain_id) {
        try {
          await switchChainAsync({ chainId: q.chain_id });
        } catch {
          const chainName = CHAIN_META[q.chain_id]?.name || `Chain ${q.chain_id}`;
          toast.info(`Vui lòng chuyển sang ${chainName} trong MetaMask`);
        }
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Lấy báo giá thất bại';
      setQuoteError(msg);
      toast.error(msg, { id: 'quote' });
      toast.dismiss('create-orders');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSwitchChain = async () => {
    if (!quote) return;
    try { await switchChainAsync({ chainId: quote.chain_id }); }
    catch { toast.error('Chuyển mạng thất bại — đổi thủ công trong MetaMask'); }
  };

  const handleApprove = async () => {
    if (!quote || !address) return;
    if (nativeBalance && Number(nativeBalance.formatted) < 0.001) {
      toast.error('Giao dịch thất bại! Bạn cần tối thiểu 0.001 MATIC/BNB/ETH trong ví để làm phí Gas chuyển mạng.');
      return;
    }
    setPayStep('approve');
    try {
      await writeContractAsync({
        address: quote.token_address as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [quote.escrow_contract as Address, BigInt(quote.amount_wei_total)],
        chainId: quote.chain_id,
      });
      toast.loading('Đang chờ Approve...', { id: 'approve' });
      await new Promise(r => setTimeout(r, 4000));
      await refetchAllowance();
      toast.success('Approve thành công!', { id: 'approve' });
    } catch (e: any) {
      const msg = e.shortMessage || e.message || '';
      if (e.code === 4001 || msg.includes('rejected')) toast.info('Đã hủy Approve');
      else toast.error(`Approve thất bại: ${msg}`);
    } finally {
      setPayStep('idle');
    }
  };

  const handlePay = async () => {
    if (!quote || !paymentBatchSession || !walletClient || !address) { toast.error('Kết nối ví'); return; }
    if (isWrongChain) { await handleSwitchChain(); return; }
    if (timeLeft === 0) {
      toast.error('Báo giá đã hết hạn — lấy lại báo giá');
      setQuote(null);
      setPaymentBatchSession(null);
      setStep(2);
      return;
    }
    if (nativeBalance && Number(nativeBalance.formatted) < 0.001) {
      toast.error('Giao dịch thất bại! Bạn cần tối thiểu 0.001 MATIC/BNB/ETH trong ví để làm phí Gas chuyển mạng.');
      return;
    }

    setSubmitting(true);
    setPayStep('sending');
    // Ensure MetaMask has correct RPC for this chain (fixes stale localhost cache)
    await ensureCorrectChainRpc(quote.chain_id);
    try {
      const tx = await walletClient.sendTransaction({
        to: quote.escrow_contract as Address,
        data: quote.calldata as `0x${string}`,
        value: isNative ? BigInt(quote.amount_wei_total) : 0n,
        chainId: quote.chain_id,
      });
      const hash = typeof tx === 'string' ? tx : (tx as any).hash;

      toast.loading('Đã gửi giao dịch, đang chờ xác nhận on-chain...', { id: 'tx' });
      setTxHash(hash);

      await submitPaymentBatchSessionTransaction({
        sessionId: paymentBatchSession.session_id,
        nonce: paymentBatchSession.nonce,
        txHash: hash,
      });

      // Poll for on-chain confirmation instead of immediately marking done
      setPayStep('sending'); // keep spinner visible
      setSubmitting(false);

      const maxWaitMs = 120_000;
      const pollStart = Date.now();
      let pollCount = 0;

      const poll = async (): Promise<void> => {
        if (Date.now() - pollStart > maxWaitMs) {
          // Timeout — let user know it's still processing
          toast.info('Vẫn đang xác nhận... Kiểm tra trang đơn hàng.', { id: 'tx', duration: 8000 });
          setPayStep('done');
          setConfirmed(true); // allow user to navigate away
          return;
        }
        try {
          const statusRes = await getPaymentBatchSessionStatus({
            sessionId: paymentBatchSession.session_id,
            nonce: paymentBatchSession.nonce,
          });
          const verState = statusRes?.status?.verification_state || statusRes?.verification_state;
          const sessionStatus = statusRes?.status?.status || statusRes?.session_status;

          if (verState === 'confirmed' || sessionStatus === 'PAID' || sessionStatus === 'ONCHAIN_CONFIRMED') {
            toast.success('Thanh toán batch đã xác nhận on-chain! 🎉', { id: 'tx' });
            setPayStep('done');
            setConfirmed(true);
            return;
          }

          if (verState === 'failed' || sessionStatus === 'TX_FAILED') {
            toast.error('Giao dịch thất bại trên blockchain.', { id: 'tx' });
            setPayStep('idle');
            return;
          }
        } catch (pollErr: any) {
          console.warn('[cart poll] error:', pollErr?.message || pollErr);
          if (pollCount > 3 && pollErr?.message) {
            toast.error(`Kiểm tra blockchain gặp lỗi: ${pollErr.message}`, { id: 'poll-error', duration: 5000 });
          }
        }

        pollCount++;
        const delay = Math.min(3000 + pollCount * 500, 8000);
        await new Promise(r => setTimeout(r, delay));
        return poll();
      };

      poll().catch(() => { setPayStep('done'); setConfirmed(true); });

    } catch (e: any) {
      const msg = e.shortMessage || e.message || 'Giao dịch thất bại';
      if (e.code === 4001 || msg.includes('rejected')) toast.info('Đã hủy giao dịch');
      else toast.error(msg);
      setPayStep('idle');
      setSubmitting(false);
    }
  };

  /* ─── Render guards ─────────────────────────────────────────────────── */
  if (authLoading || loading) {
    return (
      <div className={`${paymentPageTheme.pageShell} items-center justify-center gap-4`}>
        <Loader2 className="w-10 h-10 text-[#8247e5] animate-spin" />
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  const previewItems = lockedCartItems.length > 0
    ? lockedCartItems
    : buildLockedCartPreviewItems(items, createdOrderSnapshots);
  const totalUSD = lockedCartItems.length > 0
    ? lockedCartItems.reduce((sum, item) => sum + item.lockedUsdAmount, 0)
    : getLockedCartTotalUsd(items, createdOrderSnapshots) || getTotal();
  const selectedTokenPrice = quote?.token_price || coinPrice || null;
  const estimatedCrypto = selectedTokenPrice ? (totalUSD / selectedTokenPrice).toFixed(6) : '...';
  const displayItems = previewItems.length > 0 ? previewItems : [];
  const orderCount = createdOrderIds.length > 0 ? createdOrderIds.length : items.length;

  return (
    <div className={paymentPageTheme.pageShell}>
      <Header />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href="/cart">
              <button className={`p-2 rounded-xl transition-colors ${paymentPageTheme.ghostButton}`}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-black">Thanh toán giỏ hàng</h1>
              <p className="text-xs text-muted-foreground font-mono">{orderCount} sản phẩm</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <Package className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-bold text-purple-400">Batch Checkout</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

            {/* ─── LEFT COLUMN ─── */}
            <div className="space-y-5">
              <Steps current={step} />

              {/* Cart Summary Bar (always visible, clickable to go back) */}
              <div
                className={`${paymentPageTheme.secondarySurface} p-4 flex gap-4 items-center cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/5`}
                onClick={() => step > 1 && setStep(1)}
                role="button"
                tabIndex={0}
              >
                <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm">
                    {createdOrderIds.length > 0
                      ? `${createdOrderIds.length} đơn hàng đã tạo`
                      : `${items.length} sản phẩm trong giỏ`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getTotalItems()} items · {selectedToken} trên {CHAIN_META[selectedNet]?.name || 'Hardhat'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black text-[#8247e5]">${totalUSD.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">USD</p>
                </div>
              </div>

              {/* ── STEP 1: Chọn phương thức thanh toán ── */}
              {step === 1 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`${paymentPageTheme.secondarySurface} p-5 space-y-4`}>
                  <h2 className="font-bold flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-5 bg-[#8247e5] rounded-full" />
                    Chọn phương thức thanh toán
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setStep(2)}
                      className="p-4 rounded-xl border-2 border-[#8247e5] bg-[#8247e5]/10 text-left hover:bg-[#8247e5]/15 transition-colors"
                    >
                      <Wallet className="w-6 h-6 mb-2 text-[#8247e5]" />
                      <p className="font-bold text-sm">Crypto (Web3)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Thanh toán gộp — 1 giao dịch cho nhiều người bán</p>
                    </button>
                    <button
                      disabled
                      className="p-4 rounded-xl border-2 border-border opacity-50 cursor-not-allowed text-left"
                    >
                      <CreditCard className="w-6 h-6 mb-2 text-muted-foreground" />
                      <p className="font-bold text-sm">PayPal / Fiat</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Thanh toán gộp chưa hỗ trợ</p>
                    </button>
                  </div>

                  {/* Cart Items Preview */}
                  {displayItems.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sản phẩm trong giỏ</p>
                      {displayItems.map(item => (
                        <div key={item.cart_item_id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-white/5">
                          <div
                            className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 bg-cover bg-center flex-shrink-0"
                            style={{ backgroundImage: `url(${item.image_url || item.metadata?.images?.[0]})` }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                          </div>
                          <p className="text-sm font-bold text-[#8247e5] flex-shrink-0">
                            ${item.lockedUsdAmount.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── STEP 2: Chọn mạng & token ── */}
              {step === 2 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`${paymentPageTheme.secondarySurface} p-5 space-y-5`}>
                  <h2 className="font-bold flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-5 bg-emerald-400 rounded-full" />
                    Chọn mạng & token
                    <button onClick={() => setStep(1)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                      ← Quay lại
                    </button>
                  </h2>

                  {/* Network selector */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mạng blockchain</p>
                    <div className="space-y-2">
                      {PAYMENT_NETWORKS.map(net => (
                        <button
                          key={net.chainId}
                          onClick={() => { setSelectedNet(net.chainId); setQuote(null); setPaymentBatchSession(null); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedNet === net.chainId
                            ? 'border-[#8247e5]/60 bg-[#8247e5]/10'
                            : 'border-border hover:border-[#8247e5]/30'
                            }`}
                        >
                          <span className="text-xl flex-shrink-0">{net.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{net.name}</span>
                              <NetworkBadge net={net} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{net.description}</p>
                          </div>
                          {selectedNet === net.chainId && <CheckCircle className="w-4 h-4 text-[#8247e5] flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Token selector */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Token thanh toán</p>
                    <div className="flex flex-wrap gap-2">
                      {tokensToShow.map(token => (
                        <button
                          key={token}
                          onClick={() => { setSelectedToken(token); setQuote(null); setPaymentBatchSession(null); }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${selectedToken === token
                            ? 'border-[#8247e5] bg-[#8247e5]/10 text-[#8247e5]'
                            : 'border-border hover:border-[#8247e5]/40 text-foreground'
                            }`}
                        >
                          <CoinImage symbol={token} size={20} />
                          <span className="text-sm font-bold">{token}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estimated amount */}
                  <div className={`${paymentPageTheme.subSurface} p-4 flex items-center justify-between`}>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Ước tính cần trả</p>
                      <TokenAmountInline amount={estimatedCrypto} symbol={selectedToken} size="lg" amountClassName="text-[#8247e5]" />
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <span aria-hidden="true">≈</span>
                        <UsdtAmountInline amount={totalUSD} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Wallet connection */}
                  <div className={`${paymentPageTheme.subSurface} p-4`}>
                    {!isConnected ? (
                      <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                          <button
                            onClick={openConnectModal}
                            className="w-full py-2.5 bg-[#8247e5] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-[#6e37c5] transition-colors"
                          >
                            <Wallet className="w-4 h-4" /> Kết nối MetaMask
                          </button>
                        )}
                      </ConnectButton.Custom>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <p className="text-xs text-emerald-400 font-semibold">Đã kết nối</p>
                        <p className="ml-auto font-mono text-xs text-muted-foreground">
                          {address?.slice(0, 8)}...{address?.slice(-4)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Get Quote Button */}
                  <button
                    onClick={handleGetQuote}
                    disabled={quoteLoading || !isConnected}
                    className="w-full py-4 bg-[#8247e5] text-white font-black rounded-xl text-base hover:bg-[#723bc9] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                  >
                    {quoteLoading
                      ? <><Loader2 className="w-5 h-5 animate-spin" />Đang tạo đơn & lấy báo giá...</>
                      : <><Shield className="w-5 h-5" />Xác nhận & Lấy báo giá</>}
                  </button>

                  {quoteError && (
                    <div className={`${getPaymentAccentPanelClass('red')} flex gap-2 p-3 rounded-xl text-sm text-red-500 dark:text-red-400`}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>{quoteError}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── STEP 3: Thanh toán ── */}
              {step === 3 && quote && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`${paymentPageTheme.secondarySurface} p-5 space-y-4`}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold flex items-center gap-2 text-sm">
                      <Lock className="w-4 h-4 text-[#8247e5]" />
                      Thanh toán – {quoteNet?.name || `Chain ${quote.chain_id}`}
                    </h2>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold font-mono ${timeLeft < 60
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-muted-foreground'
                      }`}>
                      ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  </div>

                  {/* Amount display */}
                  <div className={`${paymentPageTheme.subSurface} p-4 flex items-end justify-between`}>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Tổng thanh toán gộp ({quote.order_ids.length} đơn hàng)
                      </p>
                      <TokenAmountInline amount={quote.amount_token_total.toFixed(6)} symbol={selectedToken} size="lg" amountClassName="text-[#8247e5]" />
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span aria-hidden="true">≈</span>
                        <UsdtAmountInline amount={totalUSD} size="sm" />
                      </div>
                      {quote.token_price > 0 && (
                        <div className="flex items-center gap-1.5">
                          <TokenAmountInline amount="1" symbol={selectedToken} size="sm" />
                          <span className="text-muted-foreground/70">=</span>
                          <UsdtAmountInline amount={quote.token_price} size="sm" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Confirmed state */}
                  {confirmed && txHash ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-4 py-4">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                      </div>
                      <h3 className="text-2xl font-black text-emerald-400">Thanh toán thành công! 🎉</h3>

                      {/* TX Hash */}
                      <div className={`${paymentPageTheme.subSurface} p-3 text-left space-y-1`}>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mã giao dịch (TX Hash)</p>
                        <p className="text-xs text-foreground font-mono break-all">{txHash}</p>
                      </div>

                      {/* Escrow contract */}
                      {quote?.escrow_contract && (
                        <div className={`${paymentPageTheme.subSurface} p-3 text-left space-y-1`}>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Escrow Contract</p>
                          <p className="text-xs text-foreground font-mono break-all">{quote.escrow_contract}</p>
                          <p className="text-[10px] text-muted-foreground">Chain ID: {quote.chain_id}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Link href="/orders">
                          <button className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 text-sm transition-colors">
                            Xem đơn hàng
                          </button>
                        </Link>
                        <Link href="/products">
                          <button className={`w-full py-3 font-semibold rounded-xl text-sm transition-colors ${paymentPageTheme.ghostButton}`}>
                            Tiếp tục mua
                          </button>
                        </Link>
                      </div>
                    </motion.div>
                  ) : isWrongChain ? (
                    <button
                      onClick={handleSwitchChain}
                      className="w-full py-4 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <AlertTriangle className="w-5 h-5" />
                      Chuyển sang {quoteNet?.name || `Chain ${quote.chain_id}`}
                    </button>
                  ) : needsApprove ? (
                    <div className={`${getPaymentAccentPanelClass('amber')} p-4 rounded-xl space-y-2`}>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Bước 1 – Ủy quyền Token</p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                        Cho phép Escrow Contract sử dụng {quote.amount_token_total.toFixed(4)} {selectedToken} từ ví của bạn.
                      </p>
                      <button
                        onClick={handleApprove}
                        disabled={payStep === 'approve'}
                        className="w-full py-2.5 bg-amber-500 text-black font-bold rounded-xl text-sm hover:bg-amber-400 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                      >
                        {payStep === 'approve'
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Đang Approve...</>
                          : `Approve ${selectedToken}`}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handlePay}
                      disabled={submitting || !isConnected || !walletClient}
                      className="w-full py-4 bg-[#8247e5] hover:bg-[#723bc9] text-white font-black rounded-xl text-lg flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting
                        ? <><Loader2 className="w-5 h-5 animate-spin" />Đang xử lý...</>
                        : <><Wallet className="w-5 h-5" />Ký & Thanh toán qua MetaMask</>}
                    </button>
                  )}
                </motion.div>
              )}
            </div>

            {/* ─── RIGHT COLUMN: Sidebar ─── */}
            <div className="hidden lg:block">
              <div className={`${paymentPageTheme.primarySurface} p-6 sticky top-24 space-y-4`}>
                <h4 className="font-bold flex items-center gap-2">
                  <Shield className="text-emerald-500 w-5 h-5" />
                  Bảo vệ 100%
                </h4>
                <p className="text-sm text-muted-foreground">
                  Tất cả thanh toán đi qua Smart Contract Escrow. Tiền chỉ được chuyển đến người bán khi giao hàng thành công.
                </p>
                <div className="space-y-2">
                  {[
                    { label: 'Thanh toán gộp (1 giao dịch)', color: 'text-purple-400' },
                    { label: 'Chia tự động cho nhiều người bán', color: 'text-emerald-400' },
                    { label: 'Hoàn tiền nếu có tranh chấp', color: 'text-blue-400' },
                  ].map(({ label, color }) => (
                    <div key={label} className={`flex items-center gap-2 text-xs ${color}`}>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>
                <div className={`${paymentPageTheme.subSurface} flex items-center gap-2 text-xs ${paymentPageTheme.subtleText} p-2.5`}>
                  <Info className="w-4 h-4 flex-shrink-0" />
                  Powered by EscrowCore Smart Contract
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
