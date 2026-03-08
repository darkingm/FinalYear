'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Copy, Check, QrCode, ExternalLink, Clock, CheckCircle,
    AlertCircle, ChevronDown, Info, Wallet, RefreshCw, Shield,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://103.20.96.79:3001';

interface Chain {
    chain_id: number; name: string; type: string; symbol: string;
    explorer: string; deposit_address: string | null;
}

interface Token {
    token_id: number; symbol: string; token_address: string;
    decimals: number; chain_id: number; metadata: any; is_active: boolean;
}

interface Deposit {
    deposit_id: number; amount: string; tx_hash: string; status: string;
    created_at: string; credited_at: string; chain_id: number;
    chain_name: string; symbol: string; from_address: string;
}

const CHAIN_ICONS: Record<string, string> = {
    Ethereum: '🔷', 'BNB Smart Chain': '🟡', Polygon: '🟣',
    'Arbitrum One': '🔵', Optimism: '🔴', Base: '🔵',
    Solana: '🟢', TRON: '🔴', TON: '💎', Aptos: '⚫',
};
const CHAIN_GRADIENTS: Record<string, string> = {
    Ethereum: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
    'BNB Smart Chain': 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/20',
    Polygon: 'from-purple-600/20 to-purple-600/5 border-purple-500/20',
    'Arbitrum One': 'from-cyan-600/20 to-cyan-600/5 border-cyan-500/20',
    Solana: 'from-green-600/20 to-green-600/5 border-green-500/20',
    TRON: 'from-red-600/20 to-red-600/5 border-red-500/20',
    TON: 'from-sky-600/20 to-sky-600/5 border-sky-500/20',
    Aptos: 'from-slate-600/20 to-slate-600/5 border-slate-500/20',
};

export default function WalletDepositPage() {
    const router = useRouter();
    const [chains, setChains] = useState<Chain[]>([]);
    const [tokens, setTokens] = useState<Token[]>([]);
    const [history, setHistory] = useState<Deposit[]>([]);
    const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [loadingTokens, setLoadingTokens] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (!token) { router.push('/login'); return; }

        Promise.all([
            fetch(`${API}/api/wallets/deposit-addresses`).then(r => r.json()),
            fetch(`${API}/api/wallets/deposits`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([chainsData, historyData]) => {
            if (chainsData.success) {
                const validChains = chainsData.data.filter((c: Chain) => !!c.deposit_address);
                setChains(chainsData.data);
                if (validChains.length > 0) setSelectedChain(validChains[0]);
            }
            if (historyData.success) setHistory(historyData.data);
        }).finally(() => setLoading(false));
    }, [router]);

    useEffect(() => {
        if (!selectedChain) return;
        setLoadingTokens(true);
        setSelectedToken(null);
        fetch(`${API}/api/wallets/chains/${selectedChain.chain_id}/tokens`)
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    setTokens(d.data);
                    // Auto-select USDT if available
                    const usdt = d.data.find((t: Token) => t.symbol === 'USDT');
                    setSelectedToken(usdt || d.data[0] || null);
                }
            }).finally(() => setLoadingTokens(false));
    }, [selectedChain]);

    const copyAddress = async () => {
        if (!selectedChain?.deposit_address) return;
        await navigator.clipboard.writeText(selectedChain.deposit_address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
        pending: { color: 'text-amber-400', label: 'Pending', icon: Clock },
        confirming: { color: 'text-blue-400', label: 'Confirming', icon: RefreshCw },
        confirmed: { color: 'text-green-400', label: 'Confirmed', icon: CheckCircle },
        failed: { color: 'text-red-400', label: 'Failed', icon: AlertCircle },
    };

    const truncate = (s: string, n = 10) => s ? `${s.slice(0, n)}...${s.slice(-6)}` : '—';

    if (loading) return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Wallet className="w-7 h-7 text-violet-400" />
                        Deposit Crypto
                    </h1>
                    <p className="text-white/50 mt-1 text-sm">Choose a network and send crypto to the platform deposit address below.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left: Network + Token selector */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Select Network</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {chains.map(chain => (
                                <button
                                    key={chain.chain_id}
                                    onClick={() => setSelectedChain(chain)}
                                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left
                    ${selectedChain?.chain_id === chain.chain_id
                                            ? `bg-gradient-to-r ${CHAIN_GRADIENTS[chain.name] || 'from-violet-600/20 to-violet-600/5 border-violet-500/20'} border-violet-500/30`
                                            : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15'}`}
                                >
                                    <span className="text-2xl flex-shrink-0">{CHAIN_ICONS[chain.name] || '⛓️'}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm">{chain.name}</p>
                                        <p className="text-xs text-white/40">{chain.symbol}</p>
                                    </div>
                                    {!chain.deposit_address && (
                                        <span className="text-xs text-white/25 flex-shrink-0">Coming soon</span>
                                    )}
                                    {selectedChain?.chain_id === chain.chain_id && (
                                        <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Deposit address + QR */}
                    <div className="lg:col-span-3 space-y-5">
                        {selectedChain ? (
                            <>
                                {/* Token selector */}
                                {tokens.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Select Token</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {tokens.map(tk => (
                                                <button
                                                    key={tk.token_id}
                                                    onClick={() => setSelectedToken(tk)}
                                                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                            ${selectedToken?.token_id === tk.token_id
                                                            ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                                                            : 'bg-white/5 border-white/10 text-white/60 hover:border-white/25'}`}
                                                >
                                                    {tk.symbol}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* QR + Address card */}
                                {selectedChain.deposit_address ? (
                                    <div className={`p-6 rounded-2xl bg-gradient-to-br ${CHAIN_GRADIENTS[selectedChain.name] || 'from-violet-500/10 to-violet-500/3 border-violet-500/20'} border space-y-5`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">{CHAIN_ICONS[selectedChain.name] || '⛓️'}</span>
                                                <div>
                                                    <p className="font-bold">{selectedChain.name}</p>
                                                    <p className="text-xs text-white/50">{selectedToken?.symbol || 'All tokens'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 border border-green-500/25">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                <span className="text-xs text-green-300 font-medium">Active</span>
                                            </div>
                                        </div>

                                        {/* QR Placeholder */}
                                        <div className="flex justify-center">
                                            <div className="w-36 h-36 rounded-xl bg-white p-3 flex items-center justify-center">
                                                <QrCode className="w-full h-full text-black/80" />
                                                {/* In production, render actual QR via qrcode library */}
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div className="space-y-2">
                                            <p className="text-xs text-white/40">Deposit Address</p>
                                            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-black/30 border border-white/10">
                                                <span className="font-mono text-sm text-white/80 flex-1 break-all leading-relaxed">
                                                    {selectedChain.deposit_address}
                                                </span>
                                                <button
                                                    onClick={copyAddress}
                                                    className="flex-shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                    title="Copy address"
                                                >
                                                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/50" />}
                                                </button>
                                            </div>
                                            {copied && (
                                                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-green-400 pl-1">
                                                    ✓ Address copied!
                                                </motion.p>
                                            )}
                                        </div>

                                        {/* Warnings */}
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                                                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-amber-300/80">
                                                    Only send <strong>{selectedToken?.symbol || 'compatible tokens'}</strong> on the <strong>{selectedChain.name}</strong> network. Sending wrong tokens or network may result in permanent loss.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/8">
                                                <Shield className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                                <p className="text-xs text-white/50">Minimum: 1 USDT equivalent. Credits after 1–12 confirmations.</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 rounded-2xl bg-white/3 border border-white/8 text-center text-white/30">
                                        <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p>Deposit address for {selectedChain.name} coming soon.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-10 rounded-2xl bg-white/3 border border-white/8 text-center text-white/30">
                                <Info className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Select a network on the left to see deposit address.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Deposit History */}
                <div className="mt-10 space-y-4">
                    <h3 className="font-semibold text-white/80 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-violet-400" />Deposit History
                    </h3>

                    {history.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-white/3 border border-white/8 text-center text-white/30">
                            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>No deposits yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-white/8">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/8 text-xs text-white/40 uppercase tracking-wider">
                                        {['Time', 'Token', 'Amount', 'Network', 'Tx Hash', 'Status'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {history.map(dep => {
                                        const meta = STATUS_META[dep.status] || { color: 'text-white/40', label: dep.status, icon: Clock };
                                        const Icon = meta.icon;
                                        return (
                                            <tr key={dep.deposit_id} className="hover:bg-white/3 transition-colors">
                                                <td className="px-4 py-3 text-sm text-white/50 whitespace-nowrap">
                                                    {new Date(dep.created_at).toLocaleDateString()} {new Date(dep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold">{dep.symbol}</td>
                                                <td className="px-4 py-3 text-sm font-mono text-green-300">+{parseFloat(dep.amount).toFixed(6)}</td>
                                                <td className="px-4 py-3 text-sm text-white/60">{dep.chain_name || dep.chain_id}</td>
                                                <td className="px-4 py-3">
                                                    {dep.tx_hash ? (
                                                        <span className="font-mono text-xs text-white/50">{truncate(dep.tx_hash, 8)}</span>
                                                    ) : <span className="text-white/25 text-xs">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
                                                        <Icon className="w-3.5 h-3.5" />{meta.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
