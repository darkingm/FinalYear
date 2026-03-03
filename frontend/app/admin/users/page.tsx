'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Shield, UserCheck, UserX, ChevronLeft, ChevronRight, Crown, ShoppingBag } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';

const roleColors: Record<string, string> = {
    buyer: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    seller: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    admin: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
};

const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    suspended: 'text-yellow-400 bg-yellow-400/10',
    banned: 'text-red-400 bg-red-400/10',
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [editModal, setEditModal] = useState<{ userId: number; type: 'status' | 'role'; current: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.users.list({
                page, limit: 20,
                role: roleFilter || undefined,
                status: statusFilter || undefined,
                search: search || undefined,
            });
            setUsers(res.data.users);
            setTotalPages(res.data.totalPages);
        } catch {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [page, roleFilter, statusFilter, search]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleEdit = async () => {
        if (!editModal) return;
        try {
            if (editModal.type === 'status') {
                await adminApi.users.updateStatus(editModal.userId, editValue);
            } else {
                await adminApi.users.updateRole(editModal.userId, editValue);
            }
            toast.success(`User ${editModal.type} updated`);
            setEditModal(null);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Update failed');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                    <Users className="w-8 h-8 text-blue-400" />
                    Users Management
                </h1>
                <p className="text-gray-500 mt-1">Manage users, roles, and account status</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search username, email, wallet..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                </div>
                <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-300">
                    <option value="">All Roles</option>
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                    <option value="admin">Admin</option>
                </select>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-300">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="text-left px-5 py-3 font-medium">User</th>
                                <th className="text-left px-5 py-3 font-medium">Wallet</th>
                                <th className="text-left px-5 py-3 font-medium">Role</th>
                                <th className="text-left px-5 py-3 font-medium">Status</th>
                                <th className="text-left px-5 py-3 font-medium">Orders</th>
                                <th className="text-left px-5 py-3 font-medium">Seller Info</th>
                                <th className="text-left px-5 py-3 font-medium">Joined</th>
                                <th className="text-left px-5 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>)}</tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-500">No users found</td></tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-gray-900 flex-shrink-0">
                                                    {(user.username || user.email)?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{user.username || 'N/A'}</div>
                                                    <div className="text-xs text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <code className="text-xs text-gray-400 font-mono">{user.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : '-'}</code>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-md border ${roleColors[user.role] || 'text-gray-400 bg-gray-400/10 border-gray-400/20'}`}>
                                                {user.role === 'admin' && <Crown className="w-3 h-3 inline mr-1" />}
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[user.status] || 'text-gray-400 bg-gray-400/10'}`}>{user.status}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <ShoppingBag className="w-3 h-3" /> {user.orders_as_buyer || 0} bought
                                                {user.role === 'seller' && <span>• {user.orders_as_seller || 0} sold</span>}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-400">
                                            {user.seller_display_name ? (
                                                <div>
                                                    <div className="text-gray-300">{user.seller_display_name}</div>
                                                    <div>KYC: <span className={user.kyc_status === 'verified' ? 'text-green-400' : 'text-yellow-400'}>{user.kyc_status}</span></div>
                                                    {user.seller_rating && <div>★ {parseFloat(user.seller_rating).toFixed(1)}</div>}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => { setEditModal({ userId: user.user_id, type: 'role', current: user.role }); setEditValue(user.role); }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-blue-400 transition-colors" title="Change Role"
                                                >
                                                    <Shield className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setEditModal({ userId: user.user_id, type: 'status', current: user.status }); setEditValue(user.status); }}
                                                    className={`p-1.5 rounded-lg hover:bg-gray-50 transition-colors ${user.status === 'active' ? 'text-gray-400 hover:text-red-400' : 'text-gray-400 hover:text-green-400'}`}
                                                    title={user.status === 'active' ? 'Suspend/Ban' : 'Activate'}
                                                >
                                                    {user.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-900 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditModal(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm rounded-2xl bg-white border border-gray-200 p-6" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                {editModal.type === 'role' ? 'Change User Role' : 'Change User Status'}
                            </h3>
                            <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 mb-4"
                            >
                                {editModal.type === 'role' ? (
                                    <>
                                        <option value="buyer">Buyer</option>
                                        <option value="seller">Seller</option>
                                        <option value="admin">Admin</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="banned">Banned</option>
                                    </>
                                )}
                            </select>
                            <div className="flex gap-3">
                                <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-sm">Cancel</button>
                                <button onClick={handleEdit} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-gray-900 text-sm font-medium">Save</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
