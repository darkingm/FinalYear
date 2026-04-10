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
  CheckCircle, AlertCircle, Package, Lock, AlertTriangle,
  Copy, ChevronDown, RefreshCw, ExternalLink, Info,
} from 'lucide-react';
import {
  useAccount, useWalletClient, useSwitchChain,
  useReadContract, useWriteContract, usePublicClient, useBalance,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { parseUnits, formatUnits, erc20Abi, type Address } from 'viem';
import { CoinImage } from '@/components/ui/CoinImage';
import { ESCROW_CONTRACTS, DEFAULT_CHAIN_ID, TESTNET_MODE } from '@/lib/web3/config';
import { formatUSD, formatCrypto, calcPlatformFee, PLATFORM_FEE_LABEL } from '@/lib/utils/format-price';

/* ─── Block Explorers per chain ─────────────────────────────────────────── */
export const CHAIN_EXPLORERS: Record<number, { name: string; tx: string; address: string }> = {
  31337: { name: 'Hardhat — No Explorer', tx: '', address: '' },
  80002: { name: 'Polygon Amoy Scan', tx: 'https://amoy.polygonscan.com/tx/', address: 'https://amoy.polygonscan.com/address/' },
  97: { name: 'BscScan Testnet', tx: 'https://testnet.bscscan.com/tx/', address: 'https://testnet.bscscan.com/address/' },
  421614: { name: 'Arbiscan Sepolia', tx: 'https://sepolia.arbiscan.io/tx/', address: 'https://sepolia.arbiscan.io/address/' },
  84532: { name: 'BaseScan Sepolia', tx: 'https://sepolia.basescan.org/tx/', address: 'https://sepolia.basescan.org/address/' },
  137: { name: 'PolygonScan', tx: 'https://polygonscan.com/tx/', address: 'https://polygonscan.com/address/' },
  42161: { name: 'Arbiscan', tx: 'https://arbiscan.io/tx/', address: 'https://arbiscan.io/address/' },
  1: { name: 'Etherscan', tx: 'https://etherscan.io/tx/', address: 'https://etherscan.io/address/' },
  56: { name: 'BscScan', tx: 'https://bscscan.com/tx/', address: 'https://bscscan.com/address/' },
};

function explorerTxUrl(chainId: number, hash: string): string {
  const base = CHAIN_EXPLORERS[chainId]?.tx;
  return base ? `${base}${hash}` : '';
}
function explorerAddrUrl(chainId: number, addr: string): string {
  const base = CHAIN_EXPLORERS[chainId]?.address;
  return base ? `${base}${addr}` : '';
}

/* ─── Types ────────────────────────────────────────────────────────────── */
interface Order {
  order_id: number; internal_order_id: string; product_id: number;
  product_name: string; quantity: number; price_usd: number;
  total_amount?: number; status: string; payment_method: string | null;
  buyer_name: string; seller_name: string;
  product_metadata: { images?: string[]; accepted_tokens?: { crypto?: string[]; fiat?: string[] } };
}

interface CryptoQuote {
  order_id: number; escrow_contract: string; token_address: string;
  chain_id: number; amount_token: number; amount_wei: string;
  calldata: string; token_price: number; expires_at: number;
}

/* ─── SUPPORTED NETWORKS ────────────────────────────────────────────────── */
export const PAYMENT_NETWORKS = [
  {
    chainId: 31337,
    name: 'Hardhat VPS',
    shortName: 'Hardhat',
    color: '#22c55e',
    icon: '🖥️',
    nativeSym: 'ETH',
    testnet: true,
    badge: 'MIỄN PHÍ',
    badgeColor: 'emerald',
    description: 'Chain ảo trên VPS — test thanh toán ngay lập tức, không cần token thật',
  },
  {
    chainId: 80002,
    name: 'Polygon Amoy',
    shortName: 'Amoy',
    color: '#8247e5',
    icon: '🔷',
    nativeSym: 'MATIC',
    testnet: true,
    badge: 'TESTNET',
    badgeColor: 'purple',
    description: 'Polygon Amoy Testnet — cần MATIC từ faucet, gần giống mainnet',
  },
  {
    chainId: 97,
    name: 'BNB Testnet',
    shortName: 'BNB',
    color: '#f0b90b',
    icon: '🟡',
    nativeSym: 'tBNB',
    testnet: true,
    badge: 'TESTNET',
    badgeColor: 'yellow',
    description: 'BNB Smart Chain Testnet',
  },
];

const CHAIN_META: Record<number, typeof PAYMENT_NETWORKS[0]> =
  Object.fromEntries(PAYMENT_NETWORKS.map(n => [n.chainId, n]));

/* ─── Token availability per chain ─────────────────────────────────────── */
// Defines which tokens are valid on each chain for payment
const CHAIN_TOKENS: Record<number, string[]> = {
  31337: ['ETH'],                      // Hardhat VPS — only native ETH
  80002: ['MATIC', 'ETH'],             // Polygon Amoy — MATIC native + ETH
  97: ['BNB'],                      // BNB Testnet — native BNB
  421614: ['ETH'],                     // Arbitrum Sepolia
  84532: ['ETH'],                     // Base Sepolia
  137: ['MATIC', 'USDT', 'USDC'],    // Polygon mainnet
  42161: ['ETH', 'USDT'],             // Arbitrum mainnet
  1: ['ETH', 'USDT', 'USDC', 'WBTC'], // Ethereum mainnet
  56: ['BNB', 'USDT'],              // BSC mainnet
};

/* ─── ERC-20 Minimal ABI ────────────────────────────────────────────────── */
const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function useCoinPrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    if (!symbol) return;
    const stables = new Set(['USDT', 'USDC', 'DAI', 'BUSD']);
    if (stables.has(symbol)) { setPrice(1); return; }
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`)
      .then(r => r.json()).then(d => d.price && setPrice(parseFloat(d.price))).catch(() => { });
  }, [symbol]);
  return price;
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`Đã sao chép ${label}`);
}

/* ─── Network Badge ─────────────────────────────────────────────────────── */
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

/* ─── Checkout Steps indicator ──────────────────────────────────────────── */
function Steps({ current }: { current: number }) {
  const steps = ['Xem đơn', 'Chọn mạng & token', 'Thanh toán'];
  return (
    <div className="flex items-center gap-2 p-4 bg-card border border-border rounded-2xl">
      {steps.map((label, i) => {
        const id = i + 1;
        const done = current > id;
        const active = current === id;
        return (
          <div key={id} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${done ? 'bg-[#f0b90b] text-black' : active ? 'border-2 border-[#f0b90b] text-[#f0b90b]' : 'bg-muted text-muted-foreground'}`}>
              {done ? <CheckCircle className="w-4 h-4" /> : id}
            </div>
            <span className={`text-xs font-semibold truncate ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-[#f0b90b]' : 'bg-border'}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params?.orderId === 'string' ? parseInt(params.orderId, 10) : 0;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [resumeBanner, setResumeBanner] = useState(false); // order was TX_SUBMITTED

  // Payment mode: 'crypto' | 'paypal'
  const [payMode, setPayMode] = useState<'crypto' | 'paypal'>('crypto');

  // Crypto options
  const [selectedNet, setSelectedNet] = useState<number>(31337); // Hardhat VPS default
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [showNetDropdown, setShowNetDropdown] = useState(false);

  // Quote
  const [quote, setQuote] = useState<CryptoQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Payment steps
  const [step, setStep] = useState(1);
  type PayStep = 'idle' | 'signing' | 'submitted' | 'confirming' | 'done' | 'failed';
  const [payStep, setPayStep] = useState<PayStep>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);
  const [confirmCount, setConfirmCount] = useState(0);    // live confirmation counter
  const [payError, setPayError] = useState<string | null>(null);
  const [gasEstimate, setGasEstimate] = useState<{ gas: string; usd: string } | null>(null);
  const [gasLoading, setGasLoading] = useState(false);

  // Quote timer
  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!quote) return;
    const update = () => setTimeLeft(Math.max(0, Math.floor((quote.expires_at * 1000 - Date.now()) / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [quote]);

  const acceptedCrypto = order?.product_metadata?.accepted_tokens?.crypto || ['ETH', 'MATIC', 'USDT'];
  const acceptPayPal = order?.product_metadata?.accepted_tokens?.fiat?.includes('paypal') ?? true;
  const coinPrice = useCoinPrice(selectedToken);
  const currentNet = CHAIN_META[selectedNet] || PAYMENT_NETWORKS[0];
  const quoteNet = quote ? CHAIN_META[quote.chain_id] : null;
  const isWrongChain = !!quote && !!chainId && chainId !== quote.chain_id;
  const isNative = !quote?.token_address || quote.token_address === '0x0000000000000000000000000000000000000000'
    || quote.token_address === '0x0000000000000000000000000000000000001010';

  // Tokens available on selected chain, intersected with what product accepts
  const chainSupportedTokens = CHAIN_TOKENS[selectedNet] || ['ETH'];
  const availableTokens = acceptedCrypto.filter(t => chainSupportedTokens.includes(t));
  // If no intersection → show chain tokens only (product accepts "all")
  const tokensToShow = availableTokens.length > 0 ? availableTokens : chainSupportedTokens;

  /* Native Balance Check */
  const { data: nativeBalance } = useBalance({
    address: address,
    chainId: quote?.chain_id,
    query: { enabled: !!address && !!quote },
  });

  // Auto-correct selectedToken when chain changes
  useEffect(() => {
    if (!tokensToShow.includes(selectedToken)) {
      setSelectedToken(tokensToShow[0] || 'ETH');
      setQuote(null);
    }
  }, [selectedNet, tokensToShow, selectedToken]);

  /* ─── ERC-20 allowance check ──────────────────────────────────────────── */
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
  const needsApprove = !isNative && allowance !== undefined && tokenDecimals !== undefined
    && (allowance as bigint) < BigInt(quote?.amount_wei || '0');

  /* ─── Load order ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/login'); return; }
    if (isAuthenticated && orderId) {
      apiClient.get(`/api/orders/${orderId}`)
        .then(res => {
          const o = res.data.order;
          // Allow re-entry for UNPAID, TX_SUBMITTED, TX_FAILED
          const resumable = ['UNPAID', 'TX_SUBMITTED', 'TX_FAILED'].includes(o.status);
          if (!resumable) {
            toast.info('Đơn hàng đã xử lý'); router.push(`/orders/${o.order_id}`); return;
          }
          setOrder(o);
          // Show resume banner if payment already submitted on-chain
          if (o.status === 'TX_SUBMITTED') {
            setResumeBanner(true);
            setStep(3);
          }
          const tokens = o.product_metadata?.accepted_tokens?.crypto;
          if (tokens?.length) setSelectedToken(tokens[0]);

          // Fetch product image if metadata has none
          const hasImg = o.product_metadata?.images?.length > 0;
          if (!hasImg && o.product_id) {
            apiClient.get(`/api/products/${o.product_id}`)
              .then(pr => {
                const imgs = pr.data?.product?.images || pr.data?.product?.product_metadata?.images;
                if (imgs?.length) setProductImage(imgs[0]);
              })
              .catch(() => { });
          }
        })
        .catch(() => toast.error('Không tìm thấy đơn hàng'))
        .finally(() => setLoading(false));
    } else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, orderId, router]);

  /* ─── Get Quote ─────────────────────────────────────────────────────── */
  const handleGetQuote = async () => {
    if (!isConnected || !address) { toast.error('Kết nối ví MetaMask trước'); return; }
    setQuote(null); setQuoteError(null); setQuoteLoading(true); setGasEstimate(null);
    try {
      const res = await paymentClient.post('/api/payments/crypto/quote', {
        order_id: orderId,
        token_symbol: selectedToken,
        buyer_wallet: address,
        preferred_chain_id: selectedNet,
      });
      const q: CryptoQuote = res.data.quote;
      setQuote(q);
      setStep(3);

      // Auto-switch MetaMask chain
      if (chainId !== q.chain_id) {
        try { await switchChainAsync({ chainId: q.chain_id }); }
        catch { toast.info(`Vui lòng chuyển sang ${CHAIN_META[q.chain_id]?.name || `Chain ${q.chain_id}`} trong MetaMask`); }
      }

      if (q.chain_id !== selectedNet) {
        toast.warning(`Backend dùng chain ${q.chain_id} thay vì ${selectedNet}`, { duration: 5000 });
        setSelectedNet(q.chain_id);
      }

      // ── Estimate gas in background after quote is ready ────────────────
      const estimateGasInBackground = async () => {
        if (!publicClient || !address) return;
        setGasLoading(true);
        try {
          const isNativeToken = !q.token_address ||
            q.token_address === '0x0000000000000000000000000000000000000000' ||
            q.token_address === '0x0000000000000000000000000000000000001010';

          const gasEst = await publicClient.estimateGas({
            account: address as `0x${string}`,
            to: q.escrow_contract as `0x${string}`,
            data: q.calldata as `0x${string}`,
            value: isNativeToken ? BigInt(q.amount_wei) : 0n,
          });

          const gasPrice = await publicClient.getGasPrice();
          const gasCostWei = gasEst * gasPrice;
          // Format gas cost in ETH/MATIC
          const gasCostNative = Number(gasCostWei) / 1e18;

          // Get native coin price to convert to USD
          const nativeSym = CHAIN_META[q.chain_id]?.nativeSym || 'ETH';
          const stables = new Set(['USDT', 'USDC', 'DAI']);
          let nativePrice = 1;
          if (!stables.has(nativeSym)) {
            try {
              const pr = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${nativeSym}USDT`);
              const pd = await pr.json();
              if (pd.price) nativePrice = parseFloat(pd.price);
            } catch { /* ignore */ }
          }

          const gasCostUsd = gasCostNative * nativePrice;
          setGasEstimate({
            gas: `${gasCostNative.toFixed(6)} ${nativeSym}`,
            usd: `~${formatUSD(gasCostUsd)}`,
          });
        } catch (e) {
          // Gas estimation may fail if wrong chain — silently ignore
          console.debug('Gas estimate failed:', e);
        } finally {
          setGasLoading(false);
        }
      };
      estimateGasInBackground();

    } catch (e: any) {
      const msg = e.response?.data?.message || 'Lấy báo giá thất bại';
      setQuoteError(msg); toast.error(msg);
    } finally { setQuoteLoading(false); }
  };

  /* ─── Switch Chain ───────────────────────────────────────────────────── */
  const handleSwitchChain = async () => {
    if (!quote) return;
    try { await switchChainAsync({ chainId: quote.chain_id }); }
    catch { toast.error('Chuyển mạng thất bại. Đổi thủ công trong MetaMask'); }
  };

  /* ─── Approve ERC-20 ─────────────────────────────────────────────────── */
  const handleApprove = async () => {
    if (!quote || !address) return;
    if (nativeBalance && Number(nativeBalance.formatted) < 0.001) {
      toast.error('Giao dịch thất bại! Bạn cần tối thiểu 0.001 MATIC/BNB/ETH trong ví để làm phí Gas giao dịch.');
      return;
    }
    setPayStep('signing'); // reuse signing step for approve
    try {
      await writeContractAsync({
        address: quote.token_address as Address, abi: ERC20_ABI,
        functionName: 'approve',
        args: [quote.escrow_contract as Address, BigInt(quote.amount_wei)],
        chainId: quote.chain_id,
      });
      toast.loading('Đang chờ Approve...', { id: 'approve' });
      await new Promise(r => setTimeout(r, 3000));
      await refetchAllowance();
      toast.success('Approve thành công!', { id: 'approve' });
    } catch (e: any) {
      const msg = e.shortMessage || e.message || '';
      if (e.code === 4001 || msg.includes('rejected')) toast.info('Đã hủy Approve');
      else toast.error('Approve thất bại: ' + msg);
    } finally { setPayStep('idle'); }
  };

  /* ─── Pay — 4-step state machine with live progress ─────────────────── */
  const handlePay = async () => {
    if (!quote || !walletClient || !address) { toast.error('Kết nối ví'); return; }
    if (isWrongChain) { await handleSwitchChain(); return; }
    if (timeLeft === 0) { toast.error('Báo giá đã hết hạn, lấy lại'); setQuote(null); setStep(2); return; }
    if (nativeBalance && Number(nativeBalance.formatted) < 0.001) {
      toast.error('Giao dịch thất bại! Bạn cần tối thiểu 0.001 MATIC/BNB/ETH trong ví để làm phí Gas giao dịch.');
      return;
    }

    setPayError(null);
    setSubmitting(true);
    // Step 1: Waiting for MetaMask signature
    setPayStep('signing');
    try {
      const tx = await walletClient.sendTransaction({
        to: quote.escrow_contract as Address,
        data: quote.calldata as `0x${string}`,
        value: isNative ? BigInt(quote.amount_wei) : 0n,
        chainId: quote.chain_id,
      });
      const hash: string = typeof tx === 'string' ? tx : (tx as any).hash;

      // Step 2: TX in mempool
      setPayStep('submitted');
      setTxHash(hash);
      toast.success('Giao dịch đã gửi lên blockchain!', { duration: 4000 });

      await paymentClient.post('/api/payments/crypto/submit', { order_id: orderId, tx_hash: hash });

      // Step 3: Waiting for on-chain confirmations — unlock UI so user sees progress
      setPayStep('confirming');
      setSubmitting(false);

      const maxWaitMs = 120_000; // 2 minutes
      const pollStart = Date.now();
      let pollCount = 0;

      const poll = async (): Promise<void> => {
        if (Date.now() - pollStart > maxWaitMs) {
          setPayStep('idle');
          toast.info('Vẫn đang xác nhận... Theo dõi trong trang đơn hàng.', { duration: 8000 });
          setTimeout(() => router.push(`/orders/${orderId}`), 3000);
          return;
        }
        try {
          const statusRes = await paymentClient.get(`/api/payments/crypto/status/${orderId}`);
          const orderStatus = statusRes.data?.status?.status || statusRes.data?.status;
          const confs = Number(statusRes.data?.status?.confirmations ?? 0);
          setConfirmCount(confs);

          if (orderStatus === 'ONCHAIN_CONFIRMED' || orderStatus === 'PAID') {
            // Step 4: Done!
            setPayStep('done');
            setConfirmed(true);
            toast.success('✅ Thanh toán xác nhận on-chain! Tiền đang vào Escrow.', { duration: 6000 });
            let countdown = 4;
            setRedirectIn(countdown);
            const iv = setInterval(() => {
              countdown -= 1;
              setRedirectIn(countdown);
              if (countdown <= 0) { clearInterval(iv); router.push(`/orders/${orderId}`); }
            }, 1000);
            return;
          }
        } catch { /* network hiccup — keep polling */ }

        pollCount++;
        const delay = Math.min(2000 + pollCount * 500, 8000); // 2s→...max 8s
        await new Promise(r => setTimeout(r, delay));
        return poll();
      };

      poll().catch(() => setPayStep('idle'));

    } catch (e: any) {
      const msg = e.shortMessage || e.message || 'Giao dịch thất bại';
      if (e.code === 4001 || msg.includes('rejected') || msg.includes('denied')) {
        toast.info('Đã hủy giao dịch');
      } else {
        toast.error(msg);
        setPayError(msg);
      }
      setPayStep('idle');
      setSubmitting(false);
    }
  };

  /* ─── Cancel ─────────────────────────────────────────────────────────── */
  const handleCancel = async () => {
    try { await apiClient.post(`/api/orders/${orderId}/cancel`); toast.success('Đã hủy đơn'); router.push('/orders'); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Hủy thất bại'); }
  };

  /* ─── Loading / not found ────────────────────────────────────────────── */
  if (authLoading || loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#f0b90b]/30 border-t-[#f0b90b] rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Đang tải đơn hàng...</p>
      </div>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-muted-foreground">Không tìm thấy đơn hàng</p>
          <Link href="/orders" className="text-primary hover:underline text-sm">← Về danh sách đơn</Link>
        </div>
      </div>
      <Footer />
    </div>
  );

  const totalUSD = Number(order.total_amount || order.price_usd);
  const estimatedCrypto = coinPrice ? (totalUSD / coinPrice).toFixed(6) : '...';

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 py-8 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href={`/products/${order.product_id}`}>
              <button className="p-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-black">Thanh toán an toàn</h1>
              <p className="text-xs text-muted-foreground font-mono">#{order.internal_order_id?.split('-')[0]?.toUpperCase()}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Escrow Protected</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

            {/* ─── LEFT ──────────────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Resume banner — payment already submitted */}
              {resumeBanner && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-300">Giao dịch đang chờ xác nhận</p>
                    <p className="text-xs text-amber-400/70 mt-0.5">Thanh toán đã được gửi lên blockchain. Bạn có thể theo dõi hoặc tiếp tục chờ.</p>
                  </div>
                  <Link href={`/orders/${orderId}`}>
                    <button className="px-3 py-1.5 bg-amber-500 text-black font-bold rounded-lg text-xs hover:bg-amber-400 flex-shrink-0">
                      Xem đơn
                    </button>
                  </Link>
                </motion.div>
              )}

              {/* Steps */}
              <Steps current={step} />

              {/* ── ORDER SUMMARY (step 1) ── */}
              <div
                className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => step > 1 && setStep(1)}
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  {(order.product_metadata?.images?.[0] || productImage)
                    ? <img src={order.product_metadata?.images?.[0] || productImage!} alt={order.product_name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{order.product_name}</h3>
                  <p className="text-xs text-muted-foreground">Người bán: {order.seller_name}</p>
                  <p className="text-xs text-muted-foreground">Số lượng: {order.quantity}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-black text-[#f0b90b]">{formatUSD(totalUSD)}</p>
                  <p className="text-[10px] text-muted-foreground">USD</p>
                </div>
              </div>

              {/* ── PAYMENT METHOD (step 1) ── */}
              {step === 1 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <h2 className="font-bold flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-5 bg-[#f0b90b] rounded-full" />
                    Chọn phương thức thanh toán
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setPayMode('crypto'); setStep(2); }}
                      className="p-4 rounded-xl border-2 border-[#f0b90b] bg-[#f0b90b]/8 text-left"
                    >
                      <Wallet className="w-6 h-6 mb-2 text-[#f0b90b]" />
                      <p className="font-bold text-sm">Crypto (Web3)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">MetaMask · Escrow</p>
                    </button>
                    <button
                      onClick={() => acceptPayPal && (setPayMode('paypal'), setStep(2))}
                      disabled={!acceptPayPal}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${!acceptPayPal ? 'opacity-40 cursor-not-allowed border-border' : 'border-border hover:border-blue-500/50'}`}
                    >
                      <CreditCard className="w-6 h-6 mb-2 text-muted-foreground" />
                      <p className="font-bold text-sm">PayPal</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{acceptPayPal ? 'Thẻ tín dụng' : 'Không hỗ trợ'}</p>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── CRYPTO SETUP (step 2) ── */}
              {step === 2 && payMode === 'crypto' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-5 space-y-5">
                  <h2 className="font-bold flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-5 bg-emerald-400 rounded-full" />
                    Chọn mạng & token
                    <button onClick={() => setStep(1)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">← Quay lại</button>
                  </h2>

                  {/* Network Selector */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mạng blockchain</p>
                    <div className="space-y-2">
                      {PAYMENT_NETWORKS.map(net => (
                        <button
                          key={net.chainId}
                          onClick={() => { setSelectedNet(net.chainId); setQuote(null); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedNet === net.chainId ? 'border-[#f0b90b]/60 bg-[#f0b90b]/5' : 'border-border hover:border-[#f0b90b]/30'}`}
                        >
                          <span className="text-xl flex-shrink-0">{net.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{net.name}</span>
                              <NetworkBadge net={net} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{net.description}</p>
                          </div>
                          {selectedNet === net.chainId && <CheckCircle className="w-4 h-4 text-[#f0b90b] flex-shrink-0" />}
                        </button>
                      ))}
                    </div>

                    {/* Hardhat setup guide */}
                    {selectedNet === 31337 && (
                      <div className="mt-3 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" /> Hướng dẫn test trên Hardhat VPS (miễn phí)
                        </p>
                        <p className="text-[11px] text-emerald-400/80">
                          <span className="font-bold">Bước 1:</span> Thêm mạng vào MetaMask (Settings → Add Network)
                        </p>
                        <div className="space-y-1.5 text-[11px] font-mono text-emerald-300/80 pl-2">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400/50 w-20 flex-shrink-0">RPC URL:</span>
                            <span className="flex-1 truncate">http://103.20.96.79:8545</span>
                            <button onClick={() => copyText('http://103.20.96.79:8545', 'RPC URL')} className="flex-shrink-0 text-emerald-400/60 hover:text-emerald-400"><Copy className="w-3 h-3" /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400/50 w-20 flex-shrink-0">Chain ID:</span>
                            <span>31337</span>
                            <button onClick={() => copyText('31337', 'Chain ID')} className="flex-shrink-0 text-emerald-400/60 hover:text-emerald-400"><Copy className="w-3 h-3" /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400/50 w-20 flex-shrink-0">Symbol:</span>
                            <span>ETH</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-emerald-400/80 font-bold">
                          Bước 2: Nhận ETH test (nếu ví chưa có balance)
                        </p>
                        {isConnected ? (
                          <button
                            onClick={async () => {
                              try {
                                const res = await paymentClient.post('/api/faucet/hardhat', { wallet: address });
                                toast.success(res.data.message || 'Đã gửi 1 ETH test!');
                              } catch (e: any) {
                                toast.error(e.response?.data?.message || 'Faucet thất bại');
                              }
                            }}
                            className="w-full py-2 text-xs font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg flex items-center justify-center gap-2 transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Nhận 1 ETH test (Hardhat Faucet)
                          </button>
                        ) : (
                          <p className="text-[10px] text-emerald-400/50">Kết nối MetaMask trước để nhận ETH test</p>
                        )}
                        <p className="text-[10px] text-emerald-400/40 pt-0.5">
                          Hoặc import private key Hardhat Account #0 (có 10,000 ETH):
                        </p>
                        <div className="p-2 bg-black/20 rounded-lg">
                          <p className="text-[10px] text-emerald-300/60">
                            Xem tại{' '}
                            <a href="https://hardhat.org/hardhat-network/docs/reference#initial-state" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">
                              Hardhat Docs → Account #0
                            </a>
                          </p>
                        </div>
                        <p className="text-[10px] text-emerald-400/50">⚠ Không bao giờ hiển thị private key trên giao diện web!</p>
                      </div>
                    )}
                  </div>

                  {/* Token Selector */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Token thanh toán</p>
                    {availableTokens.length === 0 && acceptedCrypto.length > 0 && (
                      <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-400">
                          Sản phẩm hỗ trợ <b>{acceptedCrypto.join(', ')}</b> nhưng không có token nào trên {currentNet.name}.
                          Đang hiển thị token mặc định của mạng này.
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {tokensToShow.map(token => (
                        <button
                          key={token}
                          onClick={() => { setSelectedToken(token); setQuote(null); }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${selectedToken === token ? 'border-[#f0b90b] bg-[#f0b90b]/10 text-[#f0b90b]' : 'border-border hover:border-[#f0b90b]/40'}`}
                        >
                          <CoinImage symbol={token} size={20} className="object-contain" />
                          <span className="text-sm font-bold">{token}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estimate */}
                  <div className="p-4 bg-background border border-border rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Ước tính cần trả</p>
                      <p className="text-xl font-black font-mono">{estimatedCrypto} <span className="text-sm text-[#f0b90b]">{selectedToken}</span></p>
                      <p className="text-xs text-muted-foreground mt-0.5">≈ {formatUSD(totalUSD)}</p>
                    </div>
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Wallet panel */}
                  <div className="p-4 bg-background border border-border rounded-xl">
                    {!isConnected ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Chưa kết nối ví
                        </p>
                        <ConnectButton.Custom>
                          {({ openConnectModal }) => (
                            <button onClick={openConnectModal}
                              className="w-full py-2.5 bg-[#f0b90b] text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-[#e6a800]">
                              <Wallet className="w-4 h-4" /> Kết nối MetaMask
                            </button>
                          )}
                        </ConnectButton.Custom>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <p className="text-xs text-emerald-400 font-semibold">Đã kết nối</p>
                          <p className="ml-auto font-mono text-xs text-muted-foreground">{address?.slice(0, 8)}...{address?.slice(-4)}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Mạng hiện tại:</span>
                          <span className="font-medium text-foreground">{CHAIN_META[chainId || 0]?.name || `Chain ${chainId}`}</span>
                          <ConnectButton.Custom>
                            {({ openChainModal }) => (
                              <button onClick={openChainModal} className="ml-auto text-[#f0b90b] text-xs hover:underline">Đổi mạng</button>
                            )}
                          </ConnectButton.Custom>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Get Quote Button */}
                  <button
                    onClick={handleGetQuote}
                    disabled={quoteLoading || !isConnected}
                    className="w-full py-4 bg-gradient-to-r from-[#f0b90b] to-[#f3ba2f] text-black font-black rounded-xl text-base hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
                  >
                    {quoteLoading
                      ? <><Loader2 className="w-5 h-5 animate-spin" />Đang tạo hóa đơn...</>
                      : <><Shield className="w-5 h-5" />Tạo hóa đơn trên {currentNet.name}</>}
                  </button>

                  {quoteError && (
                    <div className="flex gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>{quoteError}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── PAYMENT STEP (step 3) ── */}
              {step === 3 && quote && payMode === 'crypto' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold flex items-center gap-2 text-sm">
                      <Lock className="w-4 h-4 text-[#f0b90b]" />
                      Thanh toán — {quoteNet?.name || `Chain ${quote.chain_id}`}
                    </h2>
                    {/* Quote timer */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold font-mono ${timeLeft < 60 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-muted border-border text-muted-foreground'}`}>
                      ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Số tiền thanh toán</p>
                      <p className="text-2xl font-black font-mono">{quote.amount_token.toFixed(6)}</p>
                      <p className="text-sm font-bold text-[#f0b90b]">{selectedToken}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>≈ {formatUSD(totalUSD)}</p>
                      {quote.token_price > 0 && <p>1 {selectedToken} = {formatUSD(quote.token_price)}</p>}
                    </div>
                  </div>

                  {/* Gas Fee Estimate */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-background/50 border border-border rounded-xl">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <p className="text-xs text-muted-foreground">Phí gas ước tính</p>
                    </div>
                    {gasLoading ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Đang tính...</span>
                      </div>
                    ) : gasEstimate ? (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-amber-400">{gasEstimate.gas}</p>
                        <p className="text-[10px] text-muted-foreground">{gasEstimate.usd}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </div>

                  {/* Smart Contract Info — always visible */}
                  <div className="p-3 bg-background border border-border rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Smart Contract Escrow</p>
                      {explorerAddrUrl(quote.chain_id, quote.escrow_contract) && (
                        <a
                          href={explorerAddrUrl(quote.chain_id, quote.escrow_contract)}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-[10px] font-bold text-emerald-400 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Xem trên {CHAIN_EXPLORERS[quote.chain_id]?.name}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[11px] flex-1 break-all text-emerald-300">{quote.escrow_contract}</p>
                      <button onClick={() => copyText(quote.escrow_contract, 'Escrow Contract')} className="flex-shrink-0 text-muted-foreground hover:text-emerald-400">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    {!isNative && (
                      <div className="border-t border-border pt-2">
                        <p className="text-[10px] text-muted-foreground mb-1">Token {selectedToken}</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-[11px] flex-1 break-all text-foreground">{quote.token_address}</p>
                          <button onClick={() => copyText(quote.token_address, `Token ${selectedToken}`)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-border pt-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Ví của bạn</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[11px] flex-1 break-all text-foreground">{address}</p>
                        <button onClick={() => copyText(address || '', 'Wallet address')} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Wrong chain warning */}
                  {isWrongChain && (
                    <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="text-amber-300">MetaMask đang ở sai mạng</span>
                      </div>
                      <button onClick={handleSwitchChain}
                        className="px-3 py-1.5 bg-amber-500 text-black font-bold rounded-lg text-xs hover:bg-amber-400">
                        Chuyển ngay
                      </button>
                    </div>
                  )}

                  {/* ERC-20 Approve step */}
                  {needsApprove && !isWrongChain && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                      <p className="text-sm font-bold text-amber-300">Bước 1: Authorize Token</p>
                      <p className="text-xs text-amber-400/80">
                        Cho phép hợp đồng escrow sử dụng {quote.amount_token.toFixed(6)} {selectedToken} từ ví bạn.
                        Chỉ cần làm 1 lần cho mỗi token.
                      </p>
                      <button onClick={handleApprove} disabled={payStep === 'signing'}
                        className="w-full py-2.5 bg-amber-500 text-black font-bold rounded-xl text-sm hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                        {payStep === 'signing'
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Đang Approve...</>
                          : <>✅ Approve {selectedToken}</>}
                      </button>
                    </div>
                  )}

                  {/* ── LIVE PAYMENT PROGRESS PANEL ── */}
                  {payStep === 'done' && confirmed ? (
                    /* ── SUCCESS ── */
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-4 py-2">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-emerald-400">Thanh toán thành công! 🎉</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Tiền đã được khóa trong Smart Contract Escrow —<br />
                          sẽ chuyển cho người bán sau khi bạn xác nhận nhận hàng.
                        </p>
                        {redirectIn !== null && (
                          <p className="text-xs text-[#f0b90b] mt-2 font-semibold animate-pulse">
                            Chuyển về đơn hàng sau {redirectIn}s...
                          </p>
                        )}
                      </div>
                      <div className="p-3 bg-background border border-border rounded-xl text-left">
                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">TX Hash</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs flex-1 break-all text-emerald-300">{txHash}</p>
                          <button onClick={() => copyText(txHash!, 'Tx Hash')} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Link href={`/orders/${orderId}`}>
                          <button className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 text-sm">Xem đơn hàng</button>
                        </Link>
                        <Link href="/products">
                          <button className="w-full py-3 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted">Tiếp tục mua</button>
                        </Link>
                      </div>
                    </motion.div>

                  ) : payStep === 'signing' || payStep === 'submitted' || payStep === 'confirming' ? (
                    /* ── IN PROGRESS — live steps ── */
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="space-y-3 p-4 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl">
                      <p className="text-xs font-bold text-[#f0b90b] uppercase tracking-wider mb-3">Đang xử lý thanh toán</p>

                      {/* Step row helper */}
                      {([
                        {
                          id: 'signing',
                          label: 'Ký giao dịch trong MetaMask',
                          sub: 'Vui lòng xác nhận trong ví của bạn',
                          done: payStep === 'submitted' || payStep === 'confirming',
                          active: payStep === 'signing',
                        },
                        {
                          id: 'submitted',
                          label: 'Giao dịch gửi lên blockchain',
                          sub: txHash ? `${txHash.slice(0, 12)}...${txHash.slice(-6)}` : 'Đang broadcast...',
                          done: payStep === 'confirming',
                          active: payStep === 'submitted',
                        },
                        {
                          id: 'confirming',
                          label: 'Đợi xác nhận on-chain',
                          sub: payStep === 'confirming'
                            ? confirmCount > 0
                              ? `${confirmCount} xác nhận — đang chờ đủ...`
                              : 'Đang chờ block miner xác nhận...'
                            : 'Chờ đủ confirmations',
                          done: false,
                          active: payStep === 'confirming',
                        },
                      ] as const).map(s => (
                        <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${s.active ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20' : s.done ? 'opacity-60' : 'opacity-30'}`}>
                          <div className="flex-shrink-0 mt-0.5">
                            {s.done ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : s.active ? (
                              <Loader2 className="w-4 h-4 text-[#f0b90b] animate-spin" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${s.active ? 'text-[#f0b90b]' : s.done ? 'text-emerald-400' : 'text-muted-foreground'}`}>{s.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.sub}</p>
                          </div>
                        </div>
                      ))}

                      {/* Live confirmation bar */}
                      {payStep === 'confirming' && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Confirmations</span>
                            <span className="font-mono font-bold text-[#f0b90b]">{confirmCount} / 1</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#f0b90b] to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(confirmCount * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* TX hash display while in flight */}
                      {txHash && (
                        <div className="flex items-center gap-2 p-2 bg-background/60 border border-border rounded-lg">
                          <p className="font-mono text-[10px] text-muted-foreground flex-1 truncate">{txHash}</p>
                          <button onClick={() => copyText(txHash, 'TX Hash')} className="flex-shrink-0">
                            <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </button>
                          {explorerTxUrl(quote.chain_id, txHash) && (
                            <a href={explorerTxUrl(quote.chain_id, txHash)} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                              <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-emerald-400" />
                            </a>
                          )}
                        </div>
                      )}
                    </motion.div>

                  ) : payError ? (
                    /* ── ERROR state ── */
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-sm font-bold text-red-400">Giao dịch thất bại</p>
                      </div>
                      <p className="text-xs text-red-300/80 break-words">{payError}</p>
                      <button onClick={() => { setPayError(null); setPayStep('idle'); }}
                        className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-sm font-medium transition-colors">
                        Thử lại
                      </button>
                    </div>

                  ) : (
                    /* ── IDLE — main pay button ── */
                    isWrongChain ? (
                      <button onClick={handleSwitchChain}
                        className="w-full py-4 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-400 flex items-center justify-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Chuyển sang {quoteNet?.name}
                      </button>
                    ) : needsApprove ? (
                      <p className="text-center text-xs text-muted-foreground">Hoàn tất Approve ở trên trước</p>
                    ) : (
                      <button
                        onClick={handlePay}
                        disabled={submitting || !isConnected || !walletClient}
                        className="w-full py-4 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-black rounded-xl text-base transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
                      >
                        <Wallet className="w-5 h-5" />Ký &amp; Thanh toán qua MetaMask
                      </button>
                    )
                  )}

                  {/* Back to change network/token */}
                  {payStep === 'idle' && !txHash && (
                    <button onClick={() => { setQuote(null); setStep(2); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground py-2 hover:bg-muted rounded-xl transition-colors">
                      ← Đổi mạng / token, lấy báo giá mới
                    </button>
                  )}

                </motion.div>
              )}

              {/* ── PAYPAL ── */}
              {step >= 2 && payMode === 'paypal' && acceptPayPal && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-card border border-[#003087]/30 rounded-2xl p-6 space-y-4">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-[#003087]/20 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[#003087]/30">
                      <CreditCard className="w-7 h-7 text-[#0070ba]" />
                    </div>
                    <h3 className="font-bold">Thanh toán PayPal</h3>
                    <p className="text-sm text-muted-foreground mt-1">An toàn, bảo vệ tranh chấp</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-background border border-border rounded-xl">
                    <span className="text-muted-foreground text-sm">Tổng cộng</span>
                    <span className="font-black">{formatUSD(Number(order.price_usd))}</span>
                  </div>
                  <button onClick={async () => {
                    try {
                      const res = await paymentClient.post('/api/payments/paypal/create-order', { order_id: orderId });
                      if (res.data.approval_url) window.location.href = res.data.approval_url;
                    } catch (e: any) { toast.error(e.response?.data?.message || 'Tạo đơn PayPal thất bại'); }
                  }}
                    className="w-full py-4 bg-gradient-to-r from-[#003087] to-[#0070ba] text-white font-bold rounded-xl hover:opacity-90">
                    Đến cổng thanh toán PayPal →
                  </button>
                  <button onClick={() => setStep(1)} className="w-full text-xs text-muted-foreground hover:text-foreground py-2">
                    ← Chọn lại phương thức
                  </button>
                </motion.div>
              )}

            </div>

            {/* ─── RIGHT SIDEBAR ────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Order card */}
              <div className="bg-card border border-border rounded-2xl p-5 sticky top-24 space-y-4">
                <h2 className="font-bold flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Tóm tắt đơn hàng
                </h2>

                {/* Product image */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted">
                  {(order.product_metadata?.images?.[0] || productImage) ? (
                    <>
                      <img
                        src={order.product_metadata?.images?.[0] || productImage!}
                        alt={order.product_name}
                        className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="font-bold text-white text-xs leading-tight line-clamp-2">{order.product_name}</p>
                        <p className="text-[10px] text-white/70 mt-0.5">{order.seller_name}</p>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Package className="w-10 h-10 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate px-2 text-center">{order.product_name}</p>
                    </div>
                  )}
                </div>

                {/* Invoice */}
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Số lượng', val: `× ${order.quantity}` },
                    { label: 'Giá sản phẩm', val: formatUSD(Number(order.price_usd)) },
                    { label: `Phí nền tảng (${PLATFORM_FEE_LABEL})`, val: formatUSD(calcPlatformFee(totalUSD)) },
                    { label: 'Phí giao dịch', val: 'Miễn phí', green: true },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-muted-foreground pb-2 border-b border-border">
                      <span>{r.label}</span>
                      <span className={`font-semibold ${r.green ? 'text-emerald-400' : 'text-foreground'}`}>{r.val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold">Tổng thanh toán</span>
                    <span className="text-lg font-black text-[#f0b90b]">{formatUSD(totalUSD)}</span>
                  </div>
                </div>

                {/* Escrow info + contract explorer */}
                <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">Escrow bảo vệ</span>
                  </div>
                  <p className="text-xs text-emerald-400/70">Tiền giữ trong Smart Contract đến khi bạn xác nhận nhận hàng.</p>
                  {/* Contract explorer link — show when quote available */}
                  {quote && explorerAddrUrl(quote.chain_id, quote.escrow_contract) && (
                    <a
                      href={explorerAddrUrl(quote.chain_id, quote.escrow_contract)}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold mt-1 w-fit"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Xem Smart Contract trên Explorer
                    </a>
                  )}
                  {/* Fallback: show contract address for Hardhat (no explorer) */}
                  {quote && !explorerAddrUrl(quote.chain_id, quote.escrow_contract) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/60 font-mono break-all mt-1">
                      <Lock className="w-3 h-3 flex-shrink-0" />
                      {quote.escrow_contract}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Link href={`/orders/${order.order_id}`} className="block">
                    <button className="w-full py-2.5 bg-muted border border-border text-sm font-semibold rounded-xl hover:bg-muted/80">
                      Theo dõi đơn hàng
                    </button>
                  </Link>
                  <button onClick={handleCancel}
                    className="w-full py-2 text-red-400 hover:bg-red-500/10 rounded-xl text-sm transition-colors">
                    Hủy đơn hàng
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main >

      <Footer />
    </div >
  );
}
