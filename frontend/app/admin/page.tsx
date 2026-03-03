'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Users, ShoppingCart, DollarSign, AlertTriangle,
    TrendingUp, ArrowUpRight, Package, Clock, CheckCircle,
    Activity, Tag, RefreshCw, Zap, BarChart3,
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import Link from 'next/link';

interface DashboardData {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    activeDisputes: number;
    recentOrders: any[];
    revenueChart: any[];
    ordersByStatus: any[];
}

const STATUS_COLORS: Record<string, string> = {
    COMPLETED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    PAID: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    DISPUTED: 'text-red-400 bg-red-500/10 border-red-500/20',
    PROCESSING: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    SHIPPED: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    CANCELLED: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    UNPAID: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const res = await adminApi.dashboard();
            setData(res.data);
        } catch { toast.error('Failed to load dashboard'); }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const refresh = () => { setRefreshing(true); fetchData(); };

    if (loading) return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-[#1a1d26] animate-pulse rounded-xl" />)}
            </div>
        </div>
    );

    const stats = [
        { label: 'Người dùng', value: (data?.totalUsers || 0).toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', href: '/admin/users', change: '+12%' },
        { label: 'Đơn hàng', value: (data?.totalOrders || 0).toLocaleString(), icon: ShoppingCart, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', href: '/admin/orders', change: '+8%' },
        { label: 'Doanh thu', value: `$${Number(data?.totalRevenue || 0).toFixed(0)}`, icon: DollarSign, color: 'text-[#f0b90b]', bg: 'bg-[#f0b90b]/10 border-[#f0b90b]/20', href: '/admin/orders', change: '+23%' },
        { label: 'Tranh chấp', value: (data?.activeDisputes || 0).toLocaleString(), icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', href: '/admin/disputes', change: '-5%' },
    ];

    const quickActions = [
        { icon: Tag, label: 'Tạo Voucher', desc: 'Thêm mã giảm giá mới', href: '/admin/vouchers', color: 'text-[#f0b90b]' },
        { icon: Package, label: 'Quản lý SP', desc: 'Duyệt sản phẩm mới', href: '/admin/products', color: 'text-blue-400' },
        { icon: Users, label: 'Người dùng', desc: 'Xem trạng thái users', href: '/admin/users', color: 'text-emerald-400' },
        { icon: RefreshCw, label: 'Hoàn tiền', desc: 'Xử lý yêu cầu hoàn', href: '/admin/refunds', color: 'text-purple-400' },
    ];

    const chartMax = data?.revenueChart?.length
        ? Math.max(...data.revenueChart.map((r: any) => Number(r.revenue) || 0), 1)
        : 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Tổng quan thị trường Web3Market</p>
                </div>
                <button onClick={refresh} disabled={refreshing}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white text-sm transition-colors">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Làm mới</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                        <Link href={stat.href}>
                            <div className={`bg-[#1a1d26] rounded-xl border p-5 hover:bg-[#1a1d26]/80 transition-all group cursor-pointer ${stat.bg}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                                        <stat.icon className="w-4 h-4" />
                                    </div>
                                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-white transition-colors" />
                                </div>
                                <div className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-gray-500">{stat.label}</div>
                                    <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{stat.change}</span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Thao tác nhanh</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {quickActions.map((a, i) => (
                        <motion.div key={a.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                            <Link href={a.href}>
                                <div className="bg-[#1a1d26] border border-white/8 rounded-xl p-4 hover:border-white/20 hover:bg-white/3 transition-all cursor-pointer group">
                                    <a.icon className={`w-5 h-5 ${a.color} mb-2`} />
                                    <p className="text-sm font-semibold text-white">{a.label}</p>
                                    <p className="text-xs text-gray-600 mt-0.5">{a.desc}</p>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Revenue Chart */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="bg-[#1a1d26] border border-white/8 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-[#f0b90b]" />
                            Doanh thu 30 ngày
                        </h3>
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">+23%</span>
                    </div>
                    {data?.revenueChart?.length ? (
                        <div className="h-40 flex items-end gap-0.5">
                            {data.revenueChart.map((item: any, i: number) => {
                                const h = ((Number(item.revenue) || 0) / chartMax) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full rounded-t overflow-hidden group relative cursor-pointer" style={{ height: `${Math.max(h, 4)}%` }}>
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#f0b90b]/40 to-[#f0b90b]/80 group-hover:from-[#f0b90b]/60 group-hover:to-[#f0b90b] transition-colors" />
                                        </div>
                                        {i % 6 === 0 && <span className="text-[9px] text-gray-700">{item.date?.slice(5)}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-gray-600 text-sm">Chưa có dữ liệu</div>
                    )}
                </motion.div>

                {/* Order Status */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="bg-[#1a1d26] border border-white/8 rounded-xl p-6">
                    <h3 className="font-semibold text-white flex items-center gap-2 mb-6">
                        <Activity className="w-4 h-4 text-[#f0b90b]" />
                        Trạng thái đơn hàng
                    </h3>
                    {data?.ordersByStatus?.length ? (
                        <div className="space-y-3">
                            {data.ordersByStatus.map((item: any, i: number) => {
                                const total = data.ordersByStatus.reduce((s: number, x: any) => s + Number(x.count), 0);
                                const pct = total > 0 ? (Number(item.count) / total) * 100 : 0;
                                const barColors = ['bg-blue-500', 'bg-emerald-500', 'bg-[#f0b90b]', 'bg-purple-500', 'bg-red-500', 'bg-cyan-500'];
                                return (
                                    <div key={item.status} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-400 w-24 truncate">{item.status}</span>
                                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.8, delay: 0.7 + i * 0.1 }}
                                                className={`h-full rounded-full ${barColors[i % barColors.length]}`} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-300 w-8 text-right">{item.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-gray-600 text-sm">Chưa có dữ liệu</div>
                    )}
                </motion.div>
            </div>

            {/* Recent Orders */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                className="bg-[#1a1d26] border border-white/8 rounded-xl overflow-hidden">
                <div className="p-5 flex items-center justify-between border-b border-white/8">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#f0b90b]" />
                        Đơn hàng gần đây
                    </h3>
                    <Link href="/admin/orders" className="text-xs text-[#f0b90b] hover:text-[#e6a800] font-medium">
                        Xem tất cả →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] text-gray-600 uppercase tracking-wider border-b border-white/5">
                                {['Đơn hàng', 'Người mua', 'Giá trị', 'Trạng thái', 'Ngày'].map(h => (
                                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/3">
                            {(data?.recentOrders || []).slice(0, 8).map((order: any) => (
                                <tr key={order.order_id} className="hover:bg-white/2 transition-colors">
                                    <td className="px-5 py-3">
                                        <Link href="/admin/orders" className="text-sm font-mono text-[#f0b90b] hover:text-[#e6a800]">
                                            #{order.order_number || String(order.order_id).slice(0, 8)}
                                        </Link>
                                    </td>
                                    <td className="px-5 py-3 text-sm text-gray-400">{order.buyer_name || '—'}</td>
                                    <td className="px-5 py-3 text-sm font-semibold text-white">${Number(order.total_amount || 0).toFixed(2)}</td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-600">
                                        {order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '—'}
                                    </td>
                                </tr>
                            ))}
                            {(!data?.recentOrders || data.recentOrders.length === 0) && (
                                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-600 text-sm">Chưa có đơn hàng</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
