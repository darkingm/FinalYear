import { useState } from 'react';
import { motion } from 'framer-motion';
import HeroSection from './components/HeroSection';
import TopCoins from './components/TopCoins';
import ProductGrid from './components/ProductGrid';
import Features from './components/Features';
import AuthModal from '../../components/AuthModal';

const HomePage = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection 
        onLoginClick={() => {
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }}
        onRegisterClick={() => {
          setAuthModalMode('register');
          setAuthModalOpen(true);
        }}
      />

      {/* Top 10 Coins Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <TopCoins />
        </div>
      </section>

      {/* Product Grid Section - Sản phẩm đề xuất */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <ProductGrid />
        </div>
      </section>

      {/* Features Section - Why Choose TokenAsset */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <Features />
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
};

export default HomePage;

