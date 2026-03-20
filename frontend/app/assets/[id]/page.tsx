'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    FileText, Shield, Percent, Users, Coins, ArrowLeft,
    DollarSign, Wallet, Loader2, CheckCircle2, ExternalLink,
    Building, TrendingUp, Info, Lock,
} from 'lucide-react';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi, parseUnits } from 'viem';
import { useSession } from 'next-auth/react';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';
import type { RWAAsset } from '../page';

const TYPE_COLOR: Record<string, string> = {
    REAL_ESTATE: 'text-blue-400', BOND: 'text-amber-400', EQUITY: 'text-emerald-400', COMMODITY: 'text-orange-400',
};

const MINT_ABI = parseAbi([
    'function mint(address to, uint256 amount) external',
    'function tokensAvailable() view returns (uint256)',
    'function pricePerTokenUSD() view returns (uint256)',
]);

export default function AssetDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data: session } = useSession();
    const { address, isConnected } = useAccount();

    const [asset, setAsset] = useState<RWAAsset | null>(null);
    const [loading, setLoading] = useState(true);
    const [kycStatus, setKycStatus] = useState<boolean>(false);
    const [investAmount, setInvestAmount] = useState('1');
    const [purchasing, setPurchasing] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [distributions, setDistributions] = useState<any[]>([]);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            rwaApi.assets.get(id as string).then(r => setAsset(r.data.asset)).catch(() => { }),
            rwaApi.profit.stats(id as string).then(r => setStats(r.data.stats)).catch(() => { }),
            rwaApi.profit.history(id as string).then(r => setDistributions(r.data.distributions || [])).catch(() => { }),
        ]).finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        if (!address) return;
        rwaApi.kyc.status(address).then(r => setKycStatus(r.data.verified)).catch(() => { });
    }, [address]);

    const tokenAmount = parseInt(investAmount) || 0;
    const totalCostUsd = asset ? tokenAmount * Number(asset.price_per_token_usd) : 0;

    const handlePurchase = async () => {
        if (!isConnected || !address) return toast.error('Connect wallet first');
        if (!kycStatus) return toast.error('KYC verification required to invest');
        if (!asset || tokenAmount <= 0) return;
        setPurchasing(true);
        try {
            // In a real flow: MetaMask pays USDC → backend mints tokens
            // For demo/FYP: admin-mints directly after payment confirmation
            await rwaApi.portfolio.purchase({
                asset_id: asset.asset_id, user_id: (session as any)?.user?.id,
                wallet_address: address, token_amount: tokenAmount, cost_usd: totalCostUsd,
            });
            toast.success(`Successfully invested in ${tokenAmount} ${asset.symbol} tokens! 🎉`);
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Investment failed');
        } finally { setPurchasing(false); }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#f0b90b]" />
        </div>
    );

    if (!asset) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <p className="text-xl font-bold">Asset not found</p>
            <Link href="/assets" className="text-[#f0b90b] hover:underline">← Back to Marketplace</Link>
        </div>
    );

    const progress = (asset.tokens_sold / asset.total_tokens) * 100;

    return (
        <div className="min-h-screen bg-background">
            {/* Back */}
            <div className="border-b border-border py-4 px-4 sm:px-8 max-w-6xl mx-auto">
                <Link href="/assets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Marketplace
                </Link>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── Left: Asset Info ─────────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-6">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-xs font-bold uppercase ${TYPE_COLOR[asset.asset_type]}`}>{asset.asset_type.replace('_', ' ')}</span>
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{asset.symbol}</span>
                        </div>
                        <h1 className="text-3xl font-black">{asset.name}</h1>
                        {asset.location && <p className="text-muted-foreground mt-1">📍 {asset.location}</p>}
                    </motion.div>

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Total Valuation', value: `$${Number(asset.total_valuation_usd).toLocaleString()}`, icon: <DollarSign className="w-4 h-4" /> },
                            { label: 'Token Price', value: `$${Number(asset.price_per_token_usd)}`, icon: <Coins className="w-4 h-4" />, gold: true },
                            { label: 'Expected APY', value: asset.expected_apy ? `${Number(asset.expected_apy).toFixed(1)}%` : 'N/A', icon: <Percent className="w-4 h-4" />, green: true },
                            { label: 'Holders', value: String(asset.holder_count ?? '—'), icon: <Users className="w-4 h-4" /> },
                        ].map(m => (
                            <div key={m.label} className="bg-card border border-border rounded-xl p-4">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">{m.icon}{m.label}</div>
                                <p className={`text-lg font-black ${m.gold ? 'text-[#f0b90b]' : m.green ? 'text-emerald-400' : ''}`}>{m.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Progress */}
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                        <div className="flex justify-between text-sm font-semibold">
                            <span>Funding Progress</span><span>{progress.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <motion.div className="h-full bg-gradient-to-r from-[#f0b90b] to-[#f0b90b]/60 rounded-full"
                                initial={{ width: 0 }} animate={{ width: `${Math.min(progress, 100)}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{asset.tokens_sold.toLocaleString()} sold</span>
                            <span>{(asset.total_tokens - asset.tokens_sold).toLocaleString()} remaining of {asset.total_tokens.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Description */}
                    {asset.description && (
                        <div className="bg-card border border-border rounded-2xl p-5">
                            <h2 className="font-bold mb-2 text-sm text-muted-foreground uppercase tracking-wider">About This Asset</h2>
                            <p className="text-sm leading-relaxed">{asset.description}</p>
                        </div>
                    )}

                    {/* Legal doc */}
                    {asset.legal_doc_ipfs && (
                        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl text-sm">
                            <Shield className="w-5 h-5 text-[#f0b90b] flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold">Legal Documentation</p>
                                <p className="text-xs text-muted-foreground">Verified on IPFS</p>
                            </div>
                            <a href={`https://ipfs.io/ipfs/${asset.legal_doc_ipfs}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[#f0b90b] hover:underline text-xs">
                                View <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    )}

                    {/* Distribution history */}
                    {distributions.length > 0 && (
                        <div className="bg-card border border-border rounded-2xl p-5">
                            <h2 className="font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Profit Distribution History</h2>
                            <div className="space-y-2">
                                {distributions.slice(0, 5).map((d, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
                                        <span className="text-muted-foreground">{d.period_description || 'Distribution'}</span>
                                        <span className="font-bold text-emerald-400">{Number(d.amount_eth).toFixed(6)} ETH</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right: Invest Panel ──────────────────────────────────── */}
                <div className="space-y-4">
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                        className="bg-card border border-border rounded-2xl p-6 sticky top-6">
                        <h2 className="font-black text-lg mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-[#f0b90b]" /> Invest Now
                        </h2>

                        {/* Token amount */}
                        <div className="space-y-3">
                            <label className="text-xs text-muted-foreground uppercase tracking-wider">Number of Tokens</label>
                            <div className="flex items-center border border-border rounded-xl overflow-hidden">
                                <button onClick={() => setInvestAmount(String(Math.max(1, tokenAmount - 1)))}
                                    className="px-4 py-3 bg-muted hover:bg-muted/70 font-bold text-lg transition-colors">−</button>
                                <input type="number" value={investAmount} onChange={e => setInvestAmount(e.target.value)}
                                    min={1} className="flex-1 text-center bg-transparent py-3 font-bold text-lg focus:outline-none" />
                                <button onClick={() => setInvestAmount(String(tokenAmount + 1))}
                                    className="px-4 py-3 bg-muted hover:bg-muted/70 font-bold text-lg transition-colors">+</button>
                            </div>
                        </div>

                        {/* Cost */}
                        <div className="bg-muted/50 rounded-xl p-4 space-y-2 mt-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Price per token</span>
                                <span className="font-semibold">${Number(asset.price_per_token_usd)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tokens</span>
                                <span className="font-semibold">× {tokenAmount}</span>
                            </div>
                            <div className="border-t border-border pt-2 flex justify-between">
                                <span className="font-bold">Total Cost</span>
                                <span className="font-black text-[#f0b90b] text-lg">${totalCostUsd.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* KYC / Wallet status */}
                        {!isConnected ? (
                            <div className="mt-4 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 flex gap-2">
                                <Wallet className="w-4 h-4 flex-shrink-0 mt-0.5" /> Connect wallet to invest
                            </div>
                        ) : !kycStatus ? (
                            <div className="mt-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3 flex gap-2">
                                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" /> KYC verification required. Contact admin.
                            </div>
                        ) : (
                            <div className="mt-4 text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 flex gap-2">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> KYC verified — ready to invest
                            </div>
                        )}

                        <button onClick={handlePurchase}
                            disabled={purchasing || !isConnected || !kycStatus || tokenAmount <= 0}
                            className="mt-4 w-full py-3.5 bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-black font-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {purchasing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Coins className="w-5 h-5" />}
                            {purchasing ? 'Processing...' : `Invest $${totalCostUsd.toLocaleString()}`}
                        </button>

                        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-start gap-2"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Tokens issued on-chain after payment confirmation</div>
                            <div className="flex items-start gap-2"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Profit distributed automatically to token holders</div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
