import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './store';
import { setTheme } from './store/slices/themeSlice';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import HomePage from './pages/Home';
import LoginRegisterPage from './pages/Auth/LoginRegister';
import ProductListPage from './pages/Products/ProductList';
import ProductDetailPage from './pages/Products/ProductDetail';
import CartPage from './pages/Cart';
import CheckoutPage from './pages/Checkout';
import ProfilePage from './pages/Profile';
import SellerApplyPage from './pages/Seller/Apply';
import DashboardPage from './pages/Dashboard';
import AdminDashboard from './pages/Dashboard/Admin';
import SupportDashboard from './pages/Dashboard/Support';
import AboutPage from './pages/About';
import NotFoundPage from './pages/NotFound';

function App() {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.theme.mode);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      dispatch(setTheme(savedTheme));
    }
  }, [dispatch]);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <Routes>
      {/* Public routes with main layout */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="cart" element={<CartPage />} />
      </Route>

      {/* Auth routes */}
      <Route path="/auth" element={<AuthLayout />}>
        <Route index element={<LoginRegisterPage />} />
      </Route>

      {/* Protected routes */}
      <Route path="/" element={<MainLayout />}>
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="seller/apply" element={<SellerApplyPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboard/admin" element={<AdminDashboard />} />
        <Route path="dashboard/support" element={<SupportDashboard />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

