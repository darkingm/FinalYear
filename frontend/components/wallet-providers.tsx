'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Toaster } from 'sonner';
import { getWagmiConfig } from '@/lib/web3/config';
import '@rainbow-me/rainbowkit/styles.css';

const paypalOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
    currency: 'USD',
    intent: 'capture',
};

// Singletons — created once, never recreated on re-renders / hot reload
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

const wagmiConfig = getWagmiConfig();

export default function WalletProviders({ children }: { children: React.ReactNode }) {
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
