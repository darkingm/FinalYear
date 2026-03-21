import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import dynamic from 'next/dynamic';

const GlobeBackground = dynamic(
  () => import('@/components/ui/GlobeBackground').then(m => ({ default: m.GlobeBackground })),
  { ssr: false }
);

const AIChatBubble = dynamic(
  () => import('@/components/ui/AIChatBubble').then(m => ({ default: m.AIChatBubble })),
  { ssr: false }
);

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Crypto Marketplace',
  description: 'Buy and sell with cryptocurrency',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <GlobeBackground />
          <AIChatBubble />
          {children}
        </Providers>
      </body>
    </html>
  );
}
