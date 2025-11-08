import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const ProfilePage = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-gray-900 dark:text-white mb-8"
        >
          My Profile
        </motion.h1>
        {user && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <p className="text-gray-900 dark:text-white">
              Welcome, {user.fullName}!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;

