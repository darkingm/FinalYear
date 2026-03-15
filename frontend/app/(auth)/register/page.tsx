'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, User, Zap, CheckCircle,
  XCircle, Loader2, ArrowRight, Shield, Coins, Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import HCaptcha from '@hcaptcha/react-hcaptcha';

/* ─── Live Price Hook ───────────────────────────────────────── */
const COINS = [
  { symbol: 'BTC', base: 83421.5,  color: '#f7931a' },
  { symbol: 'ETH', base: 3218.7,   color: '#627eea' },
  { symbol: 'BNB', base: 601.3,    color: '#f0b90b' },
  { symbol: 'SOL', base: 142.8,    color: '#9945ff' },
  { symbol: 'ARB', base: 0.892,    color: '#12aaff' },
  { symbol: 'MATIC',base: 0.641,   color: '#8247e5' },
];

function useLivePrices() {
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(COINS.map(c => [c.symbol, c.base]))
  );
  const changes: Record<string, number> = Object.fromEntries(
    COINS.map(c => [c.symbol, (Math.random() - 0.47) * 5])
  );
  useEffect(() => {
    const iv = setInterval(() => {
      setPrices(prev => {
        const next: Record<string, number> = {};
        COINS.forEach(c => {
          const drift = (Math.random() - 0.499) * c.base * 0.001;
          next[c.symbol] = Math.max(0.001, prev[c.symbol] + drift);
        });
        return next;
      });
    }, 700);
    return () => clearInterval(iv);
  }, []);
  return { prices, changes };
}

/* ─── Password Strength ─────────────────────────────────────── */
function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    { label: '8+ ký tự', ok: password.length >= 8 },
    { label: 'Chữ thường', ok: /[a-z]/.test(password) },
    { label: 'Chữ hoa', ok: /[A-Z]/.test(password) },
    { label: 'Số', ok: /\d/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  if (!password) return null;
  return (
    <div className="mt-2.5">
      <div className="flex gap-1 mb-1.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-white/10'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1">
            {c.ok ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-white/20" />}
            <span className={`text-[10px] font-medium ${c.ok ? 'text-white/60' : 'text-white/20'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Left Panel ────────────────────────────────────────────── */
function LeftPanel() {
  const { prices, changes } = useLivePrices();

  const perks = [
    { icon: Shield, title: 'Escrow thông minh', desc: 'Tiền được giữ an toàn trong Smart Contract cho đến khi giao dịch hoàn tất' },
    { icon: Coins,  title: 'Multi-chain NFT',   desc: 'Mint và giao dịch NFT trên Polygon, Arbitrum, BNB Chain' },
    { icon: Sparkles, title: 'AI Credit Score', desc: 'Điểm tín nhiệm dựa trên lịch sử giao dịch blockchain, vay không thế chấp' },
    { icon: Zap,    title: 'P2P Nhanh',         desc: 'Giao dịch ngang hàng tức thì, hỗ trợ 10+ phương thức thanh toán' },
  ];

  return (
    <div className="hidden lg:flex w-[55%] relative overflow-hidden flex-col bg-[#06060e]">
      {/* Grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(99,126,234,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,126,234,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glows */}
      <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-[#9945ff]/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[45%] h-[45%] bg-[#f0b90b]/6 rounded-full blur-[100px]" />
      <div className="absolute top-[45%] left-[20%] w-[40%] h-[40%] bg-[#627eea]/5 rounded-full blur-[80px]" />

      {/* Top nav */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-[#f0b90b]/20 group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="font-black text-xl text-white tracking-tight">KienAI<span className="text-[#f0b90b]">.</span></span>
        </Link>
        <Link href="/login" className="text-xs text-white/40 hover:text-white/70 transition-colors">
          Đã có tài khoản? <span className="text-[#f0b90b]">Đăng nhập →</span>
        </Link>
      </div>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-8 py-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-[#9945ff] text-sm font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Tham gia ngay hôm nay
          </p>
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            Xây dựng<br />
            <span className="bg-gradient-to-r from-[#9945ff] via-[#627eea] to-[#12aaff] bg-clip-text text-transparent">
              tương lai Web3
            </span>
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm mb-8">
            Tạo tài khoản và kết nối ví crypto để tham gia vào hệ sinh thái thương mại điện tử thế hệ tiếp theo.
          </p>
        </motion.div>

        {/* Perks */}
        <div className="space-y-3 mb-8">
          {perks.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[#9945ff]/15 border border-[#9945ff]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-[#9945ff]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white/90">{title}</p>
                <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mini ticker */}
        <div className="overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.05] py-2">
          <motion.div
            className="flex gap-6 whitespace-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          >
            {[...COINS, ...COINS].map((coin, i) => {
              const price = prices[coin.symbol] ?? coin.base;
              const chg = changes[coin.symbol] ?? 0;
              return (
                <span key={i} className="flex items-center gap-1.5 text-[11px] font-mono flex-shrink-0">
                  <span className="font-bold" style={{ color: coin.color }}>{coin.symbol}</span>
                  <span className="text-white/80">${price < 10 ? price.toFixed(3) : price.toFixed(2)}</span>
                  <span className={chg >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {chg >= 0 ? '▲' : '▼'}{Math.abs(chg).toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="relative z-10 flex gap-8 px-8 pb-8">
        {[
          { v: '0%', l: 'Phí đăng ký' },
          { v: '24/7', l: 'Hỗ trợ' },
          { v: '12K+', l: 'Thành viên' },
        ].map(s => (
          <div key={s.l}>
            <p className="text-lg font-black text-white">{s.v}</p>
            <p className="text-xs text-white/30">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || '';

  useEffect(() => { setMounted(true); }, []);

  const handleSocialSignIn = async (provider: 'google' | 'facebook') => {
    setSocialLoading(provider);
    try { await signIn(provider, { callbackUrl: '/' }); }
    catch { toast.error('Đăng nhập thất bại. Vui lòng thử lại'); setSocialLoading(null); }
  };

  const schema = z.object({
    email: z.string().email('Email không hợp lệ'),
    username: z.string().min(3, 'Tối thiểu 3 ký tự').max(20, 'Tối đa 20 ký tự'),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Cần chữ hoa, chữ thường và số'),
    confirmPassword: z.string(),
    terms: z.boolean().refine(v => v === true, 'Vui lòng đồng ý điều khoản'),
  }).refine(d => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

  type FormData = z.infer<typeof schema>;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const password = watch('password', '');

  const onSubmit = async (data: FormData) => {
    if (siteKey && !captchaToken) { toast.error('Vui lòng hoàn thành CAPTCHA'); return; }
    setIsLoading(true);
    try {
      await apiClient.post('/api/auth/register', {
        email: data.email,
        username: data.username,
        password: data.password,
        captcha: captchaToken || 'no-captcha',
      });
      toast.success('Tạo tài khoản thành công! Đang chuyển hướng...');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = (err: boolean) =>
    `w-full pl-10 pr-4 py-3 bg-white/5 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all text-sm ${
      err ? 'border-red-500/50 focus:ring-red-500/20' : 'border-white/10 focus:border-[#9945ff]/60 focus:ring-[#9945ff]/10'
    }`;

  return (
    <div className="min-h-screen flex bg-[#06060e]">
      <LeftPanel />

      {/* Right panel */}
      <div className="w-full lg:w-[45%] flex items-center justify-center relative overflow-hidden px-4 py-6">
        <div className="lg:hidden absolute inset-0">
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#9945ff]/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#f0b90b]/6 rounded-full blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px] relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center">
              <Zap className="w-5 h-5 text-black fill-black" />
            </div>
            <span className="font-black text-xl text-white">KienAI<span className="text-[#f0b90b]">.</span></span>
          </div>

          <div className="mb-7">
            <h2 className="text-3xl font-black text-white mb-1.5">Tạo tài khoản</h2>
            <p className="text-white/40 text-sm">Miễn phí mãi mãi. Không cần thẻ tín dụng.</p>
          </div>

          {/* Social */}
          <div className="space-y-2.5 mb-5">
            <button
              type="button"
              onClick={() => handleSocialSignIn('google')}
              disabled={!!socialLoading || isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] active:scale-[0.99] transition-all text-sm font-medium disabled:opacity-60"
            >
              {socialLoading === 'google' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Đăng ký với Google
            </button>

            <div className="relative group">
              <button disabled type="button"
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2]/5 border border-[#1877F2]/10 rounded-xl text-white/30 cursor-not-allowed text-sm font-medium"
              >
                <svg className="w-5 h-5 opacity-40" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Đăng ký với Facebook
                <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">Beta</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#12121e] border border-white/10 rounded-lg text-xs text-white/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10">
                Cần xác minh doanh nghiệp — Dùng Google nhé!
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[11px] text-white/30 uppercase tracking-widest font-semibold">hoặc dùng email</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type="email" {...register('email')} placeholder="you@example.com" autoComplete="email" className={inputCls(!!errors.email)} />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type="text" {...register('username')} placeholder="satoshi" autoComplete="username" className={inputCls(!!errors.username)} />
              </div>
              {errors.username && <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type={showPw ? 'text' : 'password'} {...register('password')} placeholder="••••••••" autoComplete="new-password"
                  className={`${inputCls(!!errors.password)} pr-10`} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={password} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1.5">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type={showConfirm ? 'text' : 'password'} {...register('confirmPassword')} placeholder="••••••••" autoComplete="new-password"
                  className={`${inputCls(!!errors.confirmPassword)} pr-10`} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer group pt-1">
              <div className="relative flex items-center justify-center mt-0.5">
                <input type="checkbox" {...register('terms')} className="peer w-4 h-4 opacity-0 absolute inset-0 cursor-pointer" />
                <div className="w-4.5 h-4.5 w-[18px] h-[18px] border border-white/20 rounded-md peer-checked:bg-[#9945ff] peer-checked:border-[#9945ff] transition-colors flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" />
                </div>
              </div>
              <span className="text-xs text-white/40 leading-relaxed">
                Tôi đồng ý với{' '}
                <Link href="#" className="text-[#9945ff] hover:underline">Điều khoản dịch vụ</Link>
                {' '}và{' '}
                <Link href="#" className="text-[#9945ff] hover:underline">Chính sách bảo mật</Link>
              </span>
            </label>
            {errors.terms && <p className="text-xs text-red-400 -mt-1">{errors.terms.message}</p>}

            {/* Captcha */}
            {siteKey && mounted && (
              <div className="flex justify-center pt-1">
                <HCaptcha sitekey={siteKey} onVerify={t => setCaptchaToken(t)} onExpire={() => setCaptchaToken(null)} theme="dark" />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !!socialLoading}
              className="w-full py-3.5 bg-gradient-to-r from-[#9945ff] to-[#627eea] text-white font-black rounded-xl text-sm hover:from-[#a855ff] hover:to-[#7c94f0] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#9945ff]/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mt-1"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Đang tạo...</>
              ) : (
                <>Tạo tài khoản miễn phí <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/40">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-[#f0b90b] hover:text-[#f7c82a] font-bold transition-colors">
              Đăng nhập →
            </Link>
          </p>

          <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-white/20">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#9945ff]/50" /> SSL Secured</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-[#f0b90b]/50" /> Web3 Native</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-[#9945ff]/50" /> Escrow Protected</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
