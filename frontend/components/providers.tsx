'use client';

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
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

// Module-level singleton — same instance every render
const wagmiConfig = getWagmiConfig();

/**
 * WalletProviders — always renders WagmiProvider (wagmi v2 + ssr: true is SSR-safe).
 * Previously had a `mounted` guard that caused WagmiProviderNotFoundError during
 * Next.js static prerendering. Wagmi v2 with ssr: true handles server rendering
 * gracefully — hooks return empty/undefined defaults until client hydrates.
 */
function WalletProviders({ children }: { children: React.ReactNode }) {
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
          <WalletProviders>{children}</WalletProviders>
        </I18nextProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
