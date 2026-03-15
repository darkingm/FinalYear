'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, Zap, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import HCaptcha from '@hcaptcha/react-hcaptcha';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || '';

  // Map NextAuth error codes to user-friendly messages
  const ERROR_MESSAGES: Record<string, string> = {
    INVALID_CREDENTIALS: 'Email/mật khẩu không đúng',
    TOO_MANY_REQUESTS: 'Quá nhiều lần thử. Vui lòng thử lại sau 5 phút',
    ACCOUNT_SUSPENDED: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ',
    INVALID_SIGNATURE: 'Chữ ký ví không hợp lệ',
    OAuthAccountNotLinked: 'Email đã được đăng ký bằng phương thức khác',
    OAuthSignin: 'Đăng nhập OAuth thất bại. Vui lòng thử lại',
    Callback: 'Lỗi xác thực. Vui lòng thử lại',
  };

  useEffect(() => { setMounted(true); }, []);

  // Read NextAuth error from URL (e.g. ?error=INVALID_CREDENTIALS)
  useEffect(() => {
    const err = searchParams?.get('error');
    if (err) {
      setAuthError(ERROR_MESSAGES[err] || 'Đăng nhập thất bại. Vui lòng thử lại');
    }
  }, [searchParams]);

  const loginSchema = z.object({
    emailOrUsername: z.string().min(1, t('auth.emailOrUsername', 'Email or Username') + ' is required'),
    password: z.string().min(1, t('auth.password', 'Password') + ' is required'),
  });
  type LoginFormData = z.infer<typeof loginSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    if (siteKey && !captchaToken) {
      toast.error(t('auth.completeCaptcha', 'Please complete the CAPTCHA'));
      return;
    }
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
        const callbackUrl = searchParams?.get('callbackUrl') || '/';
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setAuthError('Đăng nhập thất bại. Vui lòng thử lại');
      toast.error('Đăng nhập thất bại. Vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: 'google' | 'facebook') => {
    setSocialLoading(provider);
    try {
      await signIn(provider, { callbackUrl: '/' });
    } catch {
      toast.error('Đăng nhập thất bại. Vui lòng thử lại');
      setSocialLoading(null);
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full pl-10 pr-4 py-3 bg-secondary/30 border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm ${hasError
      ? 'border-destructive/50 focus:ring-destructive/20'
      : 'border-border focus:border-primary/60 focus:ring-primary/10'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4 sm:p-6">
      {/* Animated background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-72 h-72 bg-[#f0b90b]/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
      </div>

      <div
        className={`w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-3xl p-8 sm:p-10 relative z-10 transition-all duration-500 hover:border-primary/20 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        style={{ transition: 'opacity 0.5s ease, transform 0.5s ease' }}
      >
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-6 h-6 text-black fill-black" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
            {t('auth.welcomeBack', 'Welcome Back!')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('auth.loginToContinue', 'Log in to continue')}
          </p>
        </div>

        {/* Social Login */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleSocialSignIn('google')}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-card border border-border rounded-xl text-foreground hover:bg-secondary/50 hover:border-border/80 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 font-medium text-sm disabled:opacity-60 shadow-sm"
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


          {/* Facebook — disabled: requires FB Business Verification for public login */}
          <div className="relative group">
            <button
              disabled
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2]/5 border border-[#1877F2]/10 rounded-xl text-foreground/40 cursor-not-allowed transition-all duration-200 font-medium text-sm"
            >
              <svg className="w-5 h-5 opacity-40" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Tiếp tục với Facebook
              <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                Beta
              </span>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
              Đang chờ xác minh doanh nghiệp Facebook. Dùng Google để đăng nhập.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">{t('auth.orContinueWith', 'Or continue with')} email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.emailOrUsername', 'Email or Username')}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                {...register('emailOrUsername')}
                placeholder={`Email / ${t('auth.username', 'Username')}`}
                autoComplete="email"
                className={inputCls(!!errors.emailOrUsername)}
              />
            </div>
            {errors.emailOrUsername && (
              <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-destructive" />
                {errors.emailOrUsername.message}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-foreground">{t('auth.password', 'Password')}</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium hover:underline">
                {t('auth.forgotPassword', 'Forgot password?')}
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle password visibility"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-destructive" />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* hCaptcha */}
          {siteKey && mounted && (
            <div className="flex justify-center pt-1">
              <HCaptcha
                sitekey={siteKey}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                theme="dark"
              />
            </div>
          )}

          {/* Inline error banner */}
          {authError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all h-auto text-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {t('auth.loggingIn', 'Logging in...')}
                </div>
              ) : t('auth.login', 'Login')}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t('auth.dontHaveAccount', "Don't have an account?")}{' '}
          <Link href="/register" className="text-primary hover:text-primary/80 font-bold transition-colors hover:underline">
            {t('auth.createAccountFree', 'Create free account')}
          </Link>
        </p>

        {/* Security Badges */}
        <div className="mt-6 pt-5 border-t border-border flex items-center justify-center gap-6">
          {['🔒 SSL', '🛡️ Escrow', '⚡ Web3'].map(badge => (
            <span key={badge} className="text-xs text-muted-foreground opacity-60 font-medium">{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
