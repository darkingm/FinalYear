'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, RotateCw, Search, ShieldAlert, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api/admin';

type ReconciliationCase = {
  order_id: number;
  order_number: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  order_status: string;
  order_tx_hash: string | null;
  payment_status: string | null;
  payment_tx_hash: string | null;
  payment_confirmations: number | null;
  payment_required_confirmations: number | null;
  payment_projection_version: number | null;
  payment_projection_updated_at: string | null;
  has_issue: boolean;
  issue_code: string | null;
  issue_label: string | null;
  issue_detail: string | null;
};

const issueAccent: Record<string, string> = {
  stuck_confirmation: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  projection_mismatch_confirmed: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  projection_mismatch_failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  missing_payment_record: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  tx_hash_mismatch: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
  missing_order_tx_hash: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
};

export default function AdminReconciliationPage() {
  const [cases, setCases] = useState<ReconciliationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOrderId, setFilterOrderId] = useState('');
  const [problemsOnly, setProblemsOnly] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.payments.reconciliation({
        limit: 100,
        problems_only: problemsOnly,
        order_id: filterOrderId ? Number(filterOrderId) : undefined,
      });
      setCases(response.data.cases || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load reconciliation cases');
    } finally {
      setLoading(false);
    }
  }, [filterOrderId, problemsOnly]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const refreshCases = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCases();
    } finally {
      setRefreshing(false);
    }
  }, [fetchCases]);

  const handleRetryVerify = async (orderId: number) => {
    setBusyOrderId(orderId);
    try {
      await adminApi.payments.retryVerify(orderId);
      toast.success(`Retried blockchain verify for order #${orderId}`);
      await fetchCases();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Retry verify failed');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleReconcileOrder = async (orderId: number) => {
    setBusyOrderId(orderId);
    try {
      await adminApi.payments.reconcileOrder(orderId);
      toast.success(`Repaired order projection for order #${orderId}`);
      await fetchCases();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Order reconcile failed');
    } finally {
      setBusyOrderId(null);
    }
  };

  const summary = useMemo(() => {
    return {
      total: cases.length,
      issues: cases.filter((entry) => entry.has_issue).length,
      stuck: cases.filter((entry) => entry.issue_code === 'stuck_confirmation').length,
      mismatches: cases.filter((entry) => String(entry.issue_code).startsWith('projection_mismatch')).length,
    };
  }, [cases]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-cyan-400" />
            Payment Reconciliation
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Theo dõi payment stuck, projection mismatch và sửa lệch trạng thái giữa payment-service với order state.
          </p>
        </div>
        <button
          onClick={refreshCases}
          className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Đang hiển thị', value: summary.total, tone: 'text-white' },
          { label: 'Có issue', value: summary.issues, tone: 'text-amber-300' },
          { label: 'Stuck confirmation', value: summary.stuck, tone: 'text-orange-300' },
          { label: 'Projection mismatch', value: summary.mismatches, tone: 'text-cyan-300' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/8 bg-[#1a1d26] p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500">{item.label}</div>
            <div className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#1a1d26] p-4 flex flex-wrap gap-3 items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={filterOrderId}
            onChange={(event) => setFilterOrderId(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="Lọc theo order id"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#11141c] border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300 px-3 py-2.5 rounded-xl bg-[#11141c] border border-white/10">
          <input
            type="checkbox"
            checked={problemsOnly}
            onChange={(event) => setProblemsOnly(event.target.checked)}
            className="accent-cyan-400"
          />
          Chỉ hiện case có vấn đề
        </label>
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#1a1d26] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Order State</th>
                <th className="px-4 py-3 font-medium">Payment State</th>
                <th className="px-4 py-3 font-medium">Issue</th>
                <th className="px-4 py-3 font-medium">Projection</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {loading ? (
                [...Array(5)].map((_, index) => (
                  <tr key={index}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    Không có reconciliation case nào theo bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                cases.map((entry) => (
                  <tr key={entry.order_id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-white">#{entry.order_id}</div>
                      <div className="text-xs text-gray-500">{entry.order_number || 'N/A'}</div>
                      {entry.order_tx_hash && (
                        <div className="mt-2 text-[11px] font-mono text-gray-400 break-all">{entry.order_tx_hash}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="text-gray-100">{entry.buyer_name || '-'}</div>
                      <div className="text-gray-500">{entry.buyer_email || '-'}</div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="inline-flex px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-100">
                        {entry.order_status}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="inline-flex px-2.5 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                        {entry.payment_status || 'missing'}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {entry.payment_confirmations ?? 0}/{entry.payment_required_confirmations ?? 0} confirmations
                      </div>
                      {entry.payment_tx_hash && (
                        <div className="mt-1 text-[11px] font-mono text-gray-500 break-all">{entry.payment_tx_hash}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {entry.has_issue ? (
                        <div className={`inline-flex px-2.5 py-1 rounded-lg border ${issueAccent[entry.issue_code || ''] || 'border-white/10 bg-white/5 text-gray-200'}`}>
                          {entry.issue_label}
                        </div>
                      ) : (
                        <div className="inline-flex px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                          Healthy
                        </div>
                      )}
                      <div className="mt-2 text-xs text-gray-500 max-w-[260px]">
                        {entry.issue_detail || 'Không phát hiện bất nhất ở snapshot hiện tại.'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="text-gray-200">v{entry.payment_projection_version ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {entry.payment_projection_updated_at
                          ? new Date(entry.payment_projection_updated_at).toLocaleString()
                          : 'Chưa sync'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        <button
                          onClick={() => handleRetryVerify(entry.order_id)}
                          disabled={busyOrderId === entry.order_id}
                          className="px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <RotateCw className={`w-4 h-4 ${busyOrderId === entry.order_id ? 'animate-spin' : ''}`} />
                          Retry verify
                        </button>
                        <button
                          onClick={() => handleReconcileOrder(entry.order_id)}
                          disabled={busyOrderId === entry.order_id}
                          className="px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Wrench className="w-4 h-4" />
                          Repair order sync
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#1a1d26] p-4 text-sm text-gray-400 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
        <div>
          <code className="text-cyan-200">Retry verify</code> sẽ ép payment-service đọc lại blockchain theo <code className="text-cyan-200">tx_hash</code>.{' '}
          <code className="text-amber-200">Repair order sync</code> sẽ sửa <code className="text-amber-200">orders.status</code> theo snapshot payment hiện tại nếu projection bị lệch.
        </div>
      </div>
    </div>
  );
}
