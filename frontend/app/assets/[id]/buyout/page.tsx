'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Gavel, ChevronLeft, Loader2, Clock, CheckCircle, AlertCircle,
    Wallet, Shield, ArrowRight,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const STATUS_STYLE: Record<string, string> = {
    PROPOSED: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    DEPOSITED: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    FINALIZED: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
    SETTLED: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    CANCELLED: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
};

export default function BuyoutPage() {
    const { id: assetId } = useParams<{ id: string }>();
    const { address, isConnected } = useAccount();

    const [buyouts, setBuyouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [asset, setAsset] = useState<any>(null);
    const [selectedBuyout, setSelectedBuyout] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);

    const fetchData = useCallback(() => {
        if (!assetId) return;
        setLoading(true);
        Promise.all([
            rwaApi.buyout.list(assetId).then(r => setBuyouts(r.data.buyouts || [])),
            rwaApi.assets.get(assetId).then(r => setAsset(r.data.asset)),
        ]).catch(() => {}).finally(() => setLoading(false));
    }, [assetId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const loadDetail = async (buyoutId: number) => {
        try {
            const r = await rwaApi.buyout.detail(buyoutId);
            setDetail(r.data);
            setSelectedBuyout(buyoutId);
        } catch (err: any) {
            toast.error('Failed to load buyout detail');
        }
    };

    const handleClaim = async (buyoutId: number) => {
        if (!address) return toast.error('Connect wallet first');
        if (!detail?.buyout) return toast.error('Load buyout detail first');

        const buyout = detail.buyout;
        // TODO: In production, token_balance should come from Merkle proof snapshot.
        // For now, query on-chain token balance or use portfolio data.
        // We need at least the user's token balance to compute their claim amount.
        try {
            // Fetch user's holdings from the holders API
            const holdersRes = await rwaApi.holders.list(assetId!, 100);
            const holders = holdersRes.data.holders || [];
            // Match by address prefix since public API masks the full address
            const myHolding = holders.find((h: any) =>
                address.toLowerCase().startsWith(h.wallet_address?.substring(0, 6).toLowerCase())
            );

            if (!myHolding || Number(myHolding.tokens_held) <= 0) {
                return toast.error('You do not hold any tokens for this asset');
            }

            const tokenBalance = Number(myHolding.tokens_held);
            // Pro-rata: (user_tokens / total_tokens) * total_price_wei
            const totalTokens = Number(buyout.total_tokens) || 1;
            const totalPriceWei = BigInt(buyout.total_price_wei || '0');
            const claimAmountWei = (totalPriceWei * BigInt(tokenBalance) / BigInt(totalTokens)).toString();

            if (BigInt(claimAmountWei) <= 0n) {
                return toast.error('Computed claim amount is zero — nothing to claim');
            }

            await rwaApi.buyout.claim(buyoutId, {
                holder_address: address,
                token_balance: tokenBalance,
                amount_wei: claimAmountWei,
            });
            toast.success('Claim submitted! 🎉');
            loadDetail(buyoutId);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Claim failed');
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1">
                {/* Header */}
                <div className="border-b border-border bg-gradient-to-br from-background via-red-500/5 to-background">
                    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
                        <Link href={`/assets/${assetId}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
                            <ChevronLeft className="w-3 h-3" /> Back to Asset
                        </Link>
                        <h1 className="text-2xl font-black flex items-center gap-3">
                            <Gavel className="w-7 h-7 text-red-400" /> Buyout
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {asset?.name || 'Loading...'} — Asset buyout proposals & claims
                        </p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
                    {/* Info banner */}
                    <div className="bg-red-400/5 border border-red-400/10 rounded-2xl p-5 text-sm text-muted-foreground">
                        <div className="flex items-start gap-3">
                            <Shield className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-foreground mb-1">How Buyout Works</p>
                                <ol className="list-decimal list-inside space-y-1 text-xs">
                                    <li>A governance proposal to sell the asset must pass with 67% supermajority</li>
                                    <li>Buyer deposits ETH = price × total supply into the BuyoutVault</li>
                                    <li>Operator publishes a Merkle root snapshot of all holder balances</li>
                                    <li>Holders claim their pro-rata ETH share within the 30-day claim window</li>
                                    <li>After claim deadline, buyer sweeps unclaimed ETH</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : buyouts.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            <Gavel className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="text-lg font-semibold">No buyout proposals</p>
                            <p className="text-sm mt-1">Buyouts are initiated through governance proposals</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {buyouts.map((b, i) => {
                                const isDetail = selectedBuyout === b.id;
                                return (
                                    <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-card border border-border rounded-2xl overflow-hidden">
                                        {/* Summary */}
                                        <div className="p-5 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => isDetail ? setSelectedBuyout(null) : loadDetail(b.id)}>
                                            <div className="p-2.5 bg-red-500/10 rounded-xl">
                                                <Gavel className="w-5 h-5 text-red-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLE[b.status] || ''}`}>
                                                        {b.status}
                                                    </span>
                                                    <span className="font-bold text-sm">
                                                        Buyout #{b.id}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>Buyer: <span className="font-mono">{b.buyer_address?.substring(0, 8)}...</span></span>
                                                    <span>Price: <strong className="text-foreground">
                                                        {b.total_price_wei ? formatEther(BigInt(b.total_price_wei)) : '—'} ETH
                                                    </strong></span>
                                                    <span><Clock className="w-3 h-3 inline" /> {new Date(b.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <ArrowRight className={`w-4 h-4 text-muted-foreground transition-transform ${isDetail ? 'rotate-90' : ''}`} />
                                        </div>

                                        {/* Detail panel */}
                                        {isDetail && detail && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                                className="border-t border-border p-5 space-y-4 bg-muted/20">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                                    <div className="bg-card rounded-xl p-3 border border-border">
                                                        <p className="text-[10px] text-muted-foreground uppercase">Price/Token</p>
                                                        <p className="text-sm font-black">
                                                            {b.price_per_token_wei ? formatEther(BigInt(b.price_per_token_wei)) : '—'} ETH
                                                        </p>
                                                    </div>
                                                    <div className="bg-card rounded-xl p-3 border border-border">
                                                        <p className="text-[10px] text-muted-foreground uppercase">Total Price</p>
                                                        <p className="text-sm font-black text-red-400">
                                                            {b.total_price_wei ? formatEther(BigInt(b.total_price_wei)) : '—'} ETH
                                                        </p>
                                                    </div>
                                                    <div className="bg-card rounded-xl p-3 border border-border">
                                                        <p className="text-[10px] text-muted-foreground uppercase">Claims</p>
                                                        <p className="text-sm font-black">{detail.claims_count || 0}</p>
                                                    </div>
                                                    <div className="bg-card rounded-xl p-3 border border-border">
                                                        <p className="text-[10px] text-muted-foreground uppercase">Claimed</p>
                                                        <p className="text-sm font-black text-emerald-400">
                                                            {detail.total_claimed_wei ? formatEther(BigInt(detail.total_claimed_wei)) : '0'} ETH
                                                        </p>
                                                    </div>
                                                </div>

                                                {b.claim_deadline && (
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        Claim deadline: <strong className="text-foreground">{new Date(b.claim_deadline).toLocaleString()}</strong>
                                                    </div>
                                                )}

                                                {/* Claims list */}
                                                {detail.claims && detail.claims.length > 0 && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-muted-foreground uppercase">Recent Claims</p>
                                                        {detail.claims.slice(0, 5).map((c: any, ci: number) => (
                                                            <div key={ci} className="flex items-center gap-2 text-xs p-2 bg-card rounded-lg border border-border">
                                                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                                                                <span className="font-mono text-muted-foreground">{c.holder_address?.substring(0, 8)}...</span>
                                                                <span className="ml-auto font-bold">{formatEther(BigInt(c.amount_wei || '0'))} ETH</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {b.status === 'FINALIZED' && isConnected && (
                                                    <button onClick={() => handleClaim(b.id)}
                                                        className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                                                        <Wallet className="w-4 h-4" /> Claim My Proceeds
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
