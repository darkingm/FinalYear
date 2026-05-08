/** @type {import('next').NextConfig} */
import path from 'node:path';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:3001';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3005';
const TOKEN_SERVICE_URL = process.env.TOKEN_SERVICE_URL || 'http://localhost:3003';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),

  productionBrowserSourceMaps: false,

  // ─── Disable Client Router Cache ─────────────────────────────────────
  // Prevents stale RSC payload after deploy → fixes silent navigation failure
  // when user has an old tab open and clicks <Link> to a page with new chunk hashes.
  experimental: {
    staleTimes: {
      dynamic: 0,
      // Next.js requires static stale time to be at least 30 seconds.
      // HTML is still forced to revalidate via the page Cache-Control header below.
      static: 30,
    },
    optimizePackageImports: [
      'lucide-react',
      '@rainbow-me/rainbowkit',
      'wagmi',
      '@paypal/react-paypal-js',
      'framer-motion',
      'viem',
    ],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cryptologos.cc' },
      { protocol: 'https', hostname: 'assets.coincap.io' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'graph.facebook.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 's3.amazonaws.com' },
      { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Proxy rules — ORDER MATTERS (specific before general)
  async rewrites() {
    return [
      {
        // NextAuth — handled locally, never proxy
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
      {
        // AI service (Python FastAPI, port 3005) — must come BEFORE the catch-all
        source: '/api/ai/:path*',
        destination: `${AI_SERVICE_URL}/api/ai/:path*`,
      },
      {
        // Tokenization / RWA service (port 3003)
        source: '/api/rwa/:path*',
        destination: `${TOKEN_SERVICE_URL}/api/rwa/:path*`,
      },
      {
        // Everything else → Node.js main-service (port 3001)
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },

  // ─── Cache-Control headers for HTML pages ──────────────────────────────
  // Prevents browser from serving stale cached HTML after a new deployment.
  async headers() {
    return [
      {
        // Page routes only — no-cache HTML so browser always checks for updated bundles.
        // Exclude Next internals/static assets; Next already applies the correct immutable
        // cache policy for hashed chunks, and overriding it triggers build/dev warnings.
        source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
    ];
  },

  // ─── Turbopack is the default in Next 16 (`next dev/build --turbopack`). ──
  // The webpack() function below is only consumed when running with the
  // `--webpack` flag (e.g. `npm run build:webpack`). Turbopack handles the
  // pino-pretty / lokijs / @react-native-async-storage fallbacks and the
  // wagmi/viem/paypal chunk splitting automatically — no equivalent config
  // is needed on the Turbopack side.
  webpack: (config, { isServer }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'react-native': false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };

      // Split heavy Web3 + PayPal libraries into their own lazy-loaded chunks.
      // This prevents them from being inlined into app/layout.js.
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            ...config.optimization?.splitChunks?.cacheGroups,
            web3Vendor: {
              name: 'vendor-web3',
              test: /[\\/]node_modules[\\/](wagmi|viem|@wagmi|@rainbow-me|@walletconnect|@coinbase|@metamask)[^\\/]*[\\/]/,
              chunks: 'all',
              priority: 30,
              reuseExistingChunk: true,
            },
            paypalVendor: {
              name: 'vendor-paypal',
              test: /[\\/]node_modules[\\/]@paypal[\\/]/,
              chunks: 'all',
              priority: 30,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    config.ignoreWarnings = [
      { module: /node_modules\/@metamask\/sdk/ },
      { file: /node_modules\/@metamask\/sdk/ },
    ];

    return config;
  },
};

export default nextConfig;
