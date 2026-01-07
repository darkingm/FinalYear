import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchCart } from '../store/thunks/cartThunks';

/**
 * Hook to sync cart with backend when user is authenticated
 */
export const useCartSync = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { items } = useSelector((state: RootState) => state.cart);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Fetch cart from backend when user logs in
      dispatch(fetchCart() as any);
    }
  }, [isAuthenticated, user?.id, dispatch]);

  return { isAuthenticated, items };
};

