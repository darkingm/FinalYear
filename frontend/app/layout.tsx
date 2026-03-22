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
  title: {
    default: 'KienAI — Web3 NFT & Digital Marketplace',
    template: '%s | KienAI Marketplace',
  },
  description:
    'Mua bán NFT và sản phẩm số được bảo vệ bởi Smart Contract Escrow. Theo dõi cá voi on-chain, phân tích thanh khoản, giao dịch đa chuỗi BSC · ETH · Polygon.',
  keywords: [
    'NFT marketplace', 'Web3', 'DeFi', 'BSC', 'Ethereum', 'Polygon',
    'Smart Contract Escrow', 'Whale Tracker', 'On-Chain Analytics',
    'crypto trading', 'mua bán NFT', 'blockchain',
  ],
  authors: [{ name: 'KienAI', url: 'https://kienai.id.vn' }],
  creator: 'KienAI',
  metadataBase: new URL('https://kienai.id.vn'),
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://kienai.id.vn',
    siteName: 'KienAI Marketplace',
    title: 'KienAI — Web3 NFT & Digital Marketplace',
    description:
      'Nền tảng mua bán NFT & sản phẩm số bảo vệ bởi Smart Contract Escrow. On-Chain Analytics · Whale Tracker · Multi-chain.',
    images: [
      {
        url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        width: 200,
        height: 200,
        alt: 'KienAI — Web3 Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'KienAI — Web3 NFT & Digital Marketplace',
    description: 'Mua bán NFT · Smart Contract Escrow · On-Chain Analytics · Whale Tracker',
    images: ['https://cryptologos.cc/logos/ethereum-eth-logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
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
