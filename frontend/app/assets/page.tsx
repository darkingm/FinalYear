'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building, TrendingUp, Coins, Leaf, Search, Filter, RefreshCw, Percent, Users, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { rwaApi } from '@/lib/api/rwa';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getDemoRwaAssets } from '@/lib/rwa/demo-assets';

/* ── Types ─────────────────────────────────────────────────────────────────── */
export interface RWAAsset {
    asset_id: string;
    name: string;
    symbol: string;
    asset_type: 'REAL_ESTATE' | 'BOND' | 'EQUITY' | 'COMMODITY';
    description: string;
    location: string;
    total_valuation_usd: number;
    price_per_token_usd: number;
    total_tokens: number;
    tokens_sold: number;
    token_contract_address: string;
    distributor_contract_address: string;
    legal_doc_ipfs: string;
    expected_apy: number | null;
    status: string;
    chain_id?: number;
    holder_count?: number;
    total_distributed_usd?: number;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    REAL_ESTATE: { icon: <Building className="w-5 h-5" />, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'Real Estate' },
    BOND: { icon: <TrendingUp className="w-5 h-5" />, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Bond' },
    EQUITY: { icon: <Coins className="w-5 h-5" />, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'Equity' },
    COMMODITY: { icon: <Leaf className="w-5 h-5" />, color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'Commodity' },
};

/* ── Asset Card ─────────────────────────────────────────────────────────────── */
function AssetCard({ asset }: { asset: RWAAsset }) {
    const meta = TYPE_META[asset.asset_type] || TYPE_META.EQUITY;
    const progress = (asset.tokens_sold / asset.total_tokens) * 100;
    const remaining = asset.total_tokens - asset.tokens_sold;

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl overflow-hidden hover:border-[#f0b90b]/40 transition-all group">
            {/* Top accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#f0b90b] to-[#f0b90b]/20" />

            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${meta.color}`}>
                                {meta.icon} {meta.label}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">{asset.symbol}</span>
                        </div>
                        <h3 className="font-black text-base leading-tight">{asset.name}</h3>
                        {asset.location && <p className="text-xs text-muted-foreground mt-0.5">📍 {asset.location}</p>}
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Token Price</p>
                        <p className="text-base font-black mt-0.5 text-[#f0b90b]">${Number(asset.price_per_token_usd).toLocaleString()}</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Value</p>
                        <p className="text-base font-black mt-0.5">${(Number(asset.total_valuation_usd) / 1e6).toLocaleString()}M</p>
                    </div>
                    {asset.expected_apy !== null && (
                        <div className="bg-muted/50 rounded-xl p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Percent className="w-3 h-3" /> Expected APY</p>
                            <p className="text-base font-black mt-0.5 text-emerald-400">{Number(asset.expected_apy).toFixed(1)}%</p>
                        </div>
                    )}
                    <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" /> Holders</p>
                        <p className="text-base font-black mt-0.5">{asset.holder_count ?? '—'}</p>
                    </div>
                </div>

                {/* Funding progress */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{asset.tokens_sold.toLocaleString()} sold</span>
                        <span className="font-bold">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-[#f0b90b] to-[#f0b90b]/70 rounded-full"
                            initial={{ width: 0 }} animate={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{remaining.toLocaleString()} tokens remaining</p>
                </div>

                {/* CTA */}
                <Link href={`/assets/${asset.asset_id}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] font-bold text-sm rounded-xl border border-[#f0b90b]/20 hover:border-[#f0b90b]/40 transition-all group-hover:shadow-lg group-hover:shadow-[#f0b90b]/10">
                    Invest Now <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </motion.div>
    );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */
export default function AssetsMarketplacePage() {
    const [assets, setAssets] = useState<RWAAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');

    useEffect(() => {
        const fetchAssets = async () => {
            setLoading(true);
            setError(false);
            try {
                const res = await rwaApi.assets.list();
                setAssets(res.data.assets || []);
            } catch {
                // Only use demo data when explicitly enabled via env var
                const demo = getDemoRwaAssets();
                if (demo.length > 0) {
                    setAssets(demo as RWAAsset[]);
                } else {
                    setError(true);
                }
            } finally { setLoading(false); }
        };
        fetchAssets();
    }, []);

    const filtered = assets.filter(a => {
        if (typeFilter !== 'ALL' && a.asset_type !== typeFilter) return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.symbol.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const totalAUM = assets.reduce((s, a) => s + Number(a.total_valuation_usd), 0);

    return (
        <div className="min-h-screen bg-background flex flex-col relative">
            <Header />
            {/* Hero */}
            <div className="border-b border-border bg-gradient-to-br from-background via-[#f0b90b]/5 to-background">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <span className="text-xs font-bold text-[#f0b90b] uppercase tracking-widest bg-[#f0b90b]/10 px-3 py-1 rounded-full border border-[#f0b90b]/20">
                            Real World Asset Marketplace
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black mt-4 mb-3 leading-tight">
                            Own a Piece of the<br />
                            <span className="text-[#f0b90b]">Real World</span>
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl">
                            Invest fractionally in verified real-world assets — real estate, bonds, equity.
                            Receive automatic on-chain profit distributions as a token holder.
                        </p>

                        <div className="flex gap-6 mt-8 flex-wrap">
                            <div>
                                <p className="text-2xl font-black">${(totalAUM / 1e6).toFixed(1)}M+</p>
                                <p className="text-xs text-muted-foreground">Total Assets Under Management</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black">{assets.length}</p>
                                <p className="text-xs text-muted-foreground">Active Asset Offerings</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black">
                                    {assets.filter(a =>
                                        a.token_contract_address &&
                                        a.token_contract_address !== '0x0000000000000000000000000000000000000000'
                                    ).length}/{assets.length}
                                </p>
                                <p className="text-xs text-muted-foreground">On-chain Deployed</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
                {/* Filters */}
                <div className="flex items-center gap-4 mb-8 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search assets, symbols..."
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-[#f0b90b]/50" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {['ALL', 'REAL_ESTATE', 'BOND', 'EQUITY', 'COMMODITY'].map(t => (
                            <button key={t} onClick={() => setTypeFilter(t)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${typeFilter === t ? 'bg-[#f0b90b]/15 border-[#f0b90b]/40 text-[#f0b90b]' : 'bg-card border-border hover:border-muted-foreground'}`}>
                                {t === 'ALL' ? 'All Types' : TYPE_META[t]?.label || t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => <div key={i} className="h-80 bg-card border border-border rounded-2xl animate-pulse" />)}
                    </div>
                ) : error ? (
                    <div className="text-center py-16">
                        <div className="inline-flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-2xl mb-4">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <div className="text-left">
                                <p className="font-bold text-sm">API Connection Failed</p>
                                <p className="text-xs text-red-400/70 mt-0.5">Unable to load assets from the server. The backend or RPC may be down.</p>
                            </div>
                        </div>
                        <br />
                        <button onClick={() => window.location.reload()}
                            className="mt-4 px-5 py-2.5 bg-card border border-border rounded-xl text-sm font-bold hover:border-[#f0b90b]/40 transition-colors">
                            Retry
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-24 text-muted-foreground">
                        <Building className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-semibold">No assets found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(asset => <AssetCard key={asset.asset_id} asset={asset} />)}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
}
