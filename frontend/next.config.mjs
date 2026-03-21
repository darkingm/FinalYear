/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:3001';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3005';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',

  eslint: {
    ignoreDuringBuilds: true,
  },

  productionBrowserSourceMaps: false,

  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
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
        // Everything else → Node.js main-service (port 3001)
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@rainbow-me/rainbowkit',
      'wagmi',
      '@paypal/react-paypal-js',
      'framer-motion',
      'viem',
    ],
    missingSuspenseWithCSRBailout: false,
  },

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
