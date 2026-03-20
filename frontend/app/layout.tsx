import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import dynamic from 'next/dynamic';

const ParticleBackground = dynamic(
  () => import('@/components/ui/ParticleBackground').then(m => ({ default: m.ParticleBackground })),
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
          <ParticleBackground />
          {children}
        </Providers>
      </body>
    </html>
  );
}
