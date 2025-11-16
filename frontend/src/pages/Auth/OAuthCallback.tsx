import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken'); // ✅ Lấy refreshToken
    const error = searchParams.get('error');

    if (error) {
      toast.error(`Authentication failed: ${error}`);
      navigate('/login');
      return;
    }

    if (token) {
      try {
        // Decode JWT to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        dispatch(setCredentials({
          user: {
            id: payload.id,
            email: payload.email,
            username: payload.username,
            fullName: payload.fullName || '', // ✅ Lấy fullName từ token
            role: payload.role,
          },
          accessToken: token,
          refreshToken: refreshToken, // ✅ Sử dụng refreshToken từ query params
        }));

        toast.success('Successfully logged in!');
        
        // Redirect based on role
        if (payload.role === 'ADMIN') {
          navigate('/dashboard/admin');
        } else if (payload.role === 'SUPPORT') {
          navigate('/dashboard/support');
        } else {
          navigate('/dashboard');
        }
      } catch (err) {
        toast.error('Invalid token received');
        navigate('/login');
      }
    } else {
      toast.error('No token received');
      navigate('/login');
    }
  }, [searchParams, navigate, dispatch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Completing authentication...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;

