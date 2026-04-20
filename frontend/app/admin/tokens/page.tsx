'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, ToggleLeft, ToggleRight, Layers, Hash } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import { TESTNET_LITE_CHAIN_LABELS } from '@/lib/web3/testnet-lite';

const chainNames: Record<number, string> = {
    ...TESTNET_LITE_CHAIN_LABELS,
    137: 'Polygon',
    42161: 'Arbitrum',
    1: 'Ethereum',
};

export default function AdminTokensPage() {
    const [tokens, setTokens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTokens = async () => {
        setLoading(true);
        try {
            const res = await adminApi.tokens.list();
            setTokens(res.data.tokens);
        } catch {
            toast.error('Failed to load tokens');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTokens(); }, []);

    const handleToggle = async (tokenId: number, currentActive: boolean) => {
        try {
            await adminApi.tokens.update(tokenId, !currentActive);
            toast.success(`Token ${currentActive ? 'deactivated' : 'activated'}`);
            fetchTokens();
        } catch {
            toast.error('Failed to update token');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                    <Coins className="w-8 h-8 text-amber-400" />
                    Token Whitelist
                </h1>
                <p className="text-gray-500 mt-1">Manage accepted payment tokens across chains</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {loading ? (
                    [...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white animate-pulse" />)
                ) : tokens.length === 0 ? (
                    <div className="col-span-full text-center py-16 rounded-2xl bg-white border border-gray-100">
                        <Coins className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No tokens configured</p>
                    </div>
                ) : (
                    tokens.map((token, idx) => (
                        <motion.div
                            key={token.token_id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`rounded-2xl border p-5 transition-all ${token.is_active
                                    ? 'bg-white border-gray-100 hover:border-gray-200'
                                    : 'bg-white/40 border-gray-100 opacity-60'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${token.is_active ? 'bg-amber-400/15 text-amber-400' : 'bg-gray-500/15 text-gray-500'
                                        }`}>
                                        {token.symbol?.[0] || '?'}
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-gray-900">{token.symbol}</div>
                                        <div className="text-xs text-gray-500">{chainNames[token.chain_id] || `Chain ${token.chain_id}`}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggle(token.token_id, token.is_active)}
                                    className="transition-colors"
                                >
                                    {token.is_active ? (
                                        <ToggleRight className="w-8 h-8 text-green-400" />
                                    ) : (
                                        <ToggleLeft className="w-8 h-8 text-gray-500" />
                                    )}
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-500">Address:</span>
                                    <code className="text-blue-400 font-mono truncate">{token.token_address}</code>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Chain: {token.chain_id}</span>
                                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Decimals: {token.decimals}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs mt-2">
                                    <span className={`px-2 py-0.5 rounded-full ${token.is_active ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'}`}>
                                        {token.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className="text-gray-600">ID: {token.token_id}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
