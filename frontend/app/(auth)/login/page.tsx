'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, Zap, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Dynamic schema inside component to use translations
  const loginSchema = z.object({
    emailOrUsername: z.string().min(1, t('auth.emailOrUsername') + ' ' + t('common.error')),
    password: z.string().min(1, t('auth.password') + ' ' + t('common.error')),
  });
  type LoginFormData = z.infer<typeof loginSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: data.emailOrUsername,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error(t('auth.emailPasswordIncorrect'));
      } else {
        toast.success(t('auth.loginSuccess'));
        router.push('/');
      }
    } catch {
      toast.error(t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch {
      toast.error(t('auth.loginFailed'));
      setGoogleLoading(false);
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full pl-10 pr-4 py-3 bg-secondary/30 border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm ${hasError
      ? 'border-destructive/50 focus:ring-destructive/20'
      : 'border-border focus:border-primary/60 focus:ring-primary/10'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4 sm:p-6">
      {/* Background glowing effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-72 h-72 bg-[#f0b90b]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
      </div>

      <div className="w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-3xl p-8 sm:p-10 relative z-10 transition-all duration-300 hover:border-primary/20">

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Zap className="w-6 h-6 text-black fill-black" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
            {t('auth.welcomeBack')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('auth.loginToContinue')}
          </p>
        </div>

        {/* Social Login */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-card border border-border rounded-xl text-foreground hover:bg-secondary/50 hover:border-border/80 transition-all duration-200 mb-6 font-medium text-sm disabled:opacity-60 shadow-sm"
        >
          {googleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {t('auth.loginWithGoogle')}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">{t('auth.orContinueWith')} email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.emailOrUsername')}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                {...register('emailOrUsername')}
                placeholder={`Email / ${t('auth.username')}`}
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
              <label className="block text-sm font-medium text-foreground">{t('auth.password')}</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                {t('auth.forgotPassword')}
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

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all h-auto text-sm"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.loggingIn')}
                </div>
              ) : t('auth.login')}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t('auth.dontHaveAccount')}{' '}
          <Link href="/register" className="text-primary hover:text-primary/80 font-bold transition-colors">
            {t('auth.createAccountFree')}
          </Link>
        </p>

        {/* Security Badges */}
        <div className="mt-8 pt-6 border-t border-border flex items-center justify-center gap-6">
          {['🔒 SSL Secured', '🛡️ Escrow', '⚡ Web3'].map(badge => (
            <span key={badge} className="text-xs text-muted-foreground opacity-60 font-medium">{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
