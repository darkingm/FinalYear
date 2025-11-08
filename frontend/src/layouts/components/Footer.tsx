import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FiFacebook, 
  FiTwitter, 
  FiInstagram, 
  FiLinkedin,
  FiMail,
  FiPhone,
  FiMapPin
} from 'react-icons/fi';
import { motion } from 'framer-motion';

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    { icon: FiFacebook, url: 'https://facebook.com', label: 'Facebook' },
    { icon: FiTwitter, url: 'https://twitter.com', label: 'Twitter' },
    { icon: FiInstagram, url: 'https://instagram.com', label: 'Instagram' },
    { icon: FiLinkedin, url: 'https://linkedin.com', label: 'LinkedIn' },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
              <span className="text-2xl font-bold text-white">TokenAsset</span>
            </div>
            <p className="text-gray-400 mb-4">
              {t('nav.home')} - The future of real asset tokenization. Trade real-world assets with cryptocurrency.
            </p>
            <div className="flex space-x-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/about" 
                  className="hover:text-primary-400 transition-colors"
                >
                  {t('footer.about_us')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/products" 
                  className="hover:text-primary-400 transition-colors"
                >
                  {t('nav.products')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/faq" 
                  className="hover:text-primary-400 transition-colors"
                >
                  {t('footer.faq')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/support" 
                  className="hover:text-primary-400 transition-colors"
                >
                  {t('footer.support')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/privacy" 
                  className="hover:text-primary-400 transition-colors"
                >
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms" 
                  className="hover:text-primary-400 transition-colors"
                >
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/cookies" 
                  className="hover:text-primary-400 transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/disclaimer" 
                  className="hover:text-primary-400 transition-colors"
                >
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">{t('footer.contact_us')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <FiMapPin className="w-5 h-5 text-primary-400 flex-shrink-0 mt-1" />
                <span className="text-sm">
                  Ho Chi Minh City, Vietnam<br />
                  District 1, 123 Example Street
                </span>
              </li>
              <li className="flex items-center space-x-3">
                <FiPhone className="w-5 h-5 text-primary-400 flex-shrink-0" />
                <a 
                  href="tel:+84123456789" 
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  +84 123 456 789
                </a>
              </li>
              <li className="flex items-center space-x-3">
                <FiMail className="w-5 h-5 text-primary-400 flex-shrink-0" />
                <a 
                  href="mailto:support@tokenasset.com" 
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  support@tokenasset.com
                </a>
              </li>
            </ul>

            {/* Newsletter */}
            <div className="mt-6">
              <h4 className="text-white font-medium mb-2">{t('footer.subscribe')}</h4>
              <form className="flex">
                <input
                  type="email"
                  placeholder={t('footer.email_placeholder')}
                  className="flex-1 px-4 py-2 rounded-l-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-primary-500 text-sm"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-r-lg transition-colors text-sm font-medium"
                >
                  {t('footer.subscribe_button')}
                </motion.button>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-6 mt-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-gray-400">
              {t('footer.copyright').replace('2025', currentYear.toString())}
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>Made with ❤️ in Vietnam</span>
              <span>•</span>
              <span>Version 1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

