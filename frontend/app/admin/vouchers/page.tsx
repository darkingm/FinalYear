'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Calendar, Percent, DollarSign, Users, X } from 'lucide-react';
import { toast } from 'sonner';

interface Voucher {
    id: number;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    minOrder: number;
    maxUses: number;
    usedCount: number;
    expiresAt: string;
    active: boolean;
    description: string;
}

// Mock data - replace with real API
const MOCK_VOUCHERS: Voucher[] = [
    { id: 1, code: 'WELCOME20', type: 'percent', value: 20, minOrder: 50, maxUses: 100, usedCount: 34, expiresAt: '2026-06-01', active: true, description: 'Giảm 20% cho người dùng mới' },
    { id: 2, code: 'FLASH50', type: 'fixed', value: 50, minOrder: 200, maxUses: 50, usedCount: 12, expiresAt: '2026-03-15', active: true, description: 'Giảm $50 Flash Sale' },
    { id: 3, code: 'WEB3FREE', type: 'percent', value: 5, minOrder: 0, maxUses: 999, usedCount: 200, expiresAt: '2026-12-31', active: false, description: 'Giảm 5% tất cả đơn hàng crypto' },
];

export default function AdminVouchersPage() {
    const [vouchers, setVouchers] = useState<Voucher[]>(MOCK_VOUCHERS);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        code: '', type: 'percent' as 'percent' | 'fixed', value: 10,
        minOrder: 0, maxUses: 100, expiresAt: '', description: '',
    });

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        setForm(f => ({ ...f, code }));
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success(`Đã copy: ${code}`);
    };

    const toggleVoucher = (id: number) => {
        setVouchers(vs => vs.map(v => v.id === id ? { ...v, active: !v.active } : v));
    };

    const deleteVoucher = (id: number) => {
        setVouchers(vs => vs.filter(v => v.id !== id));
        toast.success('Đã xóa voucher');
    };

    const createVoucher = () => {
        if (!form.code) { toast.error('Nhập mã voucher'); return; }
        const newV: Voucher = {
            id: Date.now(), code: form.code.toUpperCase(), type: form.type,
            value: form.value, minOrder: form.minOrder, maxUses: form.maxUses,
            usedCount: 0, expiresAt: form.expiresAt, active: true, description: form.description,
        };
        setVouchers(vs => [newV, ...vs]);
        setShowModal(false);
        toast.success('Đã tạo voucher!');
        setForm({ code: '', type: 'percent', value: 10, minOrder: 0, maxUses: 100, expiresAt: '', description: '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Voucher & Coupon</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Quản lý mã giảm giá</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl text-sm transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Tạo mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Tổng voucher', value: vouchers.length, icon: Tag, color: 'text-[#f0b90b]', bg: 'bg-[#f0b90b]/10 border-[#f0b90b]/20' },
                    { label: 'Đang hoạt động', value: vouchers.filter(v => v.active).length, icon: ToggleRight, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Tổng lượt dùng', value: vouchers.reduce((s, v) => s + v.usedCount, 0), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className={`bg-[#1a1d26] border rounded-xl p-4 ${s.bg}`}>
                        <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-gray-500">{s.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Voucher list */}
            <div className="bg-[#1a1d26] border border-white/8 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/8">
                    <h3 className="text-sm font-semibold text-white">Danh sách voucher</h3>
                </div>
                <div className="divide-y divide-white/5">
                    {vouchers.map((v, i) => (
                        <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                            className="p-4 flex flex-wrap md:flex-nowrap items-center gap-4 hover:bg-white/2 transition-colors">
                            {/* Code */}
                            <div className="flex items-center gap-2 min-w-fit">
                                <div className="px-3 py-1.5 bg-[#f0b90b]/10 border border-[#f0b90b]/30 rounded-lg">
                                    <span className="font-mono font-bold text-[#f0b90b] text-sm">{v.code}</span>
                                </div>
                                <button onClick={() => copyCode(v.code)} className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors">
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{v.description}</p>
                                <div className="flex flex-wrap gap-3 mt-1">
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        {v.type === 'percent' ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                                        Giảm {v.type === 'percent' ? `${v.value}%` : `$${v.value}`}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        <Users className="w-3 h-3" />
                                        {v.usedCount}/{v.maxUses} lượt
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        <Calendar className="w-3 h-3" />
                                        {v.expiresAt || 'Không giới hạn'}
                                    </span>
                                </div>
                            </div>

                            {/* Usage bar */}
                            <div className="w-24 hidden md:block">
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#f0b90b] rounded-full transition-all"
                                        style={{ width: `${(v.usedCount / v.maxUses) * 100}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-gray-600 mt-1 text-right">{Math.round((v.usedCount / v.maxUses) * 100)}%</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-auto">
                                <button onClick={() => toggleVoucher(v.id)} title={v.active ? 'Tắt' : 'Bật'}>
                                    {v.active
                                        ? <ToggleRight className="w-6 h-6 text-emerald-400 hover:text-emerald-300" />
                                        : <ToggleLeft className="w-6 h-6 text-gray-600 hover:text-gray-400" />}
                                </button>
                                <button onClick={() => deleteVoucher(v.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative bg-[#1a1d26] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-white">Tạo voucher mới</h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {/* Code */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Mã voucher</label>
                                <div className="flex gap-2">
                                    <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                        placeholder="VD: SALE20"
                                        className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#f0b90b]/40 font-mono uppercase" />
                                    <button onClick={generateCode} className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white text-xs transition-colors">
                                        Tạo tự động
                                    </button>
                                </div>
                            </div>

                            {/* Type + Value */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Loại giảm</label>
                                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percent' | 'fixed' }))}
                                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm focus:outline-none focus:border-[#f0b90b]/40">
                                        <option value="percent">Phần trăm (%)</option>
                                        <option value="fixed">Số tiền cố định ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Giá trị giảm</label>
                                    <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#f0b90b]/40" />
                                </div>
                            </div>

                            {/* Min order + Max uses */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Đơn tối thiểu ($)</label>
                                    <input type="number" value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: Number(e.target.value) }))}
                                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#f0b90b]/40" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Giới hạn lượt dùng</label>
                                    <input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: Number(e.target.value) }))}
                                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#f0b90b]/40" />
                                </div>
                            </div>

                            {/* Expires */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Ngày hết hạn</label>
                                <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm focus:outline-none focus:border-[#f0b90b]/40" />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Mô tả</label>
                                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Mô tả ngắn về voucher..."
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#f0b90b]/40" />
                            </div>

                            <button onClick={createVoucher}
                                className="w-full py-3 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl text-sm transition-colors">
                                Tạo voucher
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
