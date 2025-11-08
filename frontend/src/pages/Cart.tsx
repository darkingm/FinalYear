import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const CartPage = () => {
  const { items, totalItems, totalCoins, totalUSD } = useSelector((state: RootState) => state.cart);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-gray-900 dark:text-white mb-8"
        >
          Shopping Cart ({totalItems})
        </motion.h1>
        
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Your cart is empty
            </p>
          </div>
        ) : (
          <div>
            {/* Cart items will be here */}
            <p className="text-gray-900 dark:text-white">
              Total: {totalCoins} coins (${totalUSD})
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;

