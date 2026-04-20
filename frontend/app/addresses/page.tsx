'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin, Plus, Edit, Trash2, ArrowLeft, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addressService } from '@/services';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';
import type { Address } from '@/types';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';

export default function AddressesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, reauthRequired } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Address>>({
    label: 'Home',
    country: 'Vietnam',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(buildLoginRedirectUrl('/addresses', reauthRequired ? 'reauth_required' : undefined));
    }
  }, [isAuthenticated, authLoading, router, reauthRequired]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses();
    }
  }, [isAuthenticated]);

  const fetchAddresses = async () => {
    try {
      const data = await addressService.list();
      setAddresses(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await addressService.update(editingId, formData);
        toast.success('Address updated');
      } else {
        await addressService.create(formData as any);
        toast.success('Address added');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ label: 'Home', country: 'Vietnam' });
      fetchAddresses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save address');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this address?')) return;
    try {
      await addressService.remove(id);
      toast.success('Address deleted');
      fetchAddresses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const openEditModal = (address: Address) => {
    setEditingId(address.address_id);
    setFormData(address);
    setShowModal(true);
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <MapPin className="w-8 h-8 text-primary" />
                My Addresses
              </h1>
              <p className="text-muted-foreground mt-1">Manage shipping addresses</p>
            </div>
          </div>
          <Button onClick={() => { setEditingId(null); setFormData({ label: 'Home', country: 'Vietnam' }); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Address
          </Button>
        </div>

        {addresses.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No addresses saved</h2>
            <p className="text-muted-foreground mb-6">Add your first shipping address</p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Address
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((addr, idx) => (
              <motion.div
                key={addr.address_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-card rounded-xl border p-6 hover:shadow-md transition-shadow ${
                  addr.is_default ? 'border-primary' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{addr.label}</h3>
                      {addr.is_default && (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="font-medium">{addr.full_name}</p>
                    <p className="text-sm text-muted-foreground">{addr.phone}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {addr.address_line}
                      {addr.ward && `, ${addr.ward}`}
                      {addr.district && `, ${addr.district}`}
                      {addr.province && `, ${addr.province}`}
                      {addr.postal_code && ` ${addr.postal_code}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{addr.country}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(addr)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(addr.address_id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl border border-border p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold mb-4">{editingId ? 'Edit Address' : 'Add Address'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Label</label>
                <Input value={formData.label || ''} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="Home, Office, etc." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Full Name *</label>
                <Input value={formData.full_name || ''} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone *</label>
                <Input value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address Line *</label>
                <Input value={formData.address_line || ''} onChange={(e) => setFormData({ ...formData, address_line: e.target.value })} placeholder="123 Street Name" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">District</label>
                  <Input value={formData.district || ''} onChange={(e) => setFormData({ ...formData, district: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Province</label>
                  <Input value={formData.province || ''} onChange={(e) => setFormData({ ...formData, province: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Postal Code</label>
                  <Input value={formData.postal_code || ''} onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Country</label>
                  <Input value={formData.country || 'Vietnam'} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default || false}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4 rounded border-input"
                />
                <label htmlFor="is_default" className="text-sm font-medium cursor-pointer">
                  Set as default address
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">{editingId ? 'Update' : 'Add'} Address</Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}
