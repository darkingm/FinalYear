'use client';

import { useState, useEffect, useMemo } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { I18nextProvider } from 'react-i18next';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import i18n from '@/lib/i18n/config';
import { getWagmiConfig } from '@/lib/web3/config';
import '@rainbow-me/rainbowkit/styles.css';

const paypalOptions = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
  currency: 'USD',
  intent: 'capture',
};

/** Only mount Wagmi/RainbowKit on client after mount to avoid "WalletConnect Core is already initialized" (multiple inits from SSR + client + Strict Mode). */
function ClientWalletProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 5000, gcTime: 10 * 60 * 1000 },
        },
      }),
    []
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <PayPalScriptProvider options={paypalOptions} deferLoading={true}>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-pulse text-muted-foreground">Loading…</div>
        </div>
        <Toaster position="top-right" richColors closeButton />
      </PayPalScriptProvider>
    );
  }

  return (
    <WagmiProvider config={getWagmiConfig()}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact" showRecentTransactions={false}>
          <PayPalScriptProvider options={paypalOptions} deferLoading={true}>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </PayPalScriptProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <I18nextProvider i18n={i18n}>
          <ClientWalletProviders>{children}</ClientWalletProviders>
        </I18nextProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
