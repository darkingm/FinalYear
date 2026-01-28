'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20),
  wallet_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
    .optional()
    .or(z.literal('')),
  terms: z.boolean().refine((val) => val === true, 'You must agree to the terms'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');

  const onSubmit = async (data: RegisterFormData) => {
    if (!captchaToken) {
      toast.error(t('auth.completeCaptcha'));
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/api/auth/register', {
        ...data,
        captcha: captchaToken,
      });

      toast.success(t('auth.registerSuccess'));
      router.push('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2">{t('auth.register')}</h1>
          <p className="text-center text-muted-foreground mb-8">
            {t('auth.createAccount')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="user@example.com"
            />

            <Input
              label={t('auth.username')}
              {...register('username')}
              error={errors.username?.message}
              placeholder="johndoe"
            />

            <div>
              <Input
                label={t('auth.password')}
                type="password"
                {...register('password')}
                error={errors.password?.message}
                placeholder="••••••••"
              />
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i < passwordStrength
                            ? passwordStrength <= 2
                              ? 'bg-red-500'
                              : passwordStrength <= 3
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password strength:{' '}
                    {passwordStrength <= 2
                      ? 'Weak'
                      : passwordStrength <= 3
                      ? 'Medium'
                      : 'Strong'}
                  </p>
                </div>
              )}
            </div>

            <Input
              label="Wallet Address (optional)"
              {...register('wallet_address')}
              error={errors.wallet_address?.message}
              placeholder="0x..."
            />

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                {...register('terms')}
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground">
                {t('auth.agreeToTerms')}
              </label>
            </div>
            {errors.terms && (
              <p className="text-sm text-destructive">{errors.terms.message}</p>
            )}

            <div className="flex justify-center">
              <HCaptcha
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001'}
                onVerify={setCaptchaToken}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !captchaToken}>
              {isLoading ? t('common.loading') : t('auth.createAccount')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">{t('auth.alreadyHaveAccount')} </span>
            <Link href="/login" className="text-primary hover:underline">
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
