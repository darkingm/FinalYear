'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import {
  Fingerprint, Search, CheckCircle, XCircle, Clock, RefreshCw,
  Shield, AlertCircle, Loader2, User,
} from 'lucide-react';

interface KYCRecord {
  wallet_address: string;
  user_id: number | null;
  verified: boolean;
  jurisdiction: string;
  granted_at: string | null;
  username?: string;
  email?: string;
}

interface SellerProfile {
  seller_id: number;
  user_id: number;
  display_name: string;
  kyc_status: string;
  payout_wallet: string | null;
  username: string;
  email: string;
}

export default function AdminKYCPage() {
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [grantWallet, setGrantWallet] = useState('');
  const [grantUserId, setGrantUserId] = useState('');
  const [granting, setGranting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch sellers with KYC status from admin API
      const sellersRes = await apiClient.get('/api/admin/users?limit=200');
      if (sellersRes.data?.success) {
        // Get users that have seller profiles
        const usersData = sellersRes.data.data?.users || sellersRes.data.users || [];
        setSellers(usersData.filter((u: any) => u.role === 'seller' || u.kyc_status));
      }

      // Fetch on-chain KYC records from tokenization service
      try {
        const kycRes = await apiClient.get('/api/rwa/kyc/list');
        if (kycRes.data?.records) {
          setKycRecords(kycRes.data.records);
        }
      } catch {
        // tokenization service might not have list endpoint
      }
    } catch (err) {
      console.error('Failed to load KYC data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGrant = async () => {
    if (!grantWallet.startsWith('0x') || grantWallet.length !== 42) {
      toast.error('Địa chỉ ví không hợp lệ (0x... 42 ký tự)');
      return;
    }
    setGranting(true);
    try {
      await apiClient.post('/api/rwa/kyc/grant', {
        wallet_address: grantWallet,
        user_id: grantUserId ? parseInt(grantUserId) : null,
        jurisdiction: 'VN',
      });
      toast.success(`✅ Đã cấp KYC cho ${grantWallet.slice(0, 10)}...`);
      setGrantWallet('');
      setGrantUserId('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Cấp KYC thất bại');
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (wallet: string) => {
    if (!confirm(`Thu hồi KYC cho ví ${wallet.slice(0, 10)}...?`)) return;
    setActionLoading(wallet);
    try {
      await apiClient.post('/api/rwa/kyc/revoke', { wallet_address: wallet });
      toast.success('Đã thu hồi KYC');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Thu hồi KYC thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateSellerKYC = async (userId: number, status: string) => {
    setActionLoading(`seller-${userId}`);
    try {
      await apiClient.patch(`/api/admin/users/${userId}`, { kyc_status: status });
      toast.success(`KYC status → ${status}`);
      fetchData();
    } catch (err: any) {
      toast.error('Cập nhật thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const shortAddr = (a: string) => `${a.slice(0, 8)}...${a.slice(-6)}`;
  const filteredSellers = sellers.filter(s =>
    !search || s.display_name?.toLowerCase().includes(search.toLowerCase())
    || s.email?.toLowerCase().includes(search.toLowerCase())
    || s.payout_wallet?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#f0b90b]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#f0b90b]/15 border border-[#f0b90b]/30 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-[#f0b90b]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Quản Lý KYC</h1>
          <p className="text-xs text-gray-500">Xác minh danh tính người dùng cho RWA & Marketplace</p>
        </div>
      </div>

      {/* Grant KYC Card */}
      <div className="bg-[#1a1d26] border border-white/10 rounded-2xl p-6">
        <h2 className="font-bold text-sm text-white flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-emerald-400" /> Cấp KYC cho ví mới
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-500 block mb-1">User ID (tuỳ chọn)</label>
            <input
              value={grantUserId}
              onChange={e => setGrantUserId(e.target.value)}
              placeholder="VD: 5"
              className="w-full bg-[#0c0e14] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#f0b90b]/50"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs text-gray-500 block mb-1">Wallet Address *</label>
            <input
              value={grantWallet}
              onChange={e => setGrantWallet(e.target.value)}
              placeholder="0x..."
              className="w-full bg-[#0c0e14] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-[#f0b90b]/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGrant}
              disabled={granting || !grantWallet}
              className="w-full py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {granting ? 'Đang xử lý...' : 'Cấp KYC'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/15 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400/80">
            Cấp KYC sẽ ghi trạng thái lên blockchain (on-chain) và cho phép người dùng tham gia mua bán RWA.
          </p>
        </div>
      </div>

      {/* Seller KYC Status Table */}
      <div className="bg-[#1a1d26] border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/8 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <User className="w-4 h-4 text-[#f0b90b]" /> Danh sách Seller ({filteredSellers.length})
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                className="bg-[#0c0e14] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#f0b90b]/50 w-48"
              />
            </div>
            <button onClick={fetchData} className="p-2 text-gray-500 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filteredSellers.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có seller nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">KYC Status</th>
                  <th className="text-left px-5 py-3 font-medium">Payout Wallet</th>
                  <th className="text-right px-5 py-3 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSellers.map((s: any) => {
                  const kycStatus = s.kyc_status || 'pending';
                  const statusColor = kycStatus === 'verified' ? 'text-emerald-400 bg-emerald-400/10'
                    : kycStatus === 'rejected' ? 'text-red-400 bg-red-400/10'
                    : 'text-amber-400 bg-amber-400/10';
                  const StatusIcon = kycStatus === 'verified' ? CheckCircle : kycStatus === 'rejected' ? XCircle : Clock;

                  return (
                    <tr key={s.user_id} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center text-[#f0b90b] text-xs font-bold">
                            {(s.display_name || s.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{s.display_name || s.username}</p>
                            <p className="text-[10px] text-gray-600">ID: {s.user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">{s.email}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${statusColor}`}>
                          <StatusIcon className="w-3 h-3" />
                          {kycStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {s.payout_wallet ? (
                          <span className="font-mono text-xs text-gray-400">{shortAddr(s.payout_wallet)}</span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {kycStatus !== 'verified' && (
                            <button
                              onClick={() => handleUpdateSellerKYC(s.user_id, 'verified')}
                              disabled={actionLoading === `seller-${s.user_id}`}
                              className="px-2.5 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg text-[10px] font-bold hover:bg-emerald-500/25 disabled:opacity-40 transition-all"
                            >
                              ✓ Approve
                            </button>
                          )}
                          {kycStatus !== 'rejected' && kycStatus !== 'pending' && (
                            <button
                              onClick={() => handleUpdateSellerKYC(s.user_id, 'rejected')}
                              disabled={actionLoading === `seller-${s.user_id}`}
                              className="px-2.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-[10px] font-bold hover:bg-red-500/25 disabled:opacity-40 transition-all"
                            >
                              ✗ Reject
                            </button>
                          )}
                          {actionLoading === `seller-${s.user_id}` && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* On-chain KYC Records */}
      {kycRecords.length > 0 && (
        <div className="bg-[#1a1d26] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/8">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-violet-400" /> KYC On-Chain ({kycRecords.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left px-5 py-3 font-medium">Wallet</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Jurisdiction</th>
                  <th className="text-left px-5 py-3 font-medium">Granted</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {kycRecords.map(r => (
                  <tr key={r.wallet_address} className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-white">{shortAddr(r.wallet_address)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${r.verified ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                        {r.verified ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {r.verified ? 'VERIFIED' : 'REVOKED'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{r.jurisdiction}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {r.granted_at ? new Date(r.granted_at).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.verified ? (
                        <button
                          onClick={() => handleRevoke(r.wallet_address)}
                          disabled={actionLoading === r.wallet_address}
                          className="px-2.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-[10px] font-bold hover:bg-red-500/25 disabled:opacity-40"
                        >
                          {actionLoading === r.wallet_address ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Revoke'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">Revoked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
