/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Optimize production builds
  productionBrowserSourceMaps: false,
  
  // Image optimization
  images: {
    domains: [
      'localhost',
      's3.amazonaws.com',
      'lh3.googleusercontent.com',
      'graph.facebook.com',
      'avatars.githubusercontent.com',
      'res.cloudinary.com',
      'via.placeholder.com',
    ],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@rainbow-me/rainbowkit',
      'framer-motion',
    ],
  },
  
  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Externalize heavy packages
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Fix MetaMask SDK warnings
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
    };
    
    // Optimize chunks
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                return `npm.${packageName?.replace('@', '')}`;
              },
              priority: 10,
              reuseExistingChunk: true,
            },
            commons: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;
