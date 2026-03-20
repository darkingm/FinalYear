'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Wallet, TrendingUp, Gift, RefreshCw, Loader2,
    Building, Coins, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi } from 'viem';
import { useSession } from 'next-auth/react';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';
import Link from 'next/link';

const DISTRIBUTOR_ABI = parseAbi([
    'function claimReward() external',
    'function pendingReward(address investor) view returns (uint256)',
]);

const TYPE_ICON: Record<string, string> = {
    REAL_ESTATE: '🏢', BOND: '📈', EQUITY: '💎', COMMODITY: '🌾',
};

export default function PortfolioPage() {
    const { data: session } = useSession();
    const { address, isConnected } = useAccount();
    const { writeContract, data: txHash, isPending } = useWriteContract();
    const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

    const [holdings, setHoldings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingAsset, setClaimingAsset] = useState<string | null>(null);
    const [pendingRewards, setPendingRewards] = useState<Record<string, string>>({});

    const userId = (session as any)?.user?.id;

    useEffect(() => {
        if (!userId) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await rwaApi.portfolio.get(userId);
                setHoldings(res.data.holdings || []);
            } catch { setHoldings([]); }
            finally { setLoading(false); }
        };
        fetch();
    }, [userId]);

    // Fetch pending rewards for each holding
    useEffect(() => {
        if (!address || holdings.length === 0) return;
        holdings.forEach(async (h) => {
            try {
                const res = await rwaApi.profit.pending(h.asset_id, address);
                setPendingRewards(prev => ({ ...prev, [h.asset_id]: res.data.pending_eth || '0' }));
            } catch { }
        });
    }, [address, holdings]);

    useEffect(() => {
        if (txConfirmed) {
            toast.success('Reward claimed successfully! ✅');
            setClaimingAsset(null);
        }
    }, [txConfirmed]);

    const handleClaim = (distributorAddress: string, assetId: string) => {
        if (!isConnected) return toast.error('Connect wallet first');
        setClaimingAsset(assetId);
        writeContract({
            address: distributorAddress as `0x${string}`,
            abi: DISTRIBUTOR_ABI,
            functionName: 'claimReward',
        });
    };

    // Totals
    const totalValueUsd = holdings.reduce((s, h) => s + Number(h.current_value_usd || 0), 0);
    const totalPendingEth = Object.values(pendingRewards).reduce((s, v) => s + parseFloat(v || '0'), 0);

    return (
        <div className="min-h-screen bg-background">
            {/* Hero */}
            <div className="border-b border-border bg-gradient-to-br from-background via-violet-500/5 to-background">
                <div className="max-w-4xl mx-auto px-4 sm:px-8 py-14">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h1 className="text-3xl font-black flex items-center gap-3">
                            <TrendingUp className="w-8 h-8 text-[#f0b90b]" /> My Portfolio
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Your fractional RWA token holdings and pending dividends.
                        </p>
                    </motion.div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                        {[
                            { label: 'Portfolio Value', value: `$${totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <Coins className="w-5 h-5" />, color: 'text-[#f0b90b]' },
                            { label: 'Holdings', value: holdings.length.toString(), icon: <Building className="w-5 h-5" />, color: 'text-blue-400' },
                            { label: 'Unclaimed Rewards', value: `${totalPendingEth.toFixed(6)} ETH`, icon: <Gift className="w-5 h-5" />, color: 'text-emerald-400' },
                        ].map(c => (
                            <div key={c.label} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
                                <div className={`p-2.5 rounded-xl bg-current/10 ${c.color}`}>{c.icon}</div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
                                    <p className={`text-xl font-black mt-0.5 ${c.color}`}>{c.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-4">
                {!isConnected && (
                    <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-sm text-amber-400">
                        <Wallet className="w-5 h-5 flex-shrink-0" />
                        Connect your wallet to see pending rewards and claim dividends.
                    </div>
                )}

                {loading ? (
                    [...Array(2)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-2xl animate-pulse" />)
                ) : holdings.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <Building className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-semibold">No holdings yet</p>
                        <Link href="/assets" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#f0b90b]/10 text-[#f0b90b] rounded-xl font-bold text-sm hover:bg-[#f0b90b]/20 transition-colors">
                            Browse Assets <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    holdings.map((h, i) => {
                        const pending = pendingRewards[h.asset_id];
                        const isClaiming = claimingAsset === h.asset_id;
                        return (
                            <motion.div key={h.asset_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                className="bg-card border border-border rounded-2xl p-5 flex items-center gap-5 flex-wrap hover:border-[#f0b90b]/30 transition-colors">
                                <div className="text-3xl">{TYPE_ICON[h.asset_type] || '💼'}</div>
                                <div className="flex-1 min-w-[200px]">
                                    <p className="font-bold">{h.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{h.asset_type} · {h.tokens_held.toLocaleString()} tokens</p>
                                    <div className="flex gap-3 mt-2 text-xs">
                                        <span className="text-muted-foreground">Cost: <strong className="text-foreground">${(h.avg_cost_usd * h.tokens_held).toLocaleString()}</strong></span>
                                        <span className="text-muted-foreground">Value: <strong className="text-[#f0b90b]">${Number(h.current_value_usd).toLocaleString()}</strong></span>
                                        {h.expected_apy && <span className="text-emerald-400 font-bold">APY {h.expected_apy}%</span>}
                                    </div>
                                </div>
                                {/* Reward claim */}
                                <div className="text-right">
                                    {pending && parseFloat(pending) > 0 ? (
                                        <>
                                            <p className="text-xs text-muted-foreground">Pending reward</p>
                                            <p className="text-emerald-400 font-black">{parseFloat(pending).toFixed(6)} ETH</p>
                                            <button
                                                onClick={() => handleClaim(h.distributor_contract_address, h.asset_id)}
                                                disabled={isPending || isClaiming}
                                                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                            >
                                                {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3 h-3" />}
                                                Claim
                                            </button>
                                        </>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">No pending rewards</p>
                                    )}
                                </div>
                                <Link href={`/assets/${h.asset_id}`} className="text-muted-foreground hover:text-[#f0b90b] transition-colors">
                                    <ArrowUpRight className="w-5 h-5" />
                                </Link>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
