'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, Filter, ChevronLeft, ChevronRight, Clock, User, Tag } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';

const entityColors: Record<string, string> = {
    user: 'text-blue-400 bg-blue-400/10',
    order: 'text-emerald-400 bg-emerald-400/10',
    product: 'text-amber-400 bg-amber-400/10',
    payment: 'text-purple-400 bg-purple-400/10',
    refund: 'text-rose-400 bg-rose-400/10',
};

export default function AdminAuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [entityFilter, setEntityFilter] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.auditLogs({ page, limit: 50, entity_type: entityFilter || undefined });
            setLogs(res.data.logs);
        } catch {
            toast.error('Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    }, [page, entityFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                    <FileText className="w-8 h-8 text-indigo-400" />
                    Audit Logs
                </h1>
                <p className="text-gray-500 mt-1">Track all system changes and admin actions</p>
            </div>

            <div className="flex gap-2 flex-wrap">
                {['', 'user', 'order', 'product', 'payment', 'refund'].map(e => (
                    <button key={e} onClick={() => { setEntityFilter(e); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${entityFilter === e ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' : 'bg-white text-gray-400 border-gray-100'
                            }`}>{e || 'All'}</button>
                ))}
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <FileText className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                        <p>No audit logs found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {logs.map((log, idx) => (
                            <motion.div
                                key={log.log_id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.02 }}
                                className="px-6 py-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${entityColors[log.entity_type] || 'text-gray-400 bg-gray-400/10'}`}>
                                        {log.entity_type}
                                    </span>
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Tag className="w-3 h-3" /> {log.action}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        Entity #{log.entity_id}
                                    </span>
                                    {log.changed_by_name && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <User className="w-3 h-3" /> {log.changed_by_name}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-600 ml-auto flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                {(log.old_value || log.new_value) && (
                                    <div className="mt-2 flex gap-4 text-xs">
                                        {log.old_value && (
                                            <div className="flex-1 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                                <span className="text-red-400 font-medium">Before: </span>
                                                <code className="text-gray-400">{typeof log.old_value === 'string' ? log.old_value : JSON.stringify(log.old_value)}</code>
                                            </div>
                                        )}
                                        {log.new_value && (
                                            <div className="flex-1 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                                                <span className="text-green-400 font-medium">After: </span>
                                                <code className="text-gray-400">{typeof log.new_value === 'string' ? log.new_value : JSON.stringify(log.new_value)}</code>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-100">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm text-gray-500">Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-900"><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}
