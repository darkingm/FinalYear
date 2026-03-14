'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Upload, FileText, Clock, CheckCircle, XCircle,
  Camera, Send, Shield, Search, RefreshCw, Package, Plus, X,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import { toast } from 'sonner';

interface Dispute {
  dispute_id: number;
  order_id: number;
  reason: string;
  status: string;
  resolution?: string;
  evidence_urls?: string[];
  created_at: string;
  updated_at?: string;
  product_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; textColor: string; bgColor: string; borderColor: string; icon: any }> = {
  open:         { label: 'Đang mở',       textColor: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30',  icon: Clock        },
  under_review: { label: 'Đang xét duyệt', textColor: 'text-blue-400',   bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30',   icon: FileText     },
  resolved:     { label: 'Đã giải quyết', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30',icon: CheckCircle  },
  rejected:     { label: 'Bị từ chối',    textColor: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30',    icon: XCircle      },
};

const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'open', label: 'Đang mở' },
  { value: 'under_review', label: 'Đang xét duyệt' },
  { value: 'resolved', label: 'Đã giải quyết' },
  { value: 'rejected', label: 'Bị từ chối' },
];

export default function DisputesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ order_id: '', reason: '', evidence_urls: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?callbackUrl=/disputes');
  }, [isAuthenticated, authLoading, router]);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiClient.get(`/api/orders/disputes${params}`);
      setDisputes(res.data.disputes || []);
    } catch {
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isAuthenticated) fetchDisputes();
  }, [isAuthenticated, fetchDisputes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.order_id || !form.reason.trim()) {
      toast.error('Vui lòng nhập Order ID và lý do khiếu nại');
      return;
    }
    setSubmitting(true);
    try {
      const evidence = form.evidence_urls
        ? form.evidence_urls.split(',').map(u => u.trim()).filter(Boolean)
        : [];
      await apiClient.post('/api/orders/disputes', {
        order_id: Number(form.order_id),
        reason: form.reason.trim(),
        evidence_urls: evidence,
      });
      toast.success('Đã gửi khiếu nại. Admin sẽ xét duyệt sớm!');
      setShowForm(false);
      setForm({ order_id: '', reason: '', evidence_urls: '' });
      fetchDisputes();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gửi khiếu nại thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = disputes.filter(d => {
    if (!search) return true;
    return d.reason.toLowerCase().includes(search.toLowerCase()) ||
      d.order_id.toString().includes(search) ||
      d.product_name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Ambient glows */}
      <div className="fixed top-0 right-0 w-[40%] h-[40%] bg-amber-500/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[30%] h-[30%] bg-blue-500/3 blur-[120px] rounded-full pointer-events-none" />

      <Header />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl relative z-10">

        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-foreground">Khiếu nại & Hoàn trả</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Gửi bằng chứng — Admin xét duyệt — Hoàn tiền qua Smart Contract
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchDisputes}
                disabled={loading}
                className="p-2.5 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-border/70 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowForm(v => !v)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-sm font-bold hover:bg-amber-500/20 transition-all"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Đóng' : 'Tạo khiếu nại'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* New Dispute Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <form onSubmit={handleSubmit} className="bg-card border border-amber-500/20 rounded-3xl p-6 space-y-5 shadow-xl shadow-amber-500/5">
                <div className="flex items-center gap-3 mb-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-foreground">Gửi khiếu nại mới</h3>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                  <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="text-amber-400 font-semibold">Quy trình:</span> Gửi bằng chứng ảnh/video →
                    Admin xét duyệt 24–48 giờ → Nếu chấp nhận, hoàn tiền tự động qua Smart Contract Escrow.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Order ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Nhập ID đơn hàng"
                      value={form.order_id}
                      onChange={e => setForm(d => ({ ...d, order_id: e.target.value }))}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
                      required
                    />
                    <Link href="/orders" className="text-xs text-amber-400 hover:underline mt-1 inline-block">
                      Xem danh sách đơn hàng →
                    </Link>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Bằng chứng (URL ảnh, phân cách bằng dấu phẩy)
                    </label>
                    <input
                      type="text"
                      placeholder="https://imgur.com/photo.jpg, ..."
                      value={form.evidence_urls}
                      onChange={e => setForm(d => ({ ...d, evidence_urls: e.target.value }))}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Lý do khiếu nại <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    placeholder="Mô tả chi tiết vấn đề — hàng nhận được so với mô tả, tình trạng sản phẩm, lý do muốn hoàn trả..."
                    value={form.reason}
                    onChange={e => setForm(d => ({ ...d, reason: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.reason.length}/500 ký tự</p>
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-all disabled:opacity-60 flex items-center gap-2"
                  >
                    {submitting ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" />Đang gửi...</>
                    ) : (
                      <><Send className="w-4 h-4" />Gửi khiếu nại</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo lý do, order ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  statusFilter === f.value
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/70'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dispute List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 bg-card border border-border rounded-3xl"
          >
            <Shield className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">
              {disputes.length === 0 ? 'Chưa có khiếu nại nào' : 'Không tìm thấy khiếu nại'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {disputes.length === 0
                ? 'Khi có vấn đề với đơn hàng, bạn có thể tạo khiếu nại để được hỗ trợ'
                : 'Thử tìm kiếm với từ khóa khác'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filtered.map((dispute, i) => {
              const cfg = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.open;
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={dispute.dispute_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-5 hover:border-border/70 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-sm font-bold text-foreground">
                          Khiếu nại #{dispute.dispute_id}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.textColor} ${cfg.bgColor} ${cfg.borderColor}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        <Link href={`/orders/${dispute.order_id}`}>
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded font-mono hover:text-primary transition-colors">
                            Đơn #{dispute.order_id}
                          </span>
                        </Link>
                      </div>

                      {/* Reason */}
                      <p className="text-sm text-foreground/80 mb-3 line-clamp-2">{dispute.reason}</p>

                      {/* Evidence */}
                      {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {dispute.evidence_urls.map((url, idx) => (
                            <a
                              key={idx} href={url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg hover:bg-blue-500/20 transition-colors"
                            >
                              <Camera className="w-3 h-3" />
                              Bằng chứng {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Resolution */}
                      {dispute.resolution && (
                        <div className="flex items-start gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-emerald-400">
                            <span className="font-bold">Kết quả: </span>{dispute.resolution}
                          </p>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(dispute.created_at).toLocaleDateString('vi-VN')}
                        </span>
                        {dispute.updated_at && dispute.updated_at !== dispute.created_at && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Cập nhật: {new Date(dispute.updated_at).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <Link href={`/orders/${dispute.order_id}`}>
                      <button className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-border/70 transition-all flex-shrink-0">
                        <Package className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
