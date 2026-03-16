'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import { toast } from 'sonner';
import { Mail, Zap, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

export default function ForgotPasswordPage() {
    const { t } = useClientTranslation();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setLoading(true);
        try {
            await apiClient.post('/api/auth/forgot-password', { email });
            setSent(true);
            toast.success(t('auth.resetLinkSent', 'Reset link sent! Check your email.'));
        } catch {
            toast.error(t('auth.resetLinkFailed', 'Failed to send reset link'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
            {/* Background glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[15%] left-[25%] w-72 h-72 bg-[#f0b90b]/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-[15%] right-[20%] w-96 h-96 bg-blue-600/8 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-3xl p-8 sm:p-10 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20">
                            <Zap className="w-6 h-6 text-black fill-black" />
                        </div>
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
                        {t('auth.forgotPasswordTitle', 'Forgot Password')}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {t('auth.forgotPasswordDesc', "Enter your email and we'll send you a reset link")}
                    </p>
                </div>

                {sent ? (
                    <div className="text-center animate-in fade-in zoom-in duration-500">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </div>
                        </div>
                        <h2 className="text-lg font-bold text-foreground mb-2">{t('auth.resetLinkSent', 'Reset link sent! Check your email.')}</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            We sent a reset link to <span className="text-primary font-medium">{email}</span>
                        </p>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('auth.backToLogin', 'Back to Login')}
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                {t('auth.email', 'Email')}
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    autoComplete="email"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-secondary/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-primary/60 focus:ring-primary/10 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('auth.sendingResetLink', 'Sending...')}
                                    </>
                                ) : t('auth.sendResetLink', 'Send Reset Link')}
                            </button>
                        </div>

                        <div className="text-center pt-2">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                {t('auth.backToLogin', 'Back to Login')}
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
