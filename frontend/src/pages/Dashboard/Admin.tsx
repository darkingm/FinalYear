import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import axios from '../../api/axios';
import {
  UsersIcon,
  ShoppingBagIcon,
  BanknotesIcon,
  ChartBarIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

interface Stats {
  totalUsers: number;
  totalSellers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  pendingSellerApplications: number;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface SellerApplication {
  id: string;
  userId: string;
  shopName: string;
  status: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalSellers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    pendingSellerApplications: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sellers'>('overview');

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const statsRes = await axios.get('/api/v1/admin/stats');
      setStats(statsRes.data.data);

      // Fetch data based on active tab
      if (activeTab === 'users') {
        const usersRes = await axios.get('/api/v1/admin/users?limit=20');
        setUsers(usersRes.data.data.users);
      } else if (activeTab === 'sellers') {
        const appsRes = await axios.get('/api/v1/admin/sellers/applications?status=pending');
        setApplications(appsRes.data.data.applications);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (!confirm(t('admin.confirmSuspend'))) return;
    
    try {
      await axios.put(`/api/v1/admin/users/${userId}/suspend`);
      alert(t('admin.userSuspended'));
      fetchDashboardData();
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  };

  const handleApproveApplication = async (appId: string) => {
    try {
      await axios.put(`/api/v1/admin/sellers/applications/${appId}/approve`);
      alert(t('admin.applicationApproved'));
      fetchDashboardData();
    } catch (error) {
      console.error('Error approving application:', error);
    }
  };

  const handleRejectApplication = async (appId: string) => {
    const reason = prompt(t('admin.rejectReason'));
    if (!reason) return;

    try {
      await axios.put(`/api/v1/admin/sellers/applications/${appId}/reject`, { reason });
      alert(t('admin.applicationRejected'));
      fetchDashboardData();
    } catch (error) {
      console.error('Error rejecting application:', error);
    }
  };

  if (loading && activeTab === 'overview') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('admin.dashboard')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('admin.welcomeMessage')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-4 font-medium transition ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t('admin.overview')}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-4 font-medium transition ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t('admin.users')}
          </button>
          <button
            onClick={() => setActiveTab('sellers')}
            className={`pb-4 px-4 font-medium transition ${
              activeTab === 'sellers'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t('admin.sellerApplications')}
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              icon={UsersIcon}
              title={t('admin.totalUsers')}
              value={stats.totalUsers}
              color="blue"
            />
            <StatCard
              icon={BuildingStorefrontIcon}
              title={t('admin.totalSellers')}
              value={stats.totalSellers}
              color="purple"
            />
            <StatCard
              icon={ShoppingBagIcon}
              title={t('admin.totalOrders')}
              value={stats.totalOrders}
              color="green"
            />
            <StatCard
              icon={BanknotesIcon}
              title={t('admin.totalRevenue')}
              value={`$${stats.totalRevenue.toLocaleString()}`}
              color="yellow"
            />
            <StatCard
              icon={ChartBarIcon}
              title={t('admin.pendingOrders')}
              value={stats.pendingOrders}
              color="red"
            />
            <StatCard
              icon={UserGroupIcon}
              title={t('admin.pendingApplications')}
              value={stats.pendingSellerApplications}
              color="indigo"
            />
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin.username')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin.email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin.role')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin.joined')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {user.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleSuspendUser(user.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            {t('admin.suspend')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Seller Applications Tab */}
        {activeTab === 'sellers' && (
          <div className="space-y-4">
            {applications.map((app) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {app.shopName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Applied: {new Date(app.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleApproveApplication(app.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      {t('admin.approve')}
                    </button>
                    <button
                      onClick={() => handleRejectApplication(app.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      {t('admin.reject')}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {applications.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {t('admin.noApplications')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, color }: any) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-lg p-6 text-white`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="w-12 h-12 opacity-80" />
      </div>
    </motion.div>
  );
}

