'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import { toast } from 'sonner';
import { Lock, Zap, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const { t } = useClientTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            toast.error(t('auth.passwordMinLength', 'Password must be at least 8 characters'));
            return;
        }
        if (password !== confirmPassword) {
            toast.error(t('auth.passwordMismatch', 'Passwords do not match'));
            return;
        }
        setLoading(true);
        try {
            await apiClient.post('/api/auth/reset-password', { token, password });
            setSuccess(true);
            toast.success(t('auth.resetSuccess', 'Password reset successfully!'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('auth.resetFailed', 'Reset failed. Link may have expired.'));
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Zap className="w-12 h-12 text-destructive mx-auto" />
                    <h1 className="text-xl font-bold">{t('auth.invalidResetLink', 'Invalid reset link')}</h1>
                    <Link href="/forgot-password" className="text-primary hover:underline">
                        {t('auth.requestNewLink', 'Request a new reset link')}
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4 animate-in fade-in duration-500">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                    <h1 className="text-2xl font-bold">{t('auth.resetSuccess', 'Password Reset Successfully!')}</h1>
                    <p className="text-muted-foreground">{t('auth.canLoginNow', 'You can now login with your new password.')}</p>
                    <Link
                        href="/login"
                        className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all"
                    >
                        {t('auth.loginNow', 'Login Now')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Lock className="w-7 h-7 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">{t('auth.setNewPassword', 'Set New Password')}</h1>
                    <p className="text-muted-foreground text-sm">{t('auth.enterNewPassword', 'Enter your new password below')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type={showPw ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('auth.newPassword', 'New password')}
                            className="w-full pl-10 pr-10 py-3 rounded-xl border bg-secondary/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                            required
                            minLength={8}
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t('auth.confirmNewPassword', 'Confirm new password')}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border bg-secondary/50 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                            required
                            minLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('auth.resetPasswordBtn', 'Reset Password')}
                    </button>
                </form>
            </div>
        </div>
    );
}
