import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import axios from '../../api/axios';
import {
  BuildingStorefrontIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function SellerApply() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shopName: '',
    shopDescription: '',
    businessType: '',
    businessAddress: '',
    phoneNumber: '',
    website: '',
    taxId: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.shopName.trim()) newErrors.shopName = t('seller.shopNameRequired');
      if (!formData.shopDescription.trim()) newErrors.shopDescription = t('seller.descRequired');
      if (!formData.businessType.trim()) newErrors.businessType = t('seller.businessTypeRequired');
    }

    if (step === 2) {
      if (!formData.businessAddress.trim()) newErrors.businessAddress = t('seller.addressRequired');
      if (!formData.phoneNumber.trim()) newErrors.phoneNumber = t('seller.phoneRequired');
    }

    if (step === 3) {
      if (!formData.bankName.trim()) newErrors.bankName = t('seller.bankNameRequired');
      if (!formData.bankAccountNumber.trim()) newErrors.bankAccountNumber = t('seller.accountNumberRequired');
      if (!formData.bankAccountName.trim()) newErrors.bankAccountName = t('seller.accountNameRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      setStep(step + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await axios.post('/api/v1/sellers/apply', formData);
      setStep(4); // Success step
    } catch (error: any) {
      alert(error.response?.data?.error || t('seller.submitError'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 4) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center"
        >
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('seller.applicationSubmitted')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('seller.reviewMessage')}
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {t('seller.backToProfile')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full mx-1 ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={step >= 1 ? 'text-blue-600' : 'text-gray-400'}>
              {t('seller.step1')}
            </span>
            <span className={step >= 2 ? 'text-blue-600' : 'text-gray-400'}>
              {t('seller.step2')}
            </span>
            <span className={step >= 3 ? 'text-blue-600' : 'text-gray-400'}>
              {t('seller.step3')}
            </span>
          </div>
        </div>

        {/* Form */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8"
        >
          {step === 1 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <BuildingStorefrontIcon className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('seller.businessInfo')}
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.shopName')} *
                  </label>
                  <input
                    type="text"
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.shopName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder={t('seller.shopNamePlaceholder')}
                  />
                  {errors.shopName && <p className="text-red-500 text-sm mt-1">{errors.shopName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.shopDescription')} *
                  </label>
                  <textarea
                    value={formData.shopDescription}
                    onChange={(e) => setFormData({ ...formData, shopDescription: e.target.value })}
                    rows={4}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.shopDescription ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder={t('seller.descPlaceholder')}
                  />
                  {errors.shopDescription && <p className="text-red-500 text-sm mt-1">{errors.shopDescription}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.businessType')} *
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.businessType ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">{t('seller.selectBusinessType')}</option>
                    <option value="individual">{t('seller.individual')}</option>
                    <option value="company">{t('seller.company')}</option>
                  </select>
                  {errors.businessType && <p className="text-red-500 text-sm mt-1">{errors.businessType}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.taxId')} ({t('common.optional')})
                  </label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <DocumentTextIcon className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('seller.contactInfo')}
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.businessAddress')} *
                  </label>
                  <textarea
                    value={formData.businessAddress}
                    onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                    rows={3}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.businessAddress ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.businessAddress && <p className="text-red-500 text-sm mt-1">{errors.businessAddress}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.phoneNumber')} *
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.phoneNumber ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.website')} ({t('common.optional')})
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="https://"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <BanknotesIcon className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('seller.bankInfo')}
                </h2>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('seller.bankInfoNote')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.bankName')} *
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.bankName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.bankName && <p className="text-red-500 text-sm mt-1">{errors.bankName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.bankAccountNumber')} *
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.bankAccountNumber ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.bankAccountNumber && <p className="text-red-500 text-sm mt-1">{errors.bankAccountNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('seller.bankAccountName')} *
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountName}
                    onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                      errors.bankAccountName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.bankAccountName && <p className="text-red-500 text-sm mt-1">{errors.bankAccountName}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
            >
              {step > 1 ? t('common.back') : t('common.cancel')}
            </button>
            <button
              onClick={step === 3 ? handleSubmit : handleNext}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? t('common.loading') : step === 3 ? t('seller.submit') : t('common.next')}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

