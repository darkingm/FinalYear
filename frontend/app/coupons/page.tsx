'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Tag, Plus, Edit, Trash2, ArrowLeft, Calendar, TrendingUp, Percent, DollarSign } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { couponService, type CreateCouponPayload } from '@/services/coupon.service';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';
import type { Coupon } from '@/types';

export default function CouponsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateCouponPayload>>({
    discount_type: 'percentage',
    per_user_limit: 1,
  });

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?callbackUrl=/coupons');
      } else if (user?.role !== 'seller' && user?.role !== 'admin') {
        toast.error('Only sellers can manage coupons');
        router.push('/');
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  useEffect(() => {
    if (isAuthenticated && (user?.role === 'seller' || user?.role === 'admin')) {
      fetchCoupons();
    }
  }, [isAuthenticated, user]);

  const fetchCoupons = async () => {
    try {
      const { coupons: data } = await couponService.list();
      setCoupons(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.discount_value || !formData.starts_at || !formData.expires_at) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await couponService.create(formData as CreateCouponPayload);
      toast.success('Coupon created successfully');
      setShowCreateModal(false);
      setFormData({ discount_type: 'percentage', per_user_limit: 1 });
      fetchCoupons();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create coupon');
    }
  };

  const handleDelete = async (couponId: number) => {
    if (!confirm('Are you sure you want to deactivate this coupon?')) return;
    try {
      await couponService.delete(couponId);
      toast.success('Coupon deactivated');
      fetchCoupons();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete coupon');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Tag className="w-8 h-8 text-primary" />
                Coupons & Promotions
              </h1>
              <p className="text-muted-foreground mt-1">{coupons.length} active coupons</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Coupon
          </Button>
        </div>

        {/* Coupons Grid */}
        {coupons.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-card rounded-xl border border-border"
          >
            <Tag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No coupons yet</h2>
            <p className="text-muted-foreground mb-6">Create your first coupon to boost sales</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Coupon
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((coupon, idx) => (
              <motion.div
                key={coupon.coupon_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1 font-mono">{coupon.code}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {coupon.description || 'No description'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(coupon.coupon_id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Discount */}
                <div className="flex items-center gap-2 mb-4 p-3 bg-primary/10 rounded-lg">
                  {coupon.discount_type === 'percentage' ? (
                    <Percent className="w-5 h-5 text-primary" />
                  ) : (
                    <DollarSign className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-2xl font-bold text-primary">
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}% OFF`
                      : `$${coupon.discount_value} OFF`}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  {coupon.min_order_usd > 0 && (
                    <p className="text-muted-foreground">
                      Min order: ${coupon.min_order_usd}
                    </p>
                  )}
                  {coupon.max_discount_usd && (
                    <p className="text-muted-foreground">
                      Max discount: ${coupon.max_discount_usd}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Expires: {new Date(coupon.expires_at).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl border border-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold mb-4">Create Coupon</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Coupon Code *</label>
                <Input
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2026"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Input
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summer sale discount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Discount Type *</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  value={formData.discount_type}
                  onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed Amount</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.discount_value || ''}
                  onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Min Order ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.min_order_usd || ''}
                    onChange={(e) => setFormData({ ...formData, min_order_usd: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Usage Limit</label>
                  <Input
                    type="number"
                    value={formData.usage_limit || ''}
                    onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date *</label>
                  <Input
                    type="datetime-local"
                    value={formData.starts_at || ''}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date *</label>
                  <Input
                    type="datetime-local"
                    value={formData.expires_at || ''}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">Create Coupon</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}
