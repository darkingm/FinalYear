'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Upload, FileText, Clock, CheckCircle, XCircle, Camera, Send } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
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
}

const statusConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  open: { label: 'Open', color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50 border-amber-200' },
  under_review: { label: 'Under Review', color: 'text-blue-600', icon: FileText, bg: 'bg-blue-50 border-blue-200' },
  resolved: { label: 'Resolved', color: 'text-green-600', icon: CheckCircle, bg: 'bg-green-50 border-green-200' },
  rejected: { label: 'Rejected', color: 'text-red-600', icon: XCircle, bg: 'bg-red-50 border-red-200' },
};

export default function DisputesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewDispute, setShowNewDispute] = useState(false);
  const [newDispute, setNewDispute] = useState({ order_id: '', reason: '', evidence_urls: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/disputes');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) fetchDisputes();
  }, [isAuthenticated, statusFilter]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiClient.get(`/api/orders/disputes${params}`);
      setDisputes(res.data.disputes || []);
    } catch {
      // Fallback: no disputes endpoint may exist yet
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDispute.order_id || !newDispute.reason) {
      toast.error('Please fill in Order ID and reason');
      return;
    }
    setSubmitting(true);
    try {
      const evidence = newDispute.evidence_urls
        ? newDispute.evidence_urls.split(',').map(u => u.trim()).filter(Boolean)
        : [];
      await apiClient.post('/api/orders/disputes', {
        order_id: Number(newDispute.order_id),
        reason: newDispute.reason,
        evidence_urls: evidence,
      });
      toast.success('Dispute submitted! Admin will review your case.');
      setShowNewDispute(false);
      setNewDispute({ order_id: '', reason: '', evidence_urls: '' });
      fetchDisputes();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Disputes & Returns</h1>
              <p className="text-gray-500 text-sm">Submit evidence for returns — admin will review and decide</p>
            </div>
          </div>
          <Button onClick={() => setShowNewDispute(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
            <Send className="w-4 h-4 mr-2" /> New Dispute
          </Button>
        </motion.div>

        {/* New Dispute Form */}
        <AnimatePresence>
          {showNewDispute && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <form onSubmit={handleSubmitDispute} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  Submit Return / Dispute
                </h3>
                <p className="text-sm text-gray-500">
                  Provide your order ID, explain the issue, and attach evidence (photo URLs). The admin will review and decide whether to release a refund from the smart contract escrow.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                    <input
                      type="number"
                      placeholder="Enter your order ID"
                      value={newDispute.order_id}
                      onChange={e => setNewDispute(d => ({ ...d, order_id: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Evidence URLs (comma separated)</label>
                    <input
                      type="text"
                      placeholder="https://imgur.com/photo1.jpg, https://..."
                      value={newDispute.evidence_urls}
                      onChange={e => setNewDispute(d => ({ ...d, evidence_urls: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Return / Dispute</label>
                  <textarea
                    placeholder="Describe the issue in detail — what went wrong, what you received vs what was expected..."
                    value={newDispute.reason}
                    onChange={e => setNewDispute(d => ({ ...d, reason: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-none"
                    required
                  />
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-sm text-blue-700 flex items-start gap-2">
                    <Upload className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>How it works:</strong> After submitting, the admin will review your evidence. If approved, the admin will use the smart contract to refund your crypto payment directly to your wallet.</span>
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowNewDispute(false)} className="border-gray-200">Cancel</Button>
                  <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {submitting ? 'Submitting...' : 'Submit Dispute'}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[['', 'All'], ['open', 'Open'], ['under_review', 'Under Review'], ['resolved', 'Resolved'], ['rejected', 'Rejected']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${statusFilter === val
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-200 hover:text-blue-600'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Disputes List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <AlertTriangle className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No disputes found</h3>
            <p className="text-gray-500 text-sm">You haven&apos;t raised any disputes yet</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute, i) => {
              const config = statusConfig[dispute.status] || statusConfig.open;
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={dispute.dispute_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-gray-900">Dispute #{dispute.dispute_id}</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.bg} ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                          Order #{dispute.order_id}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm mb-3">{dispute.reason}</p>
                      {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {dispute.evidence_urls.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors">
                              <Camera className="w-3 h-3" />
                              Evidence {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                      {dispute.resolution && (
                        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                          <p className="text-sm text-green-700"><strong>Resolution:</strong> {dispute.resolution}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(dispute.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link href={`/disputes/${dispute.dispute_id}`}>
                      <Button variant="outline" size="sm" className="border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200">
                        View Details
                      </Button>
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
