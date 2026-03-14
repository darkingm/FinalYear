/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',

  // Optimize production builds
  productionBrowserSourceMaps: false,

  // Reduce bundle size
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // Image optimization
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
    ],
    formats: ['image/webp', 'image/avif'],
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@rainbow-me/rainbowkit',
      'framer-motion',
    ],
    // Suppress CSR-bailout errors for pages using Web3/Wagmi hooks
    // These pages are always client-rendered (auth-gated) so SSR fallback is expected
    missingSuspenseWithCSRBailout: false,
  },

  // Webpack optimizations
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

