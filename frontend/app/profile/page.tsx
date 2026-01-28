'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, Mail, Wallet, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  user_id: number;
  email: string;
  username: string;
  wallet_address?: string;
  avatar_url?: string;
  role: string;
  status: string;
  google_id?: string;
  facebook_id?: string;
  paypal_email?: string;
  created_at: string;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    paypal_email: '',
  });

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
      setProfile(response.data.user);
      setFormData({
        username: response.data.user.username || '',
        paypal_email: response.data.user.paypal_email || '',
      });
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.put('/api/users/profile', formData);
      toast.success('Profile updated successfully');
      setIsEditing(false);
      fetchProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">User Profile</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Avatar Section */}
          <div className="flex items-center gap-6 mb-8 pb-8 border-b">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
              {profile.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{profile.username || 'User'}</h2>
              <p className="text-gray-500">{profile.email}</p>
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                {profile.role}
              </span>
            </div>
          </div>

          {/* Profile Info */}
          {!isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 mt-1 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium">{profile.username || 'Not set'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 mt-1 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Wallet className="w-5 h-5 mt-1 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Wallet Address</p>
                    <p className="font-mono text-sm">
                      {profile.wallet_address ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}` : 'Not connected'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 mt-1 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">PayPal Email</p>
                    <p className="font-medium">{profile.paypal_email || 'Not set'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 mt-1 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Account Status</p>
                    <p className="font-medium capitalize">{profile.status}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 mt-1 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="font-medium">{new Date(profile.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="font-semibold mb-3">Connected Accounts</h3>
                <div className="space-y-2">
                  {profile.google_id && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span> Google Account Connected
                    </div>
                  )}
                  {profile.facebook_id && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span> Facebook Account Connected
                    </div>
                  )}
                  {profile.wallet_address && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span> Crypto Wallet Connected
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">PayPal Email</label>
                <Input
                  type="email"
                  value={formData.paypal_email}
                  onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
                  placeholder="Enter PayPal email"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit">Save Changes</Button>
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
