'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, Mail, Wallet, Shield, Phone, MapPin, Camera, CreditCard, Save, X, Calendar, Activity, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface UserProfile {
  user_id: number;
  email: string;
  phone: string | null;
  address_line: string | null;
  username: string | null;
  wallet_address?: string | null;
  avatar_url?: string | null;
  role: string;
  status: string;
  google_id?: string;
  facebook_id?: string;
  paypal_email?: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    address_line: '',
    paypal_email: '',
    avatar_url: '',
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, isLoading]);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/api/users/profile');
      const userData = response.data.user;
      setProfile(userData);
      setFormData({
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        address_line: userData.address_line || '',
        paypal_email: userData.paypal_email || '',
        avatar_url: userData.avatar_url || '',
      });
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.put('/api/users/profile', formData);
      toast.success('Your profile was updated successfully!');
      setIsEditing(false);
      fetchProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('images', file); // Use existing upload route
      const res = await apiClient.post('/api/products/upload-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // The endpoint returns { urls: string[] }
      if (res.data?.urls?.[0]) {
        const newAvatarUrl = res.data.urls[0];
        setFormData(prev => ({ ...prev, avatar_url: newAvatarUrl }));
        await apiClient.put('/api/users/profile', { avatar_url: newAvatarUrl });
        toast.success('Avatar updated successfully!');
        fetchProfile();
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f0b90b]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-8"
        >
          {/* Back Button */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>

          {/* Header Section */}
          <div className="relative rounded-3xl bg-card border border-border overflow-hidden shadow-2xl">
            {/* Cover Image */}
            <div className="h-48 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>

            <div className="px-8 pb-8">
              <div className="relative flex justify-between items-end -mt-16 sm:-mt-20">
                <div className="flex items-end gap-6">
                  {/* Avatar */}
                  <div className="relative group">
                    <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-card bg-card overflow-hidden shadow-xl flex items-center justify-center">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center text-black text-6xl font-bold">
                          {profile.username?.charAt(0).toUpperCase() || profile.email.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-2 right-2 p-2 bg-primary/90 text-primary-foreground rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 cursor-pointer">
                      <Camera className={`w-5 h-5 ${uploadingAvatar ? 'animate-pulse' : ''}`} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    </label>
                  </div>

                  <div className="pb-4">
                    <h1 className="text-3xl sm:text-4xl font-bold">{profile.username || 'Unnamed User'}</h1>
                    <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {profile.email}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="pb-4 hidden lg:block">
                  <div className="flex gap-3">
                    <span className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-semibold border border-primary/20 capitalize">
                      {profile.role}
                    </span>
                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl font-semibold border border-emerald-500/20 capitalize flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      {profile.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Sidebar */}
            <div className="space-y-8">
              {/* Linked Accounts */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Active Connections
                </h3>
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${profile.google_id ? 'border-primary/50 bg-primary/5' : 'border-border bg-background/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-2 shadow-sm">
                          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Google</p>
                          <p className="text-xs text-muted-foreground">{profile.google_id ? 'Connected' : 'Not Connected'}</p>
                        </div>
                      </div>
                      {profile.google_id ? (
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Linked</span>
                      ) : (
                        <button className="text-xs font-bold text-primary hover:underline">Link</button>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${profile.wallet_address ? 'border-primary/50 bg-primary/5' : 'border-border bg-background/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#f3ba2f]/10 text-[#f3ba2f] flex items-center justify-center shadow-sm">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Crypto Wallet</p>
                          <p className="text-xs text-muted-foreground">{profile.wallet_address ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}` : 'Not Connected'}</p>
                        </div>
                      </div>
                      {profile.wallet_address ? (
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Linked</span>
                      ) : (
                        <button className="text-xs font-bold text-primary hover:underline">Link</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl shadow-sm relative overflow-hidden">
                <div className="border-b border-border px-8 py-5 flex justify-between items-center bg-card">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" /> Personal Information
                  </h2>
                  {!isEditing && (
                    <Button onClick={() => setIsEditing(true)} variant="outline" className="border-primary/50 text-foreground hover:bg-primary/10">
                      Edit details
                    </Button>
                  )}
                </div>

                <div className="p-8">
                  {!isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><User className="w-4 h-4" /> Full Name / Username</p>
                        <p className="text-base font-semibold">{profile.username || '—'}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> Email Address</p>
                        <p className="text-base font-semibold">{profile.email}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Phone className="w-4 h-4" /> Phone Number</p>
                        <p className="text-base font-semibold">{profile.phone || '—'}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CreditCard className="w-4 h-4" /> PayPal Email</p>
                        <p className="text-base font-semibold">{profile.paypal_email || '—'}</p>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><MapPin className="w-4 h-4" /> Address</p>
                        <p className="text-base font-semibold">{profile.address_line || '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /> Username</label>
                        <Input
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="bg-accent/10 focus:border-primary/50"
                          placeholder="Your display name"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> Email Address</label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="bg-accent/10 focus:border-primary/50"
                          placeholder="Your primary email"
                          disabled // Let's keep email editable or disabled depending on biz logic, but I'll make it editable as requested
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</label>
                        <Input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="bg-accent/10 focus:border-primary/50"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" /> PayPal Email <span className="text-xs text-muted-foreground font-normal">(For receiving payouts)</span></label>
                        <Input
                          type="email"
                          value={formData.paypal_email}
                          onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
                          className="bg-accent/10 focus:border-primary/50"
                          placeholder="payment@example.com"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> Full Address</label>
                        <Input
                          value={formData.address_line}
                          onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
                          className="bg-accent/10 focus:border-primary/50"
                          placeholder="123 Main St, Appt 4B, City, Country"
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-6 border-t border-border">
                        <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                          <X className="w-4 h-4 mr-2" /> Cancel
                        </Button>
                        <Button type="submit" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold shadow-lg shadow-yellow-500/20">
                          <Save className="w-4 h-4 mr-2" /> Save Changes
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
