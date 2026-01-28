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
import { wagmiConfig } from '@/lib/web3/config';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const paypalOptions = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
  currency: 'USD',
  intent: 'capture',
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <I18nextProvider i18n={i18n}>
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider>
                <PayPalScriptProvider options={paypalOptions}>
                  {children}
                  <Toaster position="top-right" richColors />
                </PayPalScriptProvider>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </I18nextProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
