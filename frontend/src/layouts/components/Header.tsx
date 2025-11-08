import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { toggleTheme, setLanguage } from '../../store/slices/themeSlice';
import AuthModal from '../../components/AuthModal';
import { 
  FiShoppingCart, 
  FiUser, 
  FiSun, 
  FiMoon, 
  FiMenu, 
  FiX,
  FiSearch,
  FiGlobe,
  FiLogOut,
  FiSettings
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { mode, language } = useSelector((state: RootState) => state.theme);
  const { totalItems } = useSelector((state: RootState) => state.cart);

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  const handleLanguageToggle = () => {
    const newLang = language === 'en' ? 'vi' : 'en';
    dispatch(setLanguage(newLang));
    i18n.changeLanguage(newLang);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${searchQuery}`);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
    setUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-md transition-colors duration-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
              <span className="text-2xl font-bold gradient-text hidden sm:block">
                TokenAsset
              </span>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {t('nav.home')}
            </Link>
            <Link 
              to="/products" 
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {t('nav.products')}
            </Link>
            <Link 
              to="/about" 
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {t('nav.about')}
            </Link>
          </nav>

          {/* Search Bar (Desktop) */}
          <form onSubmit={handleSearch} className="hidden lg:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('home.search_placeholder')}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </form>

          {/* Right Side Icons */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleThemeToggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {mode === 'light' ? (
                <FiMoon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <FiSun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
            </motion.button>

            {/* Language Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLanguageToggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-1"
              aria-label="Toggle language"
            >
              <FiGlobe className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase">
                {language}
              </span>
            </motion.button>

            {/* Cart */}
            <Link to="/cart" className="relative">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Shopping cart"
              >
                <FiShoppingCart className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                {totalItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </motion.button>
            </Link>

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {user?.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.fullName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <FiUser className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  )}
                </motion.button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 border border-gray-200 dark:border-gray-700"
                    >
                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FiUser className="w-4 h-4" />
                        <span>{t('nav.profile')}</span>
                      </Link>
                      <Link
                        to="/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FiSettings className="w-4 h-4" />
                        <span>{t('nav.dashboard')}</span>
                      </Link>
                      <hr className="my-2 border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-red-600 dark:text-red-400"
                      >
                        <FiLogOut className="w-4 h-4" />
                        <span>{t('nav.logout')}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
                className="btn btn-primary"
              >
                {t('nav.login')}
              </motion.button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {mobileMenuOpen ? (
                <FiX className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              ) : (
                <FiMenu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700"
            >
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('home.search_placeholder')}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
              </form>

              {/* Mobile Navigation Links */}
              <nav className="flex flex-col space-y-2">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('nav.home')}
                </Link>
                <Link
                  to="/products"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('nav.products')}
                </Link>
                <Link
                  to="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('nav.about')}
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </header>
  );
};

export default Header;

