'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, Zap, Loader2, AlertCircle,
  ArrowRight, Shield, Coins, Wallet,
} from 'lucide-react';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Header } from '@/components/layout/Header';
import { CoinImage } from '@/components/ui/CoinImage';
import { usePriceStore } from '@/store';
import { getLoginNoticeForReason } from '@/lib/auth/login-redirect';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

/* ─── Crypto Ticker Data ────────────────────────────────────── */
const COINS = [
  { symbol: 'BTC', name: 'Bitcoin', color: '#f7931a', base: 84000 },
  { symbol: 'ETH', name: 'Ethereum', color: '#627eea', base: 3200 },
  { symbol: 'BNB', name: 'BNB', color: '#f0b90b', base: 600 },
  { symbol: 'SOL', name: 'Solana', color: '#9945ff', base: 145 },
  { symbol: 'ARB', name: 'Arbitrum', color: '#12aaff', base: 0.90 },
  { symbol: 'MATIC', name: 'Polygon', color: '#8247e5', base: 0.64 },
  { symbol: 'LINK', name: 'Chainlink', color: '#375bd2', base: 13.5 },
  { symbol: 'AVAX', name: 'Avalanche', color: '#e84142', base: 29 },
  { symbol: 'OP', name: 'Optimism', color: '#ff0420', base: 1.78 },
  { symbol: 'UNI', name: 'Uniswap', color: '#ff007a', base: 7.9 },
];

const COIN_BINANCE = COINS.map(c => c.symbol + 'USDT');


/* ─── Floating Particle ─────────────────────────────────────── */
function Particle({ delay, size, x, y, color }: { delay: number; size: number; x: string; y: string; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, left: x, top: y, background: color, filter: 'blur(1px)' }}
      animate={{ y: [0, -30, 0], opacity: [0.2, 0.7, 0.2], scale: [1, 1.3, 1] }}
      transition={{ duration: 3 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

/* ─── Left Panel ────────────────────────────────────────────── */
function LeftPanel() {
  const { prices: storePrices, connect: priceConnect } = usePriceStore();
  useEffect(() => { priceConnect(COIN_BINANCE); }, []);
  // Map store prices: { BTCUSDT: { price, change24h } } → { BTC: price }
  const prices = Object.fromEntries(COINS.map(c => [c.symbol, storePrices[c.symbol + 'USDT']?.price ?? c.base]));
  const changes = Object.fromEntries(COINS.map(c => [c.symbol, storePrices[c.symbol + 'USDT']?.change24h ?? 0]));

  const particles = [
    { delay: 0, size: 6, x: '10%', y: '20%', color: '#f0b90b33' },
    { delay: 0.5, size: 4, x: '85%', y: '15%', color: '#627eea33' },
    { delay: 1, size: 8, x: '70%', y: '60%', color: '#9945ff33' },
    { delay: 1.5, size: 5, x: '20%', y: '75%', color: '#12aaff33' },
    { delay: 2, size: 7, x: '50%', y: '40%', color: '#f7931a33' },
    { delay: 2.5, size: 3, x: '90%', y: '80%', color: '#f0b90b33' },
    { delay: 0.8, size: 5, x: '35%', y: '55%', color: '#8247e533' },
    { delay: 1.3, size: 6, x: '60%', y: '88%', color: '#ff007a33' },
  ];

  return (
    <div className="hidden lg:flex w-[58%] relative overflow-hidden flex-col bg-black/40 dark:bg-black/40 backdrop-blur-[2px]">
      {/* Grid overlay */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(240,185,11,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(240,185,11,0.07) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Gradient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#f0b90b]/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#627eea]/8 rounded-full blur-[100px]" />
      <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-[#9945ff]/5 rounded-full blur-[80px]" />

      {/* Particles */}
      {particles.map((p, i) => <Particle key={i} {...p} />)}

      {/* Top nav */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-[#f0b90b]/20 group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="font-black text-xl text-white tracking-tight">Web3<span className="text-[#f0b90b]">Market</span></span>
        </Link>
        <div className="flex items-center gap-2 text-xs text-white/40 bg-white/5 border border-white/8 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Blockchain Live
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-8 py-6">
        {/* Hero text */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-[#f0b90b] text-sm font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4" /> Web3 Marketplace
          </p>
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            Giao dịch<br />
            <span className="bg-gradient-to-r from-[#f0b90b] via-[#f7931a] to-[#ff6b35] bg-clip-text text-transparent">
              không giới hạn
            </span>
          </h1>
          <p className="text-white/50 text-base leading-relaxed max-w-sm">
            Nền tảng mua bán NFT & sản phẩm số được bảo vệ bởi Smart Contract Escrow — minh bạch, an toàn, phi tập trung.
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="flex gap-6 mt-8 mb-8"
        >
          {[
            { label: 'Người dùng', value: '12,400+' },
            { label: 'Giao dịch', value: '$2.4M+' },
            { label: 'NFT Mint', value: '8,300+' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Live crypto ticker — 2 columns */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-2"
        >
          {COINS.slice(0, 6).map((coin, idx) => {
            const price = prices[coin.symbol] ?? coin.base;
            const change = changes[coin.symbol] ?? 0;
            const isUp = change >= 0;
            return (
              <motion.div
                key={coin.symbol}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.06 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ background: `${coin.color}22` }}>
                    <CoinImage symbol={coin.symbol} size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/90">{coin.symbol}</p>
                    <p className="text-[9px] text-white/30">{coin.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <motion.p
                    key={Math.floor(price * 100)}
                    initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}
                    className="text-xs font-mono font-bold text-white/90"
                  >
                    ${price < 10 ? price.toFixed(4) : price < 1000 ? price.toFixed(2) : price.toLocaleString('en', { maximumFractionDigits: 0 })}
                  </motion.p>
                  <p className={`text-[9px] font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}{change.toFixed(2)}%
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Scrolling ticker strip */}
        <div className="mt-4 overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.06] py-2">
          <motion.div
            className="flex gap-6 whitespace-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            {[...COINS, ...COINS].map((coin, i) => {
              const price = prices[coin.symbol] ?? coin.base;
              const change = changes[coin.symbol] ?? 0;
              return (
                <span key={i} className="flex items-center gap-1.5 text-[11px] font-mono flex-shrink-0">
                  <CoinImage symbol={coin.symbol} size={14} className="rounded-full" />
                  <span className="font-bold text-white/60">{coin.symbol}</span>
                  <span className="text-white/90">${price < 10 ? price.toFixed(3) : price.toFixed(2)}</span>
                  <span className={change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Bottom features */}
      <div className="relative z-10 flex gap-4 px-8 pb-8">
        {[
          { icon: Shield, label: 'Smart Contract Escrow' },
          { icon: Zap, label: 'Gasless Transactions' },
          { icon: Coins, label: 'Multi-chain Support' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-white/30">
            <Icon className="w-3 h-3 text-[#f0b90b]" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function LoginClientPage() {
  const { t } = useClientTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const lastNoticeReasonRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || '';

  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const ERROR_MESSAGES: Record<string, string> = {
    INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
    TOO_MANY_REQUESTS: 'Quá nhiều lần thử. Vui lòng thử lại sau 5 phút',
    ACCOUNT_SUSPENDED: 'Tài khoản đã bị khóa. Liên hệ hỗ trợ',
    INVALID_SIGNATURE: 'Chữ ký ví không hợp lệ',
    OAuthAccountNotLinked: 'Email đã được đăng ký bằng phương thức khác',
    OAuthSignin: 'Đăng nhập OAuth thất bại. Vui lòng thử lại',
    Callback: 'Lỗi xác thực. Vui lòng thử lại',
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const err = searchParams?.get('error');
    if (err) setAuthError(ERROR_MESSAGES[err] || 'Đăng nhập thất bại. Vui lòng thử lại');
    const reason = searchParams?.get('reason');
    const notice = getLoginNoticeForReason(reason);
    setAuthHint(notice);
    if (notice && lastNoticeReasonRef.current !== reason) {
      toast.error(notice, { id: 'reauth-required' });
      lastNoticeReasonRef.current = reason;
    } else if (!notice) {
      lastNoticeReasonRef.current = null;
    }
  }, [searchParams]);

  const schema = z.object({
    emailOrUsername: z.string().min(1, 'Email hoặc username là bắt buộc'),
    password: z.string().min(1, 'Mật khẩu là bắt buộc'),
  });
  type FormData = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (siteKey && !captchaToken) { toast.error('Vui lòng hoàn thành CAPTCHA'); return; }
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await signIn('credentials', {
        email: data.emailOrUsername,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        const msg = ERROR_MESSAGES[result.error] || 'Đăng nhập thất bại. Vui lòng thử lại';
        setAuthError(msg);
        toast.error(msg);
      } else if (result?.ok) {
        toast.success('Đăng nhập thành công!');
        router.push(searchParams?.get('callbackUrl') || '/');
        router.refresh();
      }
    } catch {
      setAuthError('Đăng nhập thất bại. Vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: 'google' | 'facebook') => {
    setSocialLoading(provider);
    try {
      const callbackUrl = searchParams?.get('callbackUrl') || '/?welcome=1';
      await signIn(
        provider,
        { callbackUrl },
        provider === 'google' ? { prompt: 'select_account' } : undefined,
      );
    }
    catch { toast.error('Đăng nhập thất bại. Vui lòng thử lại'); setSocialLoading(null); }
  };

  const handleWalletLogin = async () => {
    if (!isConnected || !address) {
      toast.error('Vui lòng kết nối MetaMask trước');
      return;
    }
    setWalletLoading(true);
    setAuthError(null);
    try {
      // Generate client-side nonce (backend verifies signature against address, not nonce content)
      const nonce = crypto.randomUUID();

      // Build SIWE message (must match backend's buildSiweMessage format)
      const domain = typeof window !== 'undefined' ? window.location.host : 'localhost';
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const walletChainId = chainId || parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '31337');
      const issuedAt = new Date().toISOString();
      const expirationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Crypto Marketplace\n\nURI: ${origin}\nVersion: 1\nChain ID: ${walletChainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;

      // Sign
      const signature = await signMessageAsync({ message });

      // NextAuth signIn with wallet provider
      const result = await signIn('wallet', {
        address,
        message,
        signature,
        redirect: false,
      });

      if (result?.error) {
        const msg = ERROR_MESSAGES[result.error] || 'Đăng nhập ví thất bại';
        setAuthError(msg);
        toast.error(msg);
      } else if (result?.ok) {
        toast.success('Đăng nhập ví thành công!');
        router.push(searchParams?.get('callbackUrl') || '/');
        router.refresh();
      }
    } catch (e: any) {
      if (e.code === 4001) {
        toast.info('Đã hủy ký xác nhận');
      } else {
        setAuthError(e.message || 'Đăng nhập ví thất bại');
        toast.error(e.message || 'Đăng nhập ví thất bại');
      }
    } finally {
      setWalletLoading(false);
    }
  };

  const inputCls = (err: boolean) =>
    `w-full pl-10 pr-4 py-3 bg-secondary border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm ${err
      ? 'border-red-500/50 focus:ring-red-500/20'
      : 'border-border focus:border-[#f0b90b]/60 focus:ring-[#f0b90b]/10'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ── */}
      <Header />

      <div className="flex flex-1">
        {/* ── Left panel ── */}
        <LeftPanel />

        {/* ── Right panel ── */}
        <div className="w-full lg:w-[42%] flex items-center justify-center relative overflow-hidden overflow-y-auto px-4 py-8 min-h-[calc(100vh-4rem)]">
          {/* Grid overlay — matches left panel */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(240,185,11,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(240,185,11,0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {/* Mobile background glows */}
          <div className="lg:hidden absolute inset-0">
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-[#f0b90b]/8 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-[#627eea]/8 rounded-full blur-[100px]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-[400px] relative z-10"
          >
            {/* Mobile logo (hidden on lg) */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-[#f0b90b]/20">
                <Zap className="w-5 h-5 text-black fill-black" />
              </div>
              <span className="font-black text-xl text-white">Web3<span className="text-[#f0b90b]">Market</span></span>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-black text-foreground mb-2">Đăng nhập</h2>
              <p className="text-muted-foreground text-sm">Chào mừng trở lại! Kết nối ví để bắt đầu giao dịch.</p>
            </div>

            {/* Error banner */}
            <AnimatePresence>
              {authHint && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm mb-4"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {authHint}
                </motion.div>
              )}
              {authError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm mb-6"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {authError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Social logins */}
            <div className="space-y-3 mb-6">
              {/* MetaMask Wallet */}
              <ConnectButton.Custom>
                {({ account, openConnectModal, mounted }) => {
                  if (!mounted) return null;
                  if (!account) return (
                    <button
                      onClick={openConnectModal}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#f6851b]/8 border border-[#f6851b]/20 rounded-xl text-foreground hover:bg-[#f6851b]/15 hover:border-[#f6851b]/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 font-medium text-sm"
                    >
                      <Wallet className="w-5 h-5 text-[#f6851b]" />
                      Kết nối ví để đăng nhập
                    </button>
                  );
                  return (
                    <button
                      onClick={handleWalletLogin}
                      disabled={walletLoading}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#f6851b]/10 border border-[#f6851b]/30 rounded-xl text-foreground hover:bg-[#f6851b]/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 font-medium text-sm disabled:opacity-60"
                    >
                      {walletLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#f6851b]" />
                      ) : (
                        <Wallet className="w-5 h-5 text-[#f6851b]" />
                      )}
                      {walletLoading
                        ? 'Đang xác nhận chữ ký...'
                        : `Đăng nhập bằng ví ${account.displayName}`}
                    </button>
                  );
                }}
              </ConnectButton.Custom>

              {/* Google */}
              <button
                onClick={() => handleSocialSignIn('google')}
                disabled={!!socialLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-secondary border border-border rounded-xl text-foreground hover:bg-accent hover:border-border hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 font-medium text-sm disabled:opacity-60"
              >
                {socialLoading === 'google' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Tiếp tục với Google
              </button>

              {/* Facebook — Beta/disabled */}
              <div className="relative group">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2]/5 border border-[#1877F2]/10 rounded-xl text-white/30 cursor-not-allowed text-sm font-medium"
                >
                  <svg className="w-5 h-5 opacity-40" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Tiếp tục với Facebook
                  <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">Beta</span>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#12121e] border border-white/10 rounded-lg text-xs text-white/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10">
                  Cần xác minh doanh nghiệp Facebook — Dùng Google nhé!
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">hoặc dùng email</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground/70 mb-1.5">Email hoặc Username</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    {...register('emailOrUsername')}
                    placeholder="email@example.com"
                    autoComplete="email"
                    className={inputCls(!!errors.emailOrUsername)}
                  />
                </div>
                {errors.emailOrUsername && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                    {errors.emailOrUsername.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-foreground/70">Mật khẩu</label>
                  <Link href="/forgot-password" className="text-xs text-[#f0b90b] hover:text-[#f0b90b]/80 transition-colors">
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    {...register('password')}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`${inputCls(!!errors.password)} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* hCaptcha */}
              {siteKey && mounted && (
                <div className="flex justify-center pt-1">
                  <HCaptcha sitekey={siteKey} onVerify={t => setCaptchaToken(t)} onExpire={() => setCaptchaToken(null)} theme="dark" />
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !!socialLoading}
                className="w-full py-3.5 btn-purple-rainbow rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Đang đăng nhập...</>
                ) : (
                  <>Đăng nhập <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* Register link */}
            <p className="mt-6 text-center text-sm text-white/40">
              Chưa có tài khoản?{' '}
              <Link href="/register" className="text-[#f0b90b] hover:text-[#f7c82a] font-bold transition-colors">
                Đăng ký miễn phí →
              </Link>
            </p>

            {/* Security note */}
            <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#f0b90b]/50" /> SSL Secured</span>
              <span className="w-px h-3 bg-border" />
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-[#f0b90b]/50" /> Web3 Native</span>
              <span className="w-px h-3 bg-border" />
              <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-[#f0b90b]/50" /> Escrow Protected</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
