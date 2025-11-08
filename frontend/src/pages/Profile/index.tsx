import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import axios from '../../api/axios';
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
  const { user } = useSelector((state: RootState) => state.auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/api/v1/users/profile');
      const data = response.data.data;
      setProfile(data);
      setFormData({
        fullName: data.fullName || '',
        bio: data.bio || '',
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth || '',
        country: data.country || '',
        city: data.city || '',
        address: data.address || '',
      });
      setPrivacySettings({
        showCoinBalance: data.showCoinBalance,
        showJoinDate: data.showJoinDate,
        showEmail: data.showEmail,
        showPhone: data.showPhone,
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await axios.put('/api/v1/users/profile', formData);
      await fetchProfile();
      setIsEditing(false);
      alert(t('profile.updated'));
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(t('profile.updateError'));
    }
  };

  const handleSavePrivacy = async () => {
    try {
      await axios.put('/api/v1/users/profile/privacy', privacySettings);
      alert(t('profile.privacyUpdated'));
    } catch (error) {
      console.error('Error updating privacy:', error);
    }
  };

  if (loading) {
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
            {t('profile.notFound')}
          </h2>
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
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profile.fullName}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">@{profile.username}</p>
                {profile.isSeller && (
                  <div className="flex items-center space-x-2 mt-1">
                    <ShieldCheckIcon className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {profile.sellerVerified ? t('profile.verifiedSeller') : t('profile.seller')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <PencilIcon className="w-5 h-5" />
              <span>{isEditing ? t('common.cancel') : t('profile.edit')}</span>
            </button>
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
                {t('profile.personalInfo')}
              </h2>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('profile.fullName')}
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('profile.bio')}
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.phone')}
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.dateOfBirth')}
                      </label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.country')}
                      </label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.city')}
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('profile.address')}
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    {t('common.save')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <InfoItem icon={UserIcon} label={t('profile.fullName')} value={profile.fullName} />
                  {profile.bio && <InfoItem icon={UserIcon} label={t('profile.bio')} value={profile.bio} />}
                  <InfoItem icon={EnvelopeIcon} label={t('profile.email')} value={profile.email} />
                  {profile.phone && <InfoItem icon={PhoneIcon} label={t('profile.phone')} value={profile.phone} />}
                  {profile.country && (
                    <InfoItem
                      icon={MapPinIcon}
                      label={t('profile.location')}
                      value={`${profile.city}, ${profile.country}`}
                    />
                  )}
                  {profile.showJoinDate && (
                    <InfoItem
                      icon={CalendarIcon}
                      label={t('profile.joined')}
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
                  {t('profile.sellerInfo')}
                </h2>
                <div className="space-y-3">
                  <InfoItem icon={ShieldCheckIcon} label={t('profile.shopName')} value={profile.shopName || 'N/A'} />
                  <InfoItem icon={ShieldCheckIcon} label={t('profile.totalSales')} value={profile.totalSales.toString()} />
                  <InfoItem icon={ShieldCheckIcon} label={t('profile.rating')} value={`${profile.rating}/5`} />
                </div>
              </div>
            )}
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
                {t('profile.statistics')}
              </h2>
              <div className="space-y-3">
                <StatItem label={t('profile.totalPurchases')} value={profile.totalPurchases} />
                {profile.isSeller && <StatItem label={t('profile.totalSales')} value={profile.totalSales} />}
                {profile.isSeller && <StatItem label={t('profile.rating')} value={`${profile.rating}/5`} />}
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {t('profile.privacy')}
              </h2>
              <div className="space-y-3">
                <PrivacyToggle
                  label={t('profile.showCoinBalance')}
                  checked={privacySettings.showCoinBalance}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showCoinBalance: checked })
                  }
                />
                <PrivacyToggle
                  label={t('profile.showJoinDate')}
                  checked={privacySettings.showJoinDate}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showJoinDate: checked })
                  }
                />
                <PrivacyToggle
                  label={t('profile.showEmail')}
                  checked={privacySettings.showEmail}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showEmail: checked })
                  }
                />
                <PrivacyToggle
                  label={t('profile.showPhone')}
                  checked={privacySettings.showPhone}
                  onChange={(checked) =>
                    setPrivacySettings({ ...privacySettings, showPhone: checked })
                  }
                />
                <button
                  onClick={handleSavePrivacy}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {t('profile.savePrivacy')}
                </button>
              </div>
            </div>

            {/* Become Seller */}
            {!profile.isSeller && (
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-md p-6 text-white">
                <h2 className="text-xl font-bold mb-2">{t('profile.becomeSeller')}</h2>
                <p className="text-sm mb-4">{t('profile.becomeSellerDesc')}</p>
                <a
                  href="/seller/apply"
                  className="block w-full px-4 py-2 bg-white text-purple-600 text-center rounded-lg hover:bg-gray-100 transition font-semibold"
                >
                  {t('profile.applyNow')}
                </a>
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

