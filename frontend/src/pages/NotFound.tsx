import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHome } from 'react-icons/fi';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <motion.h1
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="text-9xl font-bold text-primary-600 dark:text-primary-400"
        >
          404
        </motion.h1>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn btn-primary flex items-center space-x-2 mx-auto"
          >
            <FiHome />
            <span>Back to Home</span>
          </motion.button>
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;

