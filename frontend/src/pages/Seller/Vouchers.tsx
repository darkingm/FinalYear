import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiTag,
  FiDollarSign,
  FiPercent,
  FiTruck,
} from 'react-icons/fi';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import VoucherForm from '../../components/VoucherForm';

interface Voucher {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUses?: number;
  maxUsesPerUser?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  applicableCategories?: string[];
  applicableProducts?: string[];
  createdAt: string;
}

const SellerVouchers = () => {
  const { t } = useTranslation();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/vouchers');
      if (response.data.success) {
        setVouchers(response.data.data.vouchers || []);
      }
    } catch (error: any) {
      console.error('Error fetching vouchers:', error);
      toast.error('Failed to fetch vouchers');
    } finally {
      setLoading(false);
    }
  };

  const fetchVoucherStats = async (voucherId: string) => {
    try {
      const response = await axios.get(`/api/v1/vouchers/${voucherId}/stats`);
      if (response.data.success) {
        setStats((prev) => ({
          ...prev,
          [voucherId]: response.data.data.stats,
        }));
      }
    } catch (error) {
      console.error('Error fetching voucher stats:', error);
    }
  };

  const handleDelete = async (voucherId: string) => {
    if (!confirm('Are you sure you want to delete this voucher?')) return;

    try {
      await axios.delete(`/api/v1/vouchers/${voucherId}`);
      toast.success('Voucher deleted successfully');
      fetchVouchers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete voucher');
    }
  };

  const handleToggleStatus = async (voucher: Voucher) => {
    try {
      const newStatus = voucher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await axios.put(`/api/v1/vouchers/${voucher.id}`, {
        status: newStatus,
      });
      toast.success(`Voucher ${newStatus.toLowerCase()}`);
      fetchVouchers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update voucher');
    }
  };

  const handleEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingVoucher(null);
    fetchVouchers();
  };

  const getVoucherIcon = (type: string) => {
    switch (type) {
      case 'PERCENTAGE':
        return <FiPercent className="w-5 h-5" />;
      case 'FIXED_AMOUNT':
        return <FiDollarSign className="w-5 h-5" />;
      case 'FREE_SHIPPING':
        return <FiTruck className="w-5 h-5" />;
      default:
        return <FiTag className="w-5 h-5" />;
    }
  };

  const getVoucherTypeLabel = (type: string) => {
    switch (type) {
      case 'PERCENTAGE':
        return 'Percentage';
      case 'FIXED_AMOUNT':
        return 'Fixed Amount';
      case 'FREE_SHIPPING':
        return 'Free Shipping';
      default:
        return type;
    }
  };

  const formatDiscount = (voucher: Voucher) => {
    switch (voucher.type) {
      case 'PERCENTAGE':
        return `${voucher.discountValue}%${voucher.maxDiscountAmount ? ` (max $${voucher.maxDiscountAmount})` : ''}`;
      case 'FIXED_AMOUNT':
        return `$${voucher.discountValue}`;
      case 'FREE_SHIPPING':
        return 'Free Shipping';
      default:
        return '';
    }
  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Voucher Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Create and manage discount vouchers for your products
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            <span>Create Voucher</span>
          </motion.button>
        </div>

        {/* Vouchers Grid */}
        {vouchers.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <FiTag className="w-24 h-24 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              No vouchers yet
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              Create Your First Voucher
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vouchers.map((voucher) => {
              const expired = isExpired(voucher.endDate);
              const statsData = stats[voucher.id];

              return (
                <motion.div
                  key={voucher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  {/* Voucher Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        voucher.type === 'PERCENTAGE' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        voucher.type === 'FIXED_AMOUNT' ? 'bg-green-100 dark:bg-green-900/30' :
                        'bg-purple-100 dark:bg-purple-900/30'
                      }`}>
                        {getVoucherIcon(voucher.type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {voucher.code}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {voucher.title}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      voucher.status === 'ACTIVE' && !expired
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {expired ? 'Expired' : voucher.status}
                    </span>
                  </div>

                  {/* Voucher Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                      <span className="font-semibold text-primary-600">
                        {formatDiscount(voucher)}
                      </span>
                    </div>
                    {voucher.minPurchaseAmount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Min Purchase:</span>
                        <span className="font-semibold">${voucher.minPurchaseAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Used:</span>
                      <span className="font-semibold">
                        {voucher.usedCount} / {voucher.maxUses || '∞'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Valid Until:</span>
                      <span className="font-semibold">
                        {new Date(voucher.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  {statsData && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Statistics</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Total Uses:</span>
                          <span className="font-semibold ml-2">{statsData.totalUses}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Users:</span>
                          <span className="font-semibold ml-2">{statsData.uniqueUsers}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">Total Discount:</span>
                          <span className="font-semibold ml-2">${statsData.totalDiscount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        if (!stats[voucher.id]) {
                          fetchVoucherStats(voucher.id);
                        }
                      }}
                      className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      View Stats
                    </button>
                    <button
                      onClick={() => handleEdit(voucher)}
                      className="px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(voucher)}
                      className={`px-3 py-2 text-sm rounded-lg ${
                        voucher.status === 'ACTIVE'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                      }`}
                    >
                      {voucher.status === 'ACTIVE' ? (
                        <FiXCircle className="w-4 h-4" />
                      ) : (
                        <FiCheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(voucher.id)}
                      className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Voucher Form Modal */}
        <AnimatePresence>
          {showForm && (
            <VoucherForm
              voucher={editingVoucher}
              onClose={handleFormClose}
              onSuccess={handleFormClose}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SellerVouchers;


