import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import AuthModal from '../../components/AuthModal';

const LoginRegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [modalOpen, setModalOpen] = useState(true);
  
  // Determine initial mode from URL
  const mode = searchParams.get('mode') || (window.location.pathname === '/register' ? 'register' : 'login');

  useEffect(() => {
    // ✅ If already authenticated, redirect to home
    if (isAuthenticated) {
      navigate('/');
      return;
    }
  }, [isAuthenticated, navigate]);

  const handleClose = () => {
    setModalOpen(false);
    // Redirect to home after closing modal
    navigate('/');
  };

  // ✅ Nếu đã login thì không hiển thị gì (sẽ redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <AuthModal
        isOpen={modalOpen}
        onClose={handleClose}
        initialMode={mode as 'login' | 'register'}
      />
    </div>
  );
};

export default LoginRegisterPage;

