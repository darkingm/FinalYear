import { motion } from 'framer-motion';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            About TokenAsset
          </h1>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-xl text-gray-600 dark:text-gray-400">
              TokenAsset is a revolutionary platform for tokenizing and trading real-world assets using cryptocurrency.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutPage;

