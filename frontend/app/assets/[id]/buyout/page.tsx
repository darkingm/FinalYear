'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Gavel, ChevronLeft, Loader2, Clock, CheckCircle, AlertCircle,
    Wallet, Shield, ArrowRight,
} from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { formatEther, parseAbi, parseEventLogs } from 'viem';
import { waitForTransactionReceipt } from '@wagmi/core';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getWagmiConfig } from '@/lib/web3/config';
import { isConfiguredContractAddress } from '@/lib/rwa/onchain';

const BUYOUT_VAULT_ABI = parseAbi([
    'function setMerkleRoot(bytes32 root) external',
    'function claimProceeds(uint256 tokenBalance, bytes32[] proof) external',
    'event MerkleRootSet(bytes32 root, uint256 deadline)',
]);

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
    const [claimBusy, setClaimBusy] = useState<number | null>(null);
    const [snapshotBusy, setSnapshotBusy] = useState<number | null>(null);
    const { writeContractAsync } = useWriteContract();

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
        try {
            setClaimBusy(buyoutId);
            const proofResponse = await rwaApi.buyout.proof(buyoutId, address);
            const claim = proofResponse.data.claim;

            if (!isConfiguredContractAddress(claim.vault_address)) {
                return toast.error('Buyout vault is not configured for this proposal');
            }
            if (!claim.proof || !Array.isArray(claim.proof)) {
                return toast.error('Invalid Merkle proof returned by backend');
            }

            const hash = await writeContractAsync({
                address: claim.vault_address,
                abi: BUYOUT_VAULT_ABI,
                functionName: 'claimProceeds',
                args: [BigInt(claim.token_balance_wei), claim.proof],
            });
            await waitForTransactionReceipt(getWagmiConfig(), { hash });

            await rwaApi.buyout.claim(buyoutId, {
                holder_address: address,
                amount_wei: claim.amount_wei,
                tx_hash: hash,
            });

            toast.success('Buyout proceeds claimed!');
            await loadDetail(buyoutId);
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Failed to claim buyout proceeds');
        } finally {
            setClaimBusy(null);
        }
    };

    const handlePublishSnapshot = async (buyout: any) => {
        if (!address) return toast.error('Connect wallet first');
        if (!isConfiguredContractAddress(buyout.vault_address)) {
            return toast.error('Buyout vault address is missing');
        }

        try {
            setSnapshotBusy(buyout.id);
            const snapshotResponse = await rwaApi.buyout.snapshot(buyout.id);
            const root = snapshotResponse.data.merkle_root;
            if (!root) throw new Error('Snapshot did not return a Merkle root');

            const hash = await writeContractAsync({
                address: buyout.vault_address,
                abi: BUYOUT_VAULT_ABI,
                functionName: 'setMerkleRoot',
                args: [root],
            });
            const receipt = await waitForTransactionReceipt(getWagmiConfig(), { hash });
            const logs = parseEventLogs({
                abi: BUYOUT_VAULT_ABI,
                eventName: 'MerkleRootSet',
                logs: receipt.logs,
            }) as any[];
            const deadline = logs[0]?.args?.deadline;

            await rwaApi.buyout.updateStatus(buyout.id, {
                status: 'FINALIZED',
                merkle_root: root,
                finalize_tx_hash: hash,
                claim_deadline: deadline ? new Date(Number(deadline) * 1000).toISOString() : undefined,
            });

            toast.success(`Merkle root published for ${snapshotResponse.data.holder_count} holders`);
            fetchData();
            await loadDetail(buyout.id);
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Failed to publish Merkle snapshot');
        } finally {
            setSnapshotBusy(null);
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

                                                {b.status === 'DEPOSITED' && isConnected && (
                                                    <button onClick={() => handlePublishSnapshot(b)}
                                                        disabled={snapshotBusy === b.id || !isConfiguredContractAddress(b.vault_address)}
                                                        className="w-full py-3 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                                                        {snapshotBusy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                                        Build snapshot & publish Merkle root
                                                    </button>
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
                                                        disabled={claimBusy === b.id || !isConfiguredContractAddress(b.vault_address) || !b.merkle_root}
                                                        className="w-full py-3 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                                                        {claimBusy === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                                                        Claim buyout proceeds
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
