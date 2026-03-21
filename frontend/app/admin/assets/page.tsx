'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Building, Plus, Loader2, CheckCircle2, AlertCircle,
    DollarSign, Coins, Gift, Users, Shield, RefreshCw, X,
    TrendingUp, Leaf,
} from 'lucide-react';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface RWAAsset {
    asset_id: string; name: string; symbol: string; asset_type: string;
    total_valuation_usd: number; price_per_token_usd: number;
    total_tokens: number; tokens_sold: number;
    token_contract_address: string; distributor_contract_address: string;
    expected_apy: number | null; status: string;
}

interface CreateAssetForm {
    name: string; symbol: string; asset_type: string;
    description: string; location: string;
    total_valuation_usd: string; price_per_token_usd: string;
    legal_doc_ipfs: string; expected_apy: string;
}

/* ─── Status badge ──────────────────────────────────────────────────────── */
function StatusBadge({ s }: { s: string }) {
    const colors: Record<string, string> = {
        ACTIVE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        PENDING: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        FAILED: 'text-red-400 bg-red-400/10 border-red-400/20',
        CLOSED: 'text-muted-foreground bg-muted border-border',
    };
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[s] || colors.CLOSED}`}>{s}</span>;
}

/* ─── KYC Grant Modal ────────────────────────────────────────────────────── */
function KYCModal({ onClose }: { onClose: () => void }) {
    const [wallet, setWallet] = useState('');
    const [loading, setLoading] = useState(false);
    const handleGrant = async () => {
        if (!wallet) return;
        setLoading(true);
        try {
            await rwaApi.kyc.grant(wallet, undefined, 'VN');
            toast.success(`KYC granted to ${wallet.slice(0, 10)}...`);
            setWallet(''); onClose();
        } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
        finally { setLoading(false); }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-[#f0b90b]" /> Grant KYC</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <input placeholder="Wallet address (0x...)" value={wallet} onChange={e => setWallet(e.target.value)}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-mono focus:outline-none focus:border-[#f0b90b]/50 mb-4" />
                <button onClick={handleGrant} disabled={loading || !wallet}
                    className="w-full py-3 bg-[#f0b90b] text-black font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Verify & Whitelist On-Chain
                </button>
            </div>
        </div>
    );
}

/* ─── Create Asset Modal ─────────────────────────────────────────────────── */
function CreateAssetModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: any) => void }) {
    const [form, setForm] = useState<CreateAssetForm>({
        name: '', symbol: '', asset_type: 'REAL_ESTATE', description: '',
        location: '', total_valuation_usd: '', price_per_token_usd: '',
        legal_doc_ipfs: '', expected_apy: '',
    });
    const [loading, setLoading] = useState(false);

    const totalTokens = form.total_valuation_usd && form.price_per_token_usd
        ? Math.floor(Number(form.total_valuation_usd) / Number(form.price_per_token_usd)) : 0;

    const handleCreate = async () => {
        if (!form.name || !form.symbol || !form.total_valuation_usd || !form.price_per_token_usd) {
            return toast.error('Fill required fields');
        }
        setLoading(true);
        try {
            const res = await rwaApi.assets.create({ ...form, total_valuation_usd: Number(form.total_valuation_usd), price_per_token_usd: Number(form.price_per_token_usd), expected_apy: form.expected_apy ? Number(form.expected_apy) : null });
            toast.success('Asset created & deployed on-chain! 🎉');
            onCreated(res.data);
            onClose();
        } catch (e: any) { toast.error(e.response?.data?.error || 'Creation failed'); }
        finally { setLoading(false); }
    };

    const inputClass = "w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-[#f0b90b]/50";
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl my-4">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Plus className="w-5 h-5 text-[#f0b90b]" /> Create RWA Asset</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="space-y-3">
                    {/* Asset type */}
                    <div className="grid grid-cols-4 gap-2">
                        {['REAL_ESTATE', 'BOND', 'EQUITY', 'COMMODITY'].map(t => (
                            <button key={t} onClick={() => setForm(f => ({ ...f, asset_type: t }))}
                                className={`py-2 text-[10px] font-bold rounded-xl border transition-all ${form.asset_type === t ? 'bg-[#f0b90b]/15 border-[#f0b90b]/40 text-[#f0b90b]' : 'bg-muted border-border'}`}>
                                {t.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Asset name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                        <input placeholder="Symbol * (e.g. HCMT-01)" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} className={`${inputClass} font-mono`} />
                    </div>
                    <input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputClass} />
                    <textarea placeholder="Description" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputClass} resize-none`} />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative"><DollarSign className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                            <input type="number" placeholder="Total valuation USD *" value={form.total_valuation_usd} onChange={e => setForm(f => ({ ...f, total_valuation_usd: e.target.value }))} className={`${inputClass} pl-9`} /></div>
                        <div className="relative"><DollarSign className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                            <input type="number" placeholder="Price per token USD *" value={form.price_per_token_usd} onChange={e => setForm(f => ({ ...f, price_per_token_usd: e.target.value }))} className={`${inputClass} pl-9`} /></div>
                    </div>
                    {totalTokens > 0 && <p className="text-xs text-muted-foreground">→ {totalTokens.toLocaleString()} tokens will be issued</p>}
                    <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Legal doc IPFS CID" value={form.legal_doc_ipfs} onChange={e => setForm(f => ({ ...f, legal_doc_ipfs: e.target.value }))} className={inputClass} />
                        <div className="relative"><span className="text-muted-foreground absolute right-3 top-3 text-xs">%</span>
                            <input type="number" placeholder="Expected APY" value={form.expected_apy} onChange={e => setForm(f => ({ ...f, expected_apy: e.target.value }))} className={inputClass} /></div>
                    </div>
                </div>
                <button onClick={handleCreate} disabled={loading}
                    className="mt-5 w-full py-3 bg-[#f0b90b] text-black font-black rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Deploying on-chain...</> : <><Coins className="w-4 h-4" /> Create & Deploy Asset</>}
                </button>
            </div>
        </div>
    );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function AdminAssetsPage() {
    const [assets, setAssets] = useState<RWAAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showKYC, setShowKYC] = useState(false);
    const [depositingId, setDepositingId] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const res = await rwaApi.assets.list();
                setAssets(res.data.assets || []);
            } catch { } finally { setLoading(false); }
        };
        fetchAll();
    }, []);

    const handleStatusChange = async (assetId: string, newStatus: string) => {
        try {
            await rwaApi.assets.updateStatus(assetId, newStatus);
            setAssets(prev => prev.map(a => a.asset_id === assetId ? { ...a, status: newStatus } : a));
            toast.success(`Status updated to ${newStatus}`);
        } catch (e: any) { toast.error(e.response?.data?.error || 'Update failed'); }
    };

    const nextStatus: Record<string, string> = {
        PENDING: 'ACTIVE', ACTIVE: 'CLOSED', CLOSED: 'ACTIVE',
    };

    const handleDepositProfit = async (asset: RWAAsset) => {
        const amount = depositAmount[asset.asset_id];
        if (!amount || parseFloat(amount) <= 0) return toast.error('Enter ETH amount');
        setDepositingId(asset.asset_id);
        try {
            await rwaApi.profit.deposit(asset.asset_id, amount, `Monthly profit - ${asset.name}`);
            toast.success(`${amount} ETH profit deposited for ${asset.symbol}! ✅`);
            setDepositAmount(p => ({ ...p, [asset.asset_id]: '' }));
        } catch (e: any) { toast.error(e.response?.data?.error || 'Deposit failed'); }
        finally { setDepositingId(null); }
    };

    return (
        <div className="min-h-screen bg-background">
            {showCreate && <CreateAssetModal onClose={() => setShowCreate(false)} onCreated={a => setAssets(p => [a, ...p])} />}
            {showKYC && <KYCModal onClose={() => setShowKYC(false)} />}

            {/* Header */}
            <div className="border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2"><Building className="w-6 h-6 text-[#f0b90b]" /> RWA Asset Management</h1>
                        <p className="text-muted-foreground text-sm mt-1">Create and manage tokenized real-world assets</p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button onClick={() => setShowKYC(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-bold hover:border-emerald-400/40 transition-colors">
                            <Shield className="w-4 h-4 text-emerald-400" /> Grant KYC
                        </button>
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#f0b90b] text-black rounded-xl text-sm font-black hover:bg-[#f0b90b]/90 transition-colors">
                            <Plus className="w-4 h-4" /> New Asset
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-4">
                {loading ? (
                    [...Array(2)].map((_, i) => <div key={i} className="h-36 bg-card border border-border rounded-2xl animate-pulse" />)
                ) : assets.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <Building className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="font-semibold">No assets yet</p>
                        <button onClick={() => setShowCreate(true)} className="mt-4 px-5 py-2.5 bg-[#f0b90b]/10 text-[#f0b90b] rounded-xl font-bold text-sm hover:bg-[#f0b90b]/20">Create First Asset</button>
                    </div>
                ) : (
                    assets.map((asset, i) => (
                        <motion.div key={asset.asset_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                            className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:border-[#f0b90b]/20 transition-colors">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-black">{asset.name}</p>
                                        <StatusBadge s={asset.status} />
                                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{asset.symbol}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{asset.asset_type.replace('_', ' ')} · Total value: ${Number(asset.total_valuation_usd).toLocaleString()}</p>
                                    {asset.token_contract_address && (
                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Token: {asset.token_contract_address.slice(0, 20)}...</p>
                                    )}
                                </div>
                                <div className="flex gap-4 text-sm items-start flex-wrap">
                                    <div><p className="text-muted-foreground text-xs">Sold</p><p className="font-bold">{asset.tokens_sold.toLocaleString()}</p></div>
                                    <div><p className="text-muted-foreground text-xs">Remaining</p><p className="font-bold">{(asset.total_tokens - asset.tokens_sold).toLocaleString()}</p></div>
                                    {asset.expected_apy && <div><p className="text-muted-foreground text-xs">APY</p><p className="font-bold text-emerald-400">{asset.expected_apy}%</p></div>}
                                    <button
                                        onClick={() => handleStatusChange(asset.asset_id, nextStatus[asset.status] || 'ACTIVE')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border rounded-lg text-xs font-bold transition-all ml-2"
                                        title={`Set to ${nextStatus[asset.status]}`}
                                    >
                                        → {nextStatus[asset.status] || 'ACTIVE'}
                                    </button>
                                </div>
                            </div>

                            {/* Deposit profit */}
                            {asset.status === 'ACTIVE' && asset.distributor_contract_address && (
                                <div className="border-t border-border pt-4 flex items-center gap-3 flex-wrap">
                                    <Gift className="w-4 h-4 text-[#f0b90b] flex-shrink-0" />
                                    <span className="text-sm font-semibold flex-1">Deposit Profit (ETH)</span>
                                    <input type="number" placeholder="0.5" step="0.01" min="0"
                                        value={depositAmount[asset.asset_id] || ''}
                                        onChange={e => setDepositAmount(p => ({ ...p, [asset.asset_id]: e.target.value }))}
                                        className="w-28 px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-[#f0b90b]/50" />
                                    <button onClick={() => handleDepositProfit(asset)}
                                        disabled={depositingId === asset.asset_id}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/20 rounded-xl text-sm font-bold transition-all disabled:opacity-40">
                                        {depositingId === asset.asset_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                                        Distribute
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
