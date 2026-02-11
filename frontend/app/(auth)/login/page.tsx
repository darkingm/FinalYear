'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';
import { SiEthereum } from 'react-icons/si';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
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
        toast.error('Invalid email/username or password');
      } else {
        toast.success(t('auth.loginSuccess'));
        router.push('/');
      }
    } catch (error) {
      toast.error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (error) {
      toast.error('Google login failed');
    }
  };

  const handleFacebookLogin = async () => {
    try {
      await signIn('facebook', { callbackUrl: '/' });
    } catch (error) {
      toast.error('Facebook login failed');
    }
  };

  const handleWalletLogin = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setIsLoading(true);
      const message = `Sign this message to login to Crypto Marketplace\n\nNonce: ${Date.now()}`;
      const signature = await signMessageAsync({ message });

      const result = await signIn('wallet', {
        address,
        message,
        signature,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Wallet login failed');
      } else {
        toast.success(t('auth.loginSuccess'));
        router.push('/');
      }
    } catch (error) {
      toast.error('Failed to sign message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2">{t('auth.login')}</h1>
          <p className="text-center text-muted-foreground mb-8">
            Welcome back to Crypto Marketplace
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              {...register('emailOrUsername')}
              error={errors.emailOrUsername?.message}
              placeholder="user@example.com"
            />

            <Input
              label={t('auth.password')}
              type="password"
              {...register('password')}
              error={errors.password?.message}
              placeholder="••••••••"
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" />
                <span className="text-muted-foreground">{t('auth.rememberMe')}</span>
              </label>
              <Link href="/forgot-password" className="text-primary hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('common.loading') : t('auth.login')}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-800 px-2 text-muted-foreground">
                {t('auth.orContinueWith')}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3"
              onClick={handleGoogleLogin}
            >
              <FcGoogle className="w-5 h-5" />
              {t('auth.loginWithGoogle')}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3"
              onClick={handleFacebookLogin}
            >
              <FaFacebook className="w-5 h-5 text-blue-600" />
              {t('auth.loginWithFacebook')}
            </Button>

            <div className="border-t pt-3">
              {isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                  onClick={handleWalletLogin}
                  disabled={isLoading}
                >
                  <SiEthereum className="w-5 h-5" />
                  Sign Message to Login
                </Button>
              ) : (
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">{t('auth.dontHaveAccount')} </span>
            <Link href="/register" className="text-primary hover:underline">
              {t('auth.register')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
