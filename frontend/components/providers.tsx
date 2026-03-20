'use client';

import dynamic from 'next/dynamic';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/config';

/**
 * WalletProviders is dynamically imported with ssr:false.
 *
 * WHY: wagmi + RainbowKit + PayPal together produce ~7-8 MB of JS.
 * When imported statically, they're bundled into app/layout.js, causing a
 * ChunkLoadError timeout in the browser (9.6 MB chunk). By using dynamic(),
 * Next.js splits them into a separate lazy chunk that loads after hydration,
 * keeping layout.js small and fast.
 */
const WalletProviders = dynamic(() => import('./wallet-providers'), {
  ssr: false,
  // Show nothing while the wallet chunk loads (it's background-only, no visible UI change)
  loading: () => null,
});

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
