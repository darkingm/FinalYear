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

// Singleton QueryClient — avoids re-creation on re-renders/hot reload
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,        // 30s — reduce redundant API calls
      gcTime: 10 * 60 * 1000,  // 10min cache
    },
  },
});

/**
 * Wallet providers mount only on client to avoid SSR hydration mismatch
 * and "WalletConnect Core is already initialized" errors.
 * IMPORTANT: Children are always rendered — we don't block on mount.
 * Before mount: WagmiProvider/RainbowKit simply not present (wallet features
 * show "Connect" state). After mount: full Web3 functionality available.
 */
function ClientWalletProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const wagmiConfig = useMemo(() => getWagmiConfig(), []);

  useEffect(() => { setMounted(true); }, []);

  // Before client mount: render children WITHOUT wallet context
  // (wallet-dependent components should gracefully handle missing context)
  if (!mounted) {
    return (
      <PayPalScriptProvider options={paypalOptions} deferLoading={true}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </PayPalScriptProvider>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
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
