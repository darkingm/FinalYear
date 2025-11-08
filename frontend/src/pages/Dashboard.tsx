import { motion } from 'framer-motion';

const DashboardPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-gray-900 dark:text-white mb-8"
        >
          Dashboard
        </motion.h1>
      </div>
    </div>
  );
};

export default DashboardPage;

