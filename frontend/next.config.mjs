/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:3001';

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

  // Proxy /api/* → Express backend (skip /api/auth which is NextAuth)
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*', // handled by NextAuth — no proxy
      },
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@rainbow-me/rainbowkit',
      'framer-motion',
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
    }

    config.ignoreWarnings = [
      { module: /node_modules\/@metamask\/sdk/ },
      { file: /node_modules\/@metamask\/sdk/ },
    ];

    return config;
  },
};

export default nextConfig;
