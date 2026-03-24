import type { Metadata, Viewport } from 'next';
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
    default: 'KienAI — Mua Sắm Thanh Toán Bằng Crypto | Web3 Marketplace',
    template: '%s | KienAI — Coin E-Commerce',
  },
  description:
    'KienAI - Nền tảng mua sắm thanh toán bằng coin hàng đầu Việt Nam. Buy with crypto, escrow thông minh, theo dõi cá voi on-chain. Hỗ trợ BTC, ETH, BNB, USDT trên BSC, Ethereum, Polygon.',
  keywords: [
    // Vietnamese SEO
    'mua sắm thanh toán bằng coin', 'thanh toán crypto', 'mua hàng bằng bitcoin',
    'mua bán NFT', 'marketplace blockchain', 'sàn giao dịch NFT',
    'ví điện tử', 'tiền điện tử', 'thanh toán phi tập trung',
    // English SEO
    'buy with crypto', 'coin ecommerce', 'crypto marketplace',
    'pay with bitcoin', 'Web3 marketplace', 'NFT marketplace',
    'smart contract escrow', 'decentralized payment',
    'whale tracker', 'on-chain analytics', 'DeFi',
    // Chain names
    'BSC', 'Ethereum', 'Polygon', 'BNB Chain',
    // Token names
    'Bitcoin', 'ETH', 'BNB', 'USDT', 'USDC',
  ],
  authors: [{ name: 'KienAI', url: 'https://kienai.id.vn' }],
  creator: 'KienAI',
  publisher: 'KienAI',
  metadataBase: new URL('https://kienai.id.vn'),
  alternates: {
    canonical: 'https://kienai.id.vn',
    languages: { 'vi-VN': 'https://kienai.id.vn', 'en-US': 'https://kienai.id.vn' },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    alternateLocale: 'en_US',
    url: 'https://kienai.id.vn',
    siteName: 'KienAI — Coin E-Commerce',
    title: 'KienAI — Mua Sắm Thanh Toán Bằng Crypto | Buy With Crypto',
    description:
      'Nền tảng mua sắm thanh toán bằng coin hàng đầu Việt Nam. Smart Contract Escrow bảo vệ giao dịch. Hỗ trợ BTC, ETH, BNB, USDT. On-Chain Analytics · Whale Tracker · Multi-chain.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KienAI — Buy & Sell with Crypto. Smart Contract Escrow Marketplace.',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KienAI — Mua Sắm Thanh Toán Bằng Crypto',
    description: 'Buy with crypto · Smart Contract Escrow · On-Chain Analytics · Whale Tracker · BTC ETH BNB USDT',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  category: 'ecommerce',
  other: {
    'apple-mobile-web-app-title': 'KienAI',
    'application-name': 'KienAI Marketplace',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// JSON-LD structured data for Google rich results
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'KienAI Marketplace',
  alternateName: 'KienAI — Coin E-Commerce',
  url: 'https://kienai.id.vn',
  description: 'Nền tảng mua sắm thanh toán bằng coin. Buy with crypto, smart contract escrow.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://kienai.id.vn/products?search={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: 'KienAI',
    url: 'https://kienai.id.vn',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
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
