'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

function PasswordStrengthBar({ password, t }: { password: string, t: any }) {
  const checks = [
    { label: '8+', ok: password.length >= 8 },
    { label: 'a-z', ok: /[a-z]/.test(password) },
    { label: 'A-Z', ok: /[A-Z]/.test(password) },
    { label: '0-9', ok: /\d/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];

  if (!password) return null;

  return (
    <div className="mt-2.5">
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-secondary'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1">
            {c.ok
              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              : <XCircle className="w-3.5 h-3.5 text-muted-foreground/50" />}
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${c.ok ? 'text-foreground' : 'text-muted-foreground'}`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    try {
      await signIn(provider, { callbackUrl: '/' });
    } catch {
      toast.error('Đăng nhập thất bại. Vui lòng thử lại');
      setSocialLoading(null);
    }
  };

  // Dynamic schema inside to use translations
  const registerSchema = z.object({
    email: z.string().email('Email ' + t('common.error', 'Error')),
    username: z.string().min(3).max(20),
    password: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    confirmPassword: z.string(),
    terms: z.boolean().refine(val => val === true, t('auth.agreeToTerms', 'I agree to the Terms and Conditions')),
  }).refine(d => d.password === d.confirmPassword, {
    message: t('auth.confirmPassword', 'Confirm Password') + ' ' + t('common.error', 'Error'),
    path: ['confirmPassword'],
  });

  type RegisterFormData = z.infer<typeof registerSchema>;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');

  const onSubmit = async (data: RegisterFormData) => {
    if (siteKey && !captchaToken) {
      toast.error(t('auth.completeCaptcha', 'Please complete the CAPTCHA'));
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.post('/api/auth/register', {
        email: data.email,
        username: data.username,
        password: data.password,
        captcha: captchaToken || 'no-captcha',
      });
      toast.success(t('auth.registerSuccess', 'Registration successful!'));
      router.push('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error', 'Error'));
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = (hasError: boolean) =>
    `w-full pl-10 pr-4 py-3 bg-secondary/30 border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm ${hasError
      ? 'border-destructive/50 focus:ring-destructive/20'
      : 'border-border focus:border-primary/60 focus:ring-primary/10'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4 sm:p-6">
      {/* Background glowing effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[20%] w-72 h-72 bg-[#f0b90b]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] left-[20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
      </div>

      <div className="w-full max-w-[460px] bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-3xl p-8 sm:p-10 relative z-10 transition-all duration-300 hover:border-primary/20 mt-16 sm:mt-8 mb-8">

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Zap className="w-6 h-6 text-black fill-black" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
            {t('auth.createAccount', 'Create Account')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('auth.noCreditCard', 'Free to join, no credit card required')}
          </p>
        </div>

        {/* Social Sign Up */}
        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => handleSocialSignIn('google')}
            disabled={!!socialLoading || isLoading}
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
            Đăng ký với Google
          </button>


          {/* Facebook — disabled: requires FB Business Verification for public login */}
          <div className="relative group">
            <button
              type="button"
              disabled
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2]/5 border border-[#1877F2]/10 rounded-xl text-foreground/40 cursor-not-allowed transition-all duration-200 font-medium text-sm"
            >
              <svg className="w-5 h-5 opacity-40" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Đăng ký với Facebook
              <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                Beta
              </span>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
              Đang chờ xác minh doanh nghiệp Facebook. Dùng Google để đăng ký.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">Hoặc đăng ký bằng email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.email', 'Email')}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                {...register('email')}
                placeholder="user@example.com"
                autoComplete="email"
                className={fieldClass(!!errors.email)}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-destructive" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.username', 'Username')}</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                {...register('username')}
                placeholder="johndoe"
                autoComplete="username"
                className={fieldClass(!!errors.username)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.password', 'Password')}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPw ? 'text' : 'password'}
                {...register('password')}
                placeholder="••••••••"
                autoComplete="new-password"
                className={`${fieldClass(!!errors.password)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthBar password={password} t={t} />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.confirmPassword', 'Confirm Password')}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showConfirm ? 'text' : 'password'}
                {...register('confirmPassword')}
                placeholder="••••••••"
                autoComplete="new-password"
                className={`${fieldClass(!!errors.confirmPassword)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-destructive" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Terms */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  {...register('terms')}
                  className="peer w-4 h-4 opacity-0 absolute inset-0 cursor-pointer"
                />
                <div className="w-5 h-5 border-2 border-muted-foreground/30 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
              </div>
              <span className="text-sm text-muted-foreground leading-relaxed">
                {t('auth.termsText', 'I agree to the')} <Link href="#" className="text-primary hover:underline font-medium">{t('auth.termsLink', 'Terms of Service')}</Link> {t('auth.and', 'and')} <Link href="#" className="text-primary hover:underline font-medium">{t('auth.privacyPolicy', 'Privacy Policy')}</Link>
              </span>
            </label>
            {errors.terms && <p className="mt-1.5 text-xs text-destructive pl-8">{errors.terms.message}</p>}
          </div>

          {/* hCaptcha */}
          {siteKey && mounted && (
            <div className="flex justify-center pt-2">
              <HCaptcha
                sitekey={siteKey}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                theme="dark"
              />
            </div>
          )}

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all h-auto text-sm"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {t('auth.creatingAccount', 'Creating account...')}
                </div>
              ) : t('auth.createAccountFree', 'Create free account')}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t('auth.alreadyHaveAccount', 'Already have an account?')}{' '}
          <Link href="/login" className="text-primary hover:text-primary/80 font-bold transition-colors">
            {t('auth.login', 'Login')}
          </Link>
        </p>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-2">
          <Zap className="w-3.5 h-3.5 text-primary" />
          {t('auth.connectWalletAfter', 'After logging in, you can connect your crypto wallet for payments.')}
        </p>
      </div>
    </div>
  );
}
