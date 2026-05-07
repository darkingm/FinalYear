'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  User, Mail, Wallet, Shield, Phone, MapPin, Camera,
  CreditCard, Save, X, Calendar, Activity, ArrowLeft, CheckCircle2, Link2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface UserProfile {
  user_id: number; email: string; phone: string | null;
  address_line: string | null; username: string | null;
  wallet_address?: string | null; avatar_url?: string | null;
  role: string; status: string; google_id?: string;
  facebook_id?: string; paypal_email?: string | null; created_at: string;
}

function ProfileCompleteness({ profile }: { profile: UserProfile }) {
  const fields = [
    { label: 'Username', done: !!profile.username },
    { label: 'Phone', done: !!profile.phone },
    { label: 'Address', done: !!profile.address_line },
    { label: 'PayPal', done: !!profile.paypal_email },
    { label: 'Wallet', done: !!profile.wallet_address },
    { label: 'Google', done: !!profile.google_id },
  ];
  const pct = Math.round((fields.filter(f => f.done).length / fields.length) * 100);
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-foreground">Hoàn thiện hồ sơ</p>
        <span className="text-sm font-bold text-[#f0b90b]">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2 [&>[data-radix-progress-indicator]]:bg-[#f0b90b]" />
      <div className="grid grid-cols-2 gap-2">
        {fields.map(f => (
          <div key={f.label} className="flex items-center gap-2 text-xs">
            <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${f.done ? 'text-emerald-400' : 'text-muted-foreground/40'}`} />
            <span className={f.done ? 'text-foreground' : 'text-muted-foreground'}>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    username: '', email: '', phone: '', address_line: '', paypal_email: '', avatar_url: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) { router.push('/login'); return; }
    if (isAuthenticated) fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

  const fetchProfile = async () => {
    try {
      const { data } = await apiClient.get('/api/users/profile');
      const u = data.user;
      setProfile(u);
      setFormData({ username: u.username || '', email: u.email || '', phone: u.phone || '', address_line: u.address_line || '', paypal_email: u.paypal_email || '', avatar_url: u.avatar_url || '' });
    } catch { toast.error('Không thể tải hồ sơ'); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.put('/api/users/profile', formData);
      toast.success('Hồ sơ đã được cập nhật!');
      setIsEditing(false);
      fetchProfile();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Cập nhật thất bại'); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('images', file);
      // Don't override Content-Type — axios sets the multipart boundary itself.
      const res = await apiClient.post('/api/products/upload-images', fd, { headers: { 'Content-Type': undefined as unknown as string } });
      if (res.data?.urls?.[0]) {
        await apiClient.put('/api/users/profile', { avatar_url: res.data.urls[0] });
        toast.success('Ảnh đại diện đã cập nhật!');
        fetchProfile();
      }
    } catch { toast.error('Upload thất bại'); }
    finally { setUploading(false); }
  };

  if (isLoading || !profile) return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#f0b90b]/30 border-t-[#f0b90b] rounded-full animate-spin" />
      </div>
    </div>
  );

  const userInitials = profile.username?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    || profile.email.charAt(0).toUpperCase();

  const connections = [
    {
      label: 'Google',
      icon: <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />,
      linked: !!profile.google_id,
      bg: 'bg-white',
      subtitle: profile.google_id ? profile.email : 'Chưa kết nối',
    },
    { label: 'Crypto Wallet', icon: <Wallet className="w-5 h-5 text-[#f0b90b]" />, linked: !!profile.wallet_address, bg: 'bg-[#f0b90b]/10', subtitle: profile.wallet_address ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}` : 'Chưa kết nối' },
    { label: 'PayPal', icon: <CreditCard className="w-5 h-5 text-blue-500" />, linked: !!profile.paypal_email, bg: 'bg-blue-500/10', subtitle: profile.paypal_email || 'Chưa kết nối' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 py-8 px-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6">

          {/* Back */}
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Button>

          {/* Cover + Avatar header */}
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="h-40 w-full bg-gradient-to-r from-[#1a1d26] via-[#2a1f4a] to-[#1a2a3a] relative">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #f0b90b 0%, transparent 50%), radial-gradient(circle at 80% 50%, #8247e5 0%, transparent 50%)' }} />
            </div>
            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-14">
                <div className="flex items-end gap-4">
                  <div className="relative group">
                    <Avatar className="w-28 h-28 border-4 border-card shadow-xl rounded-2xl">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="rounded-2xl text-3xl font-black bg-gradient-to-br from-[#f0b90b] to-[#e6a800] text-black">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute -bottom-1 -right-1 p-2 bg-primary text-primary-foreground rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-110">
                      <Camera className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                    </label>
                  </div>
                  <div className="pb-1">
                    <h1 className="text-2xl font-black text-foreground">{profile.username || 'Chưa đặt tên'}</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Tham gia {new Date(profile.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pb-1">
                  <span className="px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-xl capitalize">{profile.role}</span>
                  <span className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />{profile.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="space-y-5">
              <ProfileCompleteness profile={profile} />

              {/* Connections */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Kết nối tài khoản</h3>
                <div className="space-y-3">
                  {connections.map(c => (
                    <div key={c.label} className={`flex items-center justify-between p-3 rounded-xl border ${c.linked ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-background/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>{c.icon}</div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{c.label}</p>
                          {c.subtitle && <p className="text-xs text-muted-foreground">{c.subtitle}</p>}
                        </div>
                      </div>
                      {c.linked
                        ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Đã kết nối</span>
                        : <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"><Link2 className="w-3 h-3" />Kết nối</button>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Credit Score CTA */}
              <div className="relative rounded-2xl border border-[#f0b90b]/20 bg-gradient-to-br from-[#131722] to-[#1a1d26] p-5 overflow-hidden group hover:border-[#f0b90b]/50 transition-colors">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#f0b90b]/5 rounded-full blur-2xl group-hover:bg-[#f0b90b]/10 transition-colors" />
                <div className="flex items-center gap-2 mb-2 text-[#f0b90b]">
                  <Shield className="w-5 h-5" />
                  <span className="font-bold">Web3 Credit Score</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Xếp hạng uy tín blockchain. Kiểm tra đặc quyền ví của bạn.</p>
                <Button variant="outline" size="sm" onClick={() => router.push('/profile/credit-score')}
                  className="w-full border-[#f0b90b]/40 text-[#f0b90b] hover:bg-[#f0b90b] hover:text-black transition-colors font-bold">
                  Xem điểm SBT
                </Button>
              </div>
            </div>

            {/* Main form */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Thông tin cá nhân</h2>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="border-primary/30 hover:bg-primary/10 hover:text-primary">
                    Chỉnh sửa
                  </Button>
                )}
              </div>

              <div className="p-6">
                {!isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { icon: User,        label: 'Username',     value: profile.username },
                      { icon: Mail,        label: 'Email',        value: profile.email },
                      { icon: Phone,       label: 'Số điện thoại', value: profile.phone },
                      { icon: CreditCard,  label: 'PayPal Email', value: profile.paypal_email },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</p>
                        <p className="text-sm font-semibold text-foreground">{value || '—'}</p>
                      </div>
                    ))}
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Địa chỉ</p>
                      <p className="text-sm font-semibold text-foreground">{profile.address_line || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdate} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="username" className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Username</Label>
                        <Input id="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="Tên hiển thị" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Email</Label>
                        <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled placeholder="email@example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Số điện thoại</Label>
                        <Input id="phone" type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+84 xxx xxx xxx" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paypal" className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />PayPal Email</Label>
                        <Input id="paypal" type="email" value={formData.paypal_email} onChange={e => setFormData({ ...formData, paypal_email: e.target.value })} placeholder="paypal@example.com" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address" className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Địa chỉ</Label>
                        <Input id="address" value={formData.address_line} onChange={e => setFormData({ ...formData, address_line: e.target.value })} placeholder="123 Đường ABC, Quận 1, TP.HCM" />
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                        <X className="w-4 h-4 mr-2" /> Hủy
                      </Button>
                      <Button type="submit" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold shadow-lg shadow-yellow-500/20">
                        <Save className="w-4 h-4 mr-2" /> Lưu thay đổi
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
