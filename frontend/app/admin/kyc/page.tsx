'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import {
  Fingerprint, Search, CheckCircle, XCircle, Clock, RefreshCw,
  Shield, AlertCircle, Loader2, User, FileText, Eye, X,
  Image as ImageIcon, Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Types ───────────────────────────────────────────────────────────────── */
interface KYCSubmission {
  submission_id: number;
  user_id: number;
  wallet_address: string | null;
  full_name: string;
  date_of_birth: string;
  document_type: string;
  document_number: string;
  document_front: string | null;
  document_back: string | null;
  selfie_url: string | null;
  jurisdiction: string;
  status: 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
  rejection_reason: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  username?: string;
  email?: string;
  role?: string;
}

interface KYCRecord {
  wallet_address: string;
  user_id: number | null;
  verified: boolean;
  jurisdiction: string;
  granted_at: string | null;
}

/* ── Status badge ────────────────────────────────────────────────────────── */
const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  REVIEWING: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  APPROVED: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  REJECTED: 'bg-red-400/10 text-red-400 border-red-400/20',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusStyles[status] || ''}`}>
      {status === 'PENDING' && <Clock className="w-3 h-3" />}
      {status === 'REVIEWING' && <Eye className="w-3 h-3" />}
      {status === 'APPROVED' && <CheckCircle className="w-3 h-3" />}
      {status === 'REJECTED' && <XCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

/* ── Review Modal ────────────────────────────────────────────────────────── */
function ReviewModal({
  submission,
  onClose,
  onReview,
  reviewing,
}: {
  submission: KYCSubmission;
  onClose: () => void;
  onReview: (action: 'APPROVED' | 'REJECTED', reason?: string) => void;
  reviewing: boolean;
}) {
  const [rejectionReason, setRejectionReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[#1a1d26] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#f0b90b]" />
            Xét duyệt KYC #{submission.submission_id}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* User info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Username</p>
              <p className="text-sm font-semibold text-white">{submission.username || `User #${submission.user_id}`}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Email</p>
              <p className="text-sm font-semibold text-white">{submission.email || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Status</p>
              <StatusBadge status={submission.status} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Ngày gửi</p>
              <p className="text-sm font-semibold text-white">
                {new Date(submission.created_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>

          {/* Document info */}
          <div className="bg-[#0c0e14] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Thông tin cá nhân
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Họ và tên</p>
                <p className="text-sm font-bold text-white">{submission.full_name}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Ngày sinh</p>
                <p className="text-sm font-semibold text-white">
                  {new Date(submission.date_of_birth).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Loại giấy tờ</p>
                <p className="text-sm font-semibold text-white">{submission.document_type}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Số giấy tờ</p>
                <p className="text-sm font-mono font-bold text-white">{submission.document_number}</p>
              </div>
            </div>
            {submission.wallet_address && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Wallet</p>
                <p className="text-xs font-mono text-[#f0b90b]">{submission.wallet_address}</p>
              </div>
            )}
          </div>

          {/* Document images */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Ảnh giấy tờ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Mặt trước', url: submission.document_front },
                { label: 'Mặt sau', url: submission.document_back },
                { label: 'Ảnh selfie', url: submission.selfie_url },
              ].map(({ label, url }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase">{label}</p>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-white/10 hover:border-[#f0b90b]/40 transition-colors"
                    >
                      <img
                        src={url}
                        alt={label}
                        className="w-full h-40 object-cover"
                      />
                    </a>
                  ) : (
                    <div className="h-40 bg-[#0c0e14] rounded-xl border border-white/5 flex items-center justify-center text-gray-600 text-xs">
                      Không có ảnh
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rejection reason (if rejecting) */}
          {submission.status !== 'APPROVED' && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase">Lý do từ chối (nếu từ chối)</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="VD: Ảnh giấy tờ không rõ ràng, cần chụp lại..."
                rows={2}
                className="w-full bg-[#0c0e14] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#f0b90b]/50 resize-none"
              />
            </div>
          )}

          {/* Actions */}
          {(submission.status === 'PENDING' || submission.status === 'REVIEWING') && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onReview('APPROVED')}
                disabled={reviewing}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              >
                {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Phê duyệt KYC
              </button>
              <button
                onClick={() => onReview('REJECTED', rejectionReason)}
                disabled={reviewing || !rejectionReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              >
                {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Từ chối
              </button>
            </div>
          )}

          {submission.status === 'APPROVED' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              KYC này đã được phê duyệt
              {submission.reviewed_at && ` vào ${new Date(submission.reviewed_at).toLocaleDateString('vi-VN')}`}
            </div>
          )}

          {submission.status === 'REJECTED' && submission.rejection_reason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
              <p className="font-bold mb-1">Đã từ chối:</p>
              <p>{submission.rejection_reason}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main Admin KYC Page ─────────────────────────────────────────────────── */
export default function AdminKYCPage() {
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [grantWallet, setGrantWallet] = useState('');
  const [grantUserId, setGrantUserId] = useState('');
  const [granting, setGranting] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch KYC submissions
      const subsRes = await apiClient.get('/api/kyc/submissions', {
        params: { status: statusFilter },
      });
      setSubmissions(subsRes.data?.submissions || []);

      // Fetch on-chain KYC records
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
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Grant KYC manually (wallet-based)
  const handleGrant = async () => {
    if (!grantWallet.startsWith('0x') || grantWallet.length !== 42) {
      toast.error('Invalid wallet address (0x... 42 characters)');
      return;
    }
    setGranting(true);
    try {
      await apiClient.post('/api/rwa/kyc/grant', {
        wallet_address: grantWallet,
        user_id: grantUserId ? parseInt(grantUserId) : null,
        jurisdiction: 'VN',
      });
      toast.success(`KYC granted for ${grantWallet.slice(0, 10)}...`);
      setGrantWallet('');
      setGrantUserId('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Grant KYC failed');
    } finally {
      setGranting(false);
    }
  };

  // Review submission
  const handleReview = async (action: 'APPROVED' | 'REJECTED', reason?: string) => {
    if (!selectedSubmission) return;
    setReviewingId(selectedSubmission.submission_id);
    try {
      await apiClient.patch(`/api/kyc/submissions/${selectedSubmission.submission_id}/review`, {
        action,
        rejection_reason: reason || null,
      });
      toast.success(action === 'APPROVED' ? 'KYC approved + on-chain grant!' : 'KYC rejected');
      setSelectedSubmission(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Review failed');
    } finally {
      setReviewingId(null);
    }
  };

  // Revoke on-chain KYC
  const handleRevoke = async (wallet: string) => {
    if (!confirm(`Revoke KYC for ${wallet.slice(0, 10)}...?`)) return;
    setActionLoading(wallet);
    try {
      await apiClient.post('/api/rwa/kyc/revoke', { wallet_address: wallet });
      toast.success('KYC revoked');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Revoke failed');
    } finally {
      setActionLoading(null);
    }
  };

  const shortAddr = (a: string) => `${a.slice(0, 8)}...${a.slice(-6)}`;

  const filteredSubmissions = submissions.filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase())
    || s.email?.toLowerCase().includes(search.toLowerCase())
    || s.wallet_address?.toLowerCase().includes(search.toLowerCase())
    || s.username?.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    ALL: submissions.length,
    PENDING: submissions.filter(s => s.status === 'PENDING').length,
    REVIEWING: submissions.filter(s => s.status === 'REVIEWING').length,
    APPROVED: submissions.filter(s => s.status === 'APPROVED').length,
    REJECTED: submissions.filter(s => s.status === 'REJECTED').length,
  };

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
          <h1 className="text-xl font-black text-white">KYC Management</h1>
          <p className="text-xs text-gray-500">Review user KYC submissions & manage on-chain verification</p>
        </div>
        <button onClick={fetchData} className="ml-auto p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['ALL', 'PENDING', 'REVIEWING', 'APPROVED', 'REJECTED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === s
                ? 'bg-[#f0b90b]/10 border-[#f0b90b]/30 text-[#f0b90b]'
                : 'bg-[#1a1d26] border-white/5 text-gray-400 hover:border-white/15'
            }`}
          >
            <p className="text-2xl font-black">{statusCounts[s as keyof typeof statusCounts]}</p>
            <p className="text-[10px] uppercase font-bold">{s === 'ALL' ? 'Total' : s}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, wallet..."
          className="w-full bg-[#1a1d26] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#f0b90b]/50"
        />
      </div>

      {/* Submissions List */}
      <div className="space-y-3">
        <h2 className="font-bold text-sm text-gray-400 uppercase flex items-center gap-2">
          <FileText className="w-4 h-4" /> KYC Submissions ({filteredSubmissions.length})
        </h2>

        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Fingerprint className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No submissions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSubmissions.map(sub => (
              <motion.div
                key={sub.submission_id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1a1d26] border border-white/5 rounded-xl p-4 hover:border-white/15 transition-all cursor-pointer"
                onClick={() => setSelectedSubmission(sub)}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#f0b90b]" />
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-sm font-bold text-white">{sub.full_name}</p>
                    <p className="text-[10px] text-gray-500">{sub.email || sub.username || `User #${sub.user_id}`}</p>
                  </div>

                  {/* Document type */}
                  <div className="hidden md:block">
                    <p className="text-[10px] text-gray-500 uppercase">Document</p>
                    <p className="text-xs font-semibold text-white">{sub.document_type}</p>
                  </div>

                  {/* Wallet */}
                  <div className="hidden lg:block">
                    <p className="text-[10px] text-gray-500 uppercase">Wallet</p>
                    <p className="text-xs font-mono text-gray-300">
                      {sub.wallet_address ? shortAddr(sub.wallet_address) : '—'}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="hidden md:block">
                    <p className="text-[10px] text-gray-500 uppercase">Submitted</p>
                    <p className="text-xs text-gray-300">
                      {new Date(sub.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  {/* Status */}
                  <StatusBadge status={sub.status} />

                  {/* Quick actions */}
                  {(sub.status === 'PENDING' || sub.status === 'REVIEWING') && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedSubmission(sub); }}
                        className="px-3 py-1.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] rounded-lg text-[10px] font-bold transition-colors"
                      >
                        Review
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Manual KYC Grant */}
      <div className="bg-[#1a1d26] border border-white/10 rounded-2xl p-6">
        <h2 className="font-bold text-sm text-white flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-emerald-400" /> Manual On-chain KYC Grant
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-500 block mb-1">User ID (optional)</label>
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
              className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            >
              {granting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Grant KYC'}
            </button>
          </div>
        </div>
      </div>

      {/* On-chain KYC Records */}
      {kycRecords.length > 0 && (
        <div className="bg-[#1a1d26] border border-white/10 rounded-2xl p-6">
          <h2 className="font-bold text-sm text-white flex items-center gap-2 mb-4">
            <Fingerprint className="w-4 h-4 text-violet-400" /> On-chain KYC Records ({kycRecords.length})
          </h2>
          <div className="space-y-2">
            {kycRecords.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className={`w-2 h-2 rounded-full ${r.verified ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <p className="text-xs font-mono text-gray-300 flex-1">{shortAddr(r.wallet_address)}</p>
                <p className="text-[10px] text-gray-500">{r.jurisdiction}</p>
                {r.verified && (
                  <button
                    onClick={() => handleRevoke(r.wallet_address)}
                    disabled={actionLoading === r.wallet_address}
                    className="px-2 py-1 text-[10px] text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    {actionLoading === r.wallet_address ? '...' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <ReviewModal
            submission={selectedSubmission}
            onClose={() => setSelectedSubmission(null)}
            onReview={handleReview}
            reviewing={reviewingId === selectedSubmission.submission_id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
