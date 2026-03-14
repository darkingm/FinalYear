'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, ChevronLeft, ChevronRight, Eye, Ban, CheckCircle, Zap } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    draft: 'text-yellow-400 bg-yellow-400/10',
    inactive: 'text-gray-400 bg-gray-400/10',
    deleted: 'text-red-400 bg-red-400/10',
};

export default function AdminProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.products.list({ page, limit: 20, status: statusFilter || undefined, search: search || undefined });
            setProducts(res.data.products);
            setTotalPages(res.data.totalPages);
        } catch {
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, search]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleStatusUpdate = async (productId: number, status: string) => {
        try {
            await adminApi.products.updateStatus(productId, status);
            toast.success('Product status updated');
            fetchProducts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update');
        }
    };

    const handleMintNFT = async (productId: number) => {
        try {
            toast.loading('Minting NFT to Polygon Network...', { id: `mint-${productId}` });
            const res = await apiClient.post(`/api/nft/mint/${productId}`);
            toast.success(`NFT Minted Successfully! Tx ID: ${res.data.data?.txHash?.slice(0, 10)}...`, { id: `mint-${productId}` });
            fetchProducts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to mint NFT', { id: `mint-${productId}` });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                    <Package className="w-8 h-8 text-cyan-400" />
                    Products Management
                </h1>
                <p className="text-gray-500 mt-1">Manage marketplace product listings</p>
            </div>

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                    />
                </div>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-300">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Inactive</option>
                    <option value="deleted">Deleted</option>
                </select>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="text-left px-5 py-3 font-medium">Product</th>
                                <th className="text-left px-5 py-3 font-medium">Seller</th>
                                <th className="text-left px-5 py-3 font-medium">Price</th>
                                <th className="text-left px-5 py-3 font-medium">Stock</th>
                                <th className="text-left px-5 py-3 font-medium">Orders</th>
                                <th className="text-left px-5 py-3 font-medium">Rating</th>
                                <th className="text-left px-5 py-3 font-medium">Status</th>
                                <th className="text-left px-5 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>)}</tr>)
                            ) : products.length === 0 ? (
                                <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-500">No products found</td></tr>
                            ) : products.map((product) => (
                                <tr key={product.product_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">{product.name}</div>
                                        <div className="text-xs text-gray-500">{product.category || 'Uncategorized'}</div>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-300">{product.seller_name || '-'}</td>
                                    <td className="px-5 py-4 text-sm font-medium text-gray-900">${parseFloat(product.base_price_usd).toFixed(2)}</td>
                                    <td className="px-5 py-4 text-sm">
                                        <span className={`${(product.stock_available || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {product.stock_available ?? 'N/A'}
                                        </span>
                                        {product.stock_reserved > 0 && <span className="text-xs text-yellow-400 ml-1">({product.stock_reserved} reserved)</span>}
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-400">{product.order_count || 0}</td>
                                    <td className="px-5 py-4 text-sm text-yellow-400">
                                        {product.rating_avg ? `★ ${parseFloat(product.rating_avg).toFixed(1)} (${product.review_count})` : '-'}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[product.status] || 'text-gray-400 bg-gray-400/10'}`}>{product.status}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            {product.status === 'active' ? (
                                                <button onClick={() => handleStatusUpdate(product.product_id, 'inactive')} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Deactivate">
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button onClick={() => handleStatusUpdate(product.product_id, 'active')} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition-colors" title="Activate">
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {product.status === 'active' && !product.has_nft && (
                                                <button onClick={() => handleMintNFT(product.product_id)} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors" title="Mint NFT as RWA">
                                                    <Zap className="w-4 h-4" />
                                                </button>
                                            )}
                                            {product.has_nft && (
                                                <span className="text-[10px] font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-md" title="RWA NFT Minted">NFT</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
        </div>
    );
}
