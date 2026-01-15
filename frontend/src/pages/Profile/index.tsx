import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import CoinBalance from '../../components/CoinBalance';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  PencilIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  CameraIcon,
  CheckCircleIcon,
  TruckIcon,
  CubeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface UserProfile {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  address?: string;
  role: string;
  isSeller: boolean;
  sellerVerified: boolean;
  shopName?: string;
  shopDescription?: string;
  showCoinBalance: boolean;
  showJoinDate: boolean;
  showEmail: boolean;
  showPhone: boolean;
  totalSales: number;
  totalPurchases: number;
  rating: number;
  createdAt: string;
}

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ✅ THÊM: Ref để track xem đã gọi API chưa, tránh gọi nhiều lần
  const fetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    phone: '',
    dateOfBirth: '',
    country: '',
    city: '',
    address: '',
  });
  const [privacySettings, setPrivacySettings] = useState({
    showCoinBalance: true,
    showJoinDate: true,
    showEmail: false,
    showPhone: false,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // ✅ SỬA: Loại bỏ navigate khỏi dependency array (navigate là stable)
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // ✅ THÊM: Check xem đã gọi API gần đây chưa (trong vòng 2 giây)
    const now = Date.now();
    if (fetchingRef.current || (now - lastFetchTimeRef.current < 2000)) {
      return;
    }
    fetchProfile();
    fetchOrders();
  }, [user]); // ✅ CHỈ giữ user trong dependency

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      const response = await axios.get('/api/v1/orders');
      if (response.data.success) {
        const ordersData = response.data.data.orders || response.data.data || [];
        // Show all orders, sort by date (newest first)
        const sortedOrders = ordersData.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.date || 0).getTime();
          const dateB = new Date(b.createdAt || b.date || 0).getTime();
          return dateB - dateA;
        });
        setOrders(sortedOrders);
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      if (error.response?.status !== 404) {
        toast.error('Failed to load orders');
      }
      setOrders([]); // Set empty array on error
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchProfile = async () => {
    // ✅ THÊM: Guard để tránh gọi API nhiều lần
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    lastFetchTimeRef.current = Date.now();

    try {
      setLoading(true);
      const response = await axios.get('/api/v1/users/profile');
      const data = response.data.data;
      setProfile(data);
      setFormData({
        fullName: data.fullName || '',
        bio: data.bio || '',
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
        country: data.country || '',
        city: data.city || '',
        address: data.address || '',
      });
      setPrivacySettings({
        showCoinBalance: data.showCoinBalance ?? true,
        showJoinDate: data.showJoinDate ?? true,
        showEmail: data.showEmail ?? false,
        showPhone: data.showPhone ?? false,
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      
      // ✅ THÊM: Xử lý 429 error riêng
      if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
        // ✅ Không retry ngay, để user tự refresh
        return;
      }
      
      // Auto-create profile if not found
      if (error.response?.status === 404 && user) {
        try {
          const createResponse = await axios.post('/api/v1/users/profile', {
            fullName: user.fullName || user.username,
            email: user.email,
            username: user.username,
          });
          setProfile(createResponse.data.data);
          toast.success('Profile created successfully');
          
          // ✅ SỬA: Không gọi lại fetchProfile ngay, chỉ update state
          // Thay vì gọi lại API, sử dụng data từ createResponse
          setFormData({
            fullName: createResponse.data.data.fullName || '',
            bio: createResponse.data.data.bio || '',
            phone: createResponse.data.data.phone || '',
            dateOfBirth: createResponse.data.data.dateOfBirth ? createResponse.data.data.dateOfBirth.split('T')[0] : '',
            country: createResponse.data.data.country || '',
            city: createResponse.data.data.city || '',
            address: createResponse.data.data.address || '',
          });
          setPrivacySettings({
            showCoinBalance: createResponse.data.data.showCoinBalance ?? true,
            showJoinDate: createResponse.data.data.showJoinDate ?? true,
            showEmail: createResponse.data.data.showEmail ?? false,
            showPhone: createResponse.data.data.showPhone ?? false,
          });
        } catch (createError: any) {
          console.error('Error creating profile:', createError);
          if (createError.response?.status === 429) {
            toast.error('Too many requests. Please wait a moment and try again.');
          } else {
            toast.error('Failed to create profile');
          }
        }
      } else {
        toast.error('Failed to load profile');
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await axios.put('/api/v1/users/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProfile((prev) => prev ? { ...prev, avatar: response.data.data.avatar } : null);
      toast.success('Avatar updated successfully');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      // ✅ THÊM: Xử lý 429 error
      if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to upload avatar');
      }
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      await axios.put('/api/v1/users/profile', formData);
      
      // ✅ SỬA: Chỉ fetch lại nếu cần, hoặc update state trực tiếp
      // await fetchProfile(); // ❌ XÓA dòng này để tránh gọi API thêm
      
      // ✅ THÊM: Update profile state trực tiếp
      if (profile) {
        setProfile({
          ...profile,
          ...formData,
        });
      }
      
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      // ✅ THÊM: Error logging chi tiết
      console.error('Error updating profile:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Request payload:', formData);
      
      // ✅ THÊM: Xử lý 429 error
      if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    try {
      await axios.put('/api/v1/users/profile/privacy', privacySettings);
      toast.success('Privacy settings updated');
    } catch (error: any) {
      console.error('Error updating privacy:', error);
      // ✅ THÊM: Xử lý 429 error
      if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
      } else {
        toast.error('Failed to update privacy settings');
      }
    }
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profile not found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Please try refreshing the page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Avatar with upload */}
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.fullName} className="w-full h-full object-cover" />
                  ) : (
                    profile.username.charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-700"
                >
                  {uploadingAvatar ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <CameraIcon className="w-5 h-5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {profile.fullName}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">@{profile.username}</p>
                {profile.isSeller && (
                  <div className="flex items-center space-x-2 mt-2">
                    <ShieldCheckIcon className={`w-5 h-5 ${profile.sellerVerified ? 'text-green-500' : 'text-yellow-500'}`} />
                    <span className={`text-sm font-medium ${profile.sellerVerified ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {profile.sellerVerified ? 'Verified Seller' : 'Seller (Pending Verification)'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex space-x-3">
              {profile.isSeller && (
                <button
                  onClick={() => navigate('/seller/dashboard')}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <ShieldCheckIcon className="w-5 h-5" />
                  <span>Seller Dashboard</span>
                </button>
              )}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <PencilIcon className="w-5 h-5" />
                <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Personal Information
              </h2>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bio
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <InfoItem icon={UserIcon} label="Full Name" value={profile.fullName} />
                  {profile.bio && <InfoItem icon={UserIcon} label="Bio" value={profile.bio} />}
                  {profile.showEmail && <InfoItem icon={EnvelopeIcon} label="Email" value={profile.email} />}
                  {profile.showPhone && profile.phone && <InfoItem icon={PhoneIcon} label="Phone" value={profile.phone} />}
                  {(profile.country || profile.city) && (
                    <InfoItem
                      icon={MapPinIcon}
                      label="Location"
                      value={`${profile.city || ''}${profile.city && profile.country ? ', ' : ''}${profile.country || ''}`}
                    />
                  )}
                  {profile.showJoinDate && (
                    <InfoItem
                      icon={CalendarIcon}
                      label="Joined"
                      value={new Date(profile.createdAt).toLocaleDateString()}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Seller Info */}
            {profile.isSeller && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Seller Information
                </h2>
                <div className="space-y-3">
                  <InfoItem icon={ShieldCheckIcon} label="Shop Name" value={profile.shopName || 'N/A'} />
                  {profile.shopDescription && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Shop Description</p>
                      <p className="text-sm text-gray-900 dark:text-white">{profile.shopDescription}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <StatItem label="Total Sales" value={profile.totalSales} />
                    <StatItem label="Rating" value={`${profile.rating.toFixed(1)}/5`} />
                    <StatItem label="Total Purchases" value={profile.totalPurchases} />
                  </div>
                </div>
              </div>
            )}

            {/* Active Orders */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Đơn hàng đang xử lý
                </h2>
                <button
                  onClick={() => navigate('/orders')}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Xem tất cả
                </button>
              </div>
              {loadingOrders ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <OrderTrackingCard key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CubeIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Không có đơn hàng đang xử lý
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Statistics
              </h2>
              <div className="space-y-3">
                <StatItem label="Total Purchases" value={profile.totalPurchases} />
                {profile.isSeller && <StatItem label="Total Sales" value={profile.totalSales} />}
                {profile.isSeller && <StatItem label="Rating" value={`${profile.rating.toFixed(1)}/5`} />}
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Privacy Settings
              </h2>
              <div className="space-y-3">
                <PrivacyToggle
                  label="Show Coin Balance"
                  checked={privacySettings.showCoinBalance}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showCoinBalance: checked })
                  }
                />
                <PrivacyToggle
                  label="Show Join Date"
                  checked={privacySettings.showJoinDate}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showJoinDate: checked })
                  }
                />
                <PrivacyToggle
                  label="Show Email"
                  checked={privacySettings.showEmail}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showEmail: checked })
                  }
                />
                <PrivacyToggle
                  label="Show Phone"
                  checked={privacySettings.showPhone}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showPhone: checked })
                  }
                />
                <button
                  onClick={handleSavePrivacy}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save Privacy Settings
                </button>
              </div>
            </div>

            {/* Become Seller */}
            {!profile.isSeller && (
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-md p-6 text-white">
                <h2 className="text-xl font-bold mb-2">Become a Seller</h2>
                <p className="text-sm mb-4 opacity-90">
                  Start selling your products and accept cryptocurrency payments
                </p>
                <button
                  onClick={() => navigate('/seller/apply')}
                  className="block w-full px-4 py-2 bg-white text-purple-600 text-center rounded-lg hover:bg-gray-100 transition font-semibold"
                >
                  Apply Now
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center space-x-3">
      <Icon className="w-5 h-5 text-gray-400" />
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-lg font-bold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function PrivacyToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function OrderTrackingCard({ order }: { order: any }) {
  const navigate = useNavigate();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'CONFIRMED':
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'SHIPPING':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <ClockIcon className="w-5 h-5" />;
      case 'CONFIRMED':
      case 'PROCESSING':
        return <CubeIcon className="w-5 h-5" />;
      case 'SHIPPING':
        return <TruckIcon className="w-5 h-5" />;
      case 'DELIVERED':
        return <CheckCircleIcon className="w-5 h-5" />;
      default:
        return <CubeIcon className="w-5 h-5" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Đang chờ xử lý';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'PROCESSING':
        return 'Đang xử lý';
      case 'SHIPPING':
        return 'Đang vận chuyển';
      case 'DELIVERED':
        return 'Đã giao hàng';
      default:
        return status;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/orders/${order.id}`)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon(order.orderStatus)}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {order.orderNumber}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(order.date || order.createdAt).toLocaleDateString('vi-VN')}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(order.orderStatus)}`}>
          {getStatusIcon(order.orderStatus)}
          <span>{getStatusText(order.orderStatus)}</span>
        </span>
      </div>

      {order.trackingNumber && (
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <TruckIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Mã vận đơn:</span>
            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
              {order.trackingNumber}
            </span>
          </div>
          {order.shippedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Đã gửi: {new Date(order.shippedAt).toLocaleDateString('vi-VN')}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Tổng tiền: </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            ${order.total?.toFixed(2) || order.totalInUSD?.toFixed(2) || '0.00'}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orders/${order.id}`);
          }}
          className="text-primary-600 dark:text-primary-400 hover:underline"
        >
          Xem chi tiết →
        </button>
      </div>
    </motion.div>
  );
}