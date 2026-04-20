'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
    Zap, Copy, Check, ExternalLink, Shield, Play, RotateCcw,
    Pause, AlertTriangle, Wallet, ArrowRightLeft, RefreshCw,
    Activity, Database, TrendingUp, Clock, Link2, ChevronDown,
    CheckCircle2, XCircle, Loader2, Info,
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi, keccak256, toHex } from 'viem';
import { ESCROW_CONTRACTS, getChainMetaOrFallback } from '@/lib/web3/config';
import { CHAIN_EXPLORERS } from '@/app/checkout/[orderId]/page';
import { TokenAmountInline, UsdtAmountInline } from '@/components/checkout/CheckoutPriceValue';
import { getOrderPricingDisplay } from '@/lib/orders/presentation';
import { shapeContractOpsChains, type ContractOpsChainSnapshot } from '@/lib/admin/contract-ops';
import { shapeEscrowOpsHealth, type EscrowOpsHealthSnapshot } from '@/lib/admin/escrow-health';

/* ─── ABI ───────────────────────────────────────────────────────────────── */
const ESCROW_ABI = parseAbi([
    'function releasePayment(bytes32 orderId) external',
    'function refund(bytes32 orderId) external',
    'function pause() external',
    'function unpause() external',
    'function updatePlatformFee(uint256 newFeePercent) external',
    'function paused() view returns (bool)',
    'function platformFeePercent() view returns (uint256)',
]);

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { color: string; dot: string; label: string }> = {
    UNPAID: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', dot: 'bg-yellow-400', label: 'Unpaid' },
    TX_SUBMITTED: { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', dot: 'bg-blue-400', label: 'TX Submitted' },
    TX_FAILED: { color: 'text-red-400 bg-red-400/10 border-red-400/20', dot: 'bg-red-500', label: 'TX Failed' },
    ONCHAIN_CONFIRMED: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20', dot: 'bg-emerald-400', label: 'Confirmed' },
    PAID: { color: 'text-green-400 bg-green-400/10 border-green-500/20', dot: 'bg-green-400', label: 'Paid' },
    DELIVERING: { color: 'text-cyan-400 bg-cyan-400/10 border-cyan-500/20', dot: 'bg-cyan-400', label: 'Delivering' },
    COMPLETED: { color: 'text-emerald-500 bg-emerald-500/10 border-emerald-600/20', dot: 'bg-emerald-500', label: 'Completed' },
    DISPUTED: { color: 'text-orange-400 bg-orange-400/10 border-orange-500/20', dot: 'bg-orange-400', label: 'Disputed' },
    REFUNDED: { color: 'text-purple-400 bg-purple-400/10 border-purple-500/20', dot: 'bg-purple-400', label: 'Refunded' },
};

function StatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status] || { color: 'text-gray-400 bg-gray-400/10 border-gray-400/20', dot: 'bg-gray-400', label: status };
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
}

function StatCard({ icon, title, value, sub, color = 'emerald' }: {
    icon: ReactNode; title: string; value: string | number; sub?: string; color?: string;
}) {
    const colors: Record<string, string> = {
        emerald: 'text-emerald-400 bg-emerald-400/10',
        blue: 'text-blue-400 bg-blue-400/10',
        amber: 'text-amber-400 bg-amber-400/10',
        purple: 'text-purple-400 bg-purple-400/10',
        orange: 'text-orange-400 bg-orange-400/10',
        red: 'text-red-400 bg-red-400/10',
    };
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
            <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{title}</p>
                <p className="text-2xl font-black mt-0.5">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
        </motion.div>
    );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function AdminEscrowPage() {
    const { isConnected, chainId } = useAccount();

    const [orders, setOrders] = useState<any[]>([]);
    const [contractChains, setContractChains] = useState<ContractOpsChainSnapshot[]>([]);
    const [opsHealth, setOpsHealth] = useState<EscrowOpsHealthSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
    const [resolveModal, setResolveModal] = useState<{ order: any; type: 'release' | 'refund' } | null>(null);
    const [activeTxHash, setActiveTxHash] = useState<`0x${string}` | undefined>();
    const [pendingChainAction, setPendingChainAction] = useState<{
        orderId: number;
        nextStatus: 'COMPLETED' | 'REFUNDED';
        notes: string;
    } | null>(null);

    const { writeContractAsync, isPending: txPending } = useWriteContract();
    const { isLoading: txConfirming, isSuccess: txSuccess, isError: txFailed, error: txError } = useWaitForTransactionReceipt({ hash: activeTxHash });

    /* ─── Fetch data ── */
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const [ordersRes, contractsRes, healthRes] = await Promise.all([
                adminApi.escrow.orders(),
                adminApi.escrow.contracts(),
                adminApi.escrow.health(),
            ]);
            setOrders(ordersRes.data.orders || []);
            setContractChains(contractsRes.data.chains || []);
            setOpsHealth(healthRes.data.health || null);
        } catch {
            toast.error('Failed to load escrow dashboard');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    useEffect(() => {
        if (!txSuccess || !pendingChainAction) {
            return;
        }

        let cancelled = false;
        void (async () => {
            try {
                await adminApi.orders.updateStatus(
                    pendingChainAction.orderId,
                    pendingChainAction.nextStatus,
                    pendingChainAction.notes,
                );
                if (!cancelled) {
                    toast.success('On-chain transaction confirmed! ✅');
                    setActionLoading(null);
                    setResolveModal(null);
                    setPendingChainAction(null);
                    setActiveTxHash(undefined);
                    fetchOrders();
                }
            } catch (error: any) {
                if (!cancelled) {
                    toast.error(error?.response?.data?.message || 'Failed to sync confirmed on-chain action');
                    setActionLoading(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [txSuccess, pendingChainAction, fetchOrders]);

    useEffect(() => {
        if (!txFailed) {
            return;
        }

        toast.error(txError?.message || 'On-chain transaction failed');
        setActionLoading(null);
        setPendingChainAction(null);
        setActiveTxHash(undefined);
    }, [txFailed, txError]);

    /* ─── Actions ── */
    const getEscrowAddr = (cid: number, orderEscrowAddress?: string | null): `0x${string}` | undefined => {
        const liveAddress = contractChains.find((chain) => chain.chain_id === cid)?.escrow_contract;
        const a = liveAddress || orderEscrowAddress || ESCROW_CONTRACTS[cid];
        return a && a !== '0x0000000000000000000000000000000000000000' ? a as `0x${string}` : undefined;
    };

    const handleRelease = async (order: any) => {
        const addr = getEscrowAddr(order.chain_id, order.escrow_contract);
        if (!addr) return toast.error('Escrow not configured for this chain');
        if (!isConnected) return toast.error('Connect wallet first');
        setActionLoading(`release-${order.order_id}`);
        try {
            const txHash = await writeContractAsync({
                address: addr, abi: ESCROW_ABI, functionName: 'releasePayment',
                args: [keccak256(toHex(order.internal_order_id))]
            });
            setActiveTxHash(txHash);
            setPendingChainAction({
                orderId: order.order_id,
                nextStatus: 'COMPLETED',
                notes: 'Admin released via escrow dashboard',
            });
            toast.info('Release TX sent — waiting for confirmation...');
        } catch (e: any) {
            toast.error(e.message || 'Failed'); setActionLoading(null);
        }
    };

    const handleRefund = async (order: any) => {
        const addr = getEscrowAddr(order.chain_id, order.escrow_contract);
        if (!addr) return toast.error('Escrow not configured for this chain');
        if (!isConnected) return toast.error('Connect wallet first');
        setActionLoading(`refund-${order.order_id}`);
        try {
            const txHash = await writeContractAsync({
                address: addr, abi: ESCROW_ABI, functionName: 'refund',
                args: [keccak256(toHex(order.internal_order_id))]
            });
            setActiveTxHash(txHash);
            setPendingChainAction({
                orderId: order.order_id,
                nextStatus: 'REFUNDED',
                notes: 'Admin refunded via escrow dashboard',
            });
            toast.info('Refund TX sent — waiting for confirmation...');
        } catch (e: any) {
            toast.error(e.message || 'Failed'); setActionLoading(null);
        }
    };

    // Backend-triggered dispute resolution (no MetaMask needed — uses ADMIN_PRIVATE_KEY on server)
    const handleServerResolve = async (order: any, winner: 'BUYER' | 'SELLER') => {
        setActionLoading(`server-${order.order_id}`);
        try {
            const res = await adminApi.orders.resolveDispute(order.order_id, winner, 'Resolved via escrow dashboard');
            if (res.data.on_chain_tx_hash) {
                toast.success(`Resolved on-chain! TX: ${res.data.on_chain_tx_hash.slice(0, 10)}...`);
            } else if (res.data.on_chain_error) {
                toast.warning(`DB updated but on-chain failed: ${res.data.on_chain_error}. Retry manually.`);
            } else {
                toast.success('Dispute resolved! Order status updated.');
            }
            fetchOrders();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Resolve failed');
        } finally {
            setActionLoading(null); setResolveModal(null);
        }
    };

    const copyText = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key); setTimeout(() => setCopied(''), 2000);
    };

    const getPricingDisplay = (order: any) => getOrderPricingDisplay({
        token_symbol: order.token_symbol,
        subtotal_token: order.amount_token,
        amount_token: order.amount_token,
        total_amount: order.total_amount,
        price_usd: order.total_amount,
    });

    /* ─── Computed stats ── */
    const totalLocked = orders.filter(o => ['PAID', 'ONCHAIN_CONFIRMED', 'DISPUTED', 'DELIVERING'].includes(o.status)).length;
    const totalDisputed = orders.filter(o => o.status === 'DISPUTED').length;
    const totalCompleted = orders.filter(o => o.status === 'COMPLETED').length;
    const totalRefunded = orders.filter(o => o.status === 'REFUNDED').length;

    const contractOpsCards = shapeContractOpsChains(contractChains);
    const opsHealthCards = opsHealth ? shapeEscrowOpsHealth(opsHealth) : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-3">
                        <div className="p-2 bg-[#f0b90b]/10 rounded-xl"><Zap className="w-6 h-6 text-[#f0b90b]" /></div>
                        Smart Contract Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Monitor EscrowCore contract state across all chains</p>
                </div>
                <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm hover:bg-muted transition-colors">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Database className="w-5 h-5" />} title="Locked in Escrow" value={totalLocked} sub="orders waiting" color="blue" />
                <StatCard icon={<AlertTriangle className="w-5 h-5" />} title="Active Disputes" value={totalDisputed} sub="need resolution" color="orange" />
                <StatCard icon={<CheckCircle2 className="w-5 h-5" />} title="Completed" value={totalCompleted} sub="released to sellers" color="emerald" />
                <StatCard icon={<RotateCcw className="w-5 h-5" />} title="Refunded" value={totalRefunded} sub="returned to buyers" color="purple" />
            </div>

            {opsHealthCards.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Queue / Projection Health
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {opsHealthCards.map((card) => (
                            <div key={card.title} className="bg-card border border-border rounded-2xl p-5 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{card.title}</span>
                                    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${card.tone === 'emerald' ? 'bg-emerald-400' : card.tone === 'amber' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                                </div>
                                <div className="text-2xl font-black">{card.value}</div>
                                <p className={`text-xs ${card.tone === 'amber' ? 'text-amber-400' : 'text-muted-foreground'}`}>{card.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Chain Status Cards */}
            <div>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Live Contract Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contractOpsCards.map((card) => {
                        const explorer = CHAIN_EXPLORERS[card.chainId];
                        return (
                            <motion.div key={card.chainId} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                                className="bg-card border border-border rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${card.statusTone === 'emerald' ? 'bg-emerald-400 animate-pulse' : card.statusTone === 'amber' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                                        <span className="font-bold text-sm">{card.title}</span>
                                        <span className="text-xs text-muted-foreground">#{card.chainId}</span>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${card.statusTone === 'emerald' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : card.statusTone === 'amber' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-slate-500/15 text-slate-300 border border-slate-500/30'}`}>
                                        {card.statusLabel}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground text-xs">Balance locked</span>
                                        <span className="font-bold text-[#f0b90b] text-right">{card.nativeBalanceLabel}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground text-xs">Platform fee</span>
                                        <span className="text-xs">{card.platformFeeLabel || '—'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground text-xs">Contract state</span>
                                        <span className={`text-xs ${card.paused === null ? 'text-muted-foreground' : card.paused ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {card.paused === null ? '—' : card.paused ? 'Paused' : 'Active'}
                                        </span>
                                    </div>
                                    {card.tokenBalanceLabels.length > 0 && (
                                        <div className="space-y-1 pt-1">
                                            <span className="text-muted-foreground text-xs">Token balances</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {card.tokenBalanceLabels.map((label) => (
                                                    <span key={label} className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-foreground/80">
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {card.healthSummary && (
                                        <p className={`text-xs flex items-center gap-1 ${card.statusTone === 'amber' ? 'text-amber-400' : 'text-muted-foreground'}`}>
                                            {card.statusTone === 'amber' ? <XCircle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                                            {card.healthSummary}
                                        </p>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-border">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <code className="text-[10px] font-mono text-muted-foreground flex-1 truncate">{card.contractAddress || 'Not deployed'}</code>
                                            {card.contractAddress && (
                                                <button onClick={() => copyText(card.contractAddress!, `addr-${card.chainId}`)} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                                                    {copied === `addr-${card.chainId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                            )}
                                            {card.contractAddress && explorer?.address && (
                                                <a href={`${explorer.address}${card.contractAddress}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-muted-foreground hover:text-[#f0b90b] transition-colors">
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="space-y-1 text-[10px] text-muted-foreground">
                                            <p>Operator: {card.operatorAddress || '—'}</p>
                                            <p>Fee vault: {card.feeVaultAddress || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Chain controls */}
                                {card.contractAddress && isConnected && chainId === card.chainId && (
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={() => writeContractAsync({ address: card.contractAddress as `0x${string}`, abi: ESCROW_ABI, functionName: 'pause' })}
                                            disabled={txPending} className="flex-1 py-1.5 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors disabled:opacity-40">
                                            ⏸ Pause
                                        </button>
                                        <button onClick={() => writeContractAsync({ address: card.contractAddress as `0x${string}`, abi: ESCROW_ABI, functionName: 'unpause' })}
                                            disabled={txPending} className="flex-1 py-1.5 text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-40">
                                            ▶ Unpause
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* TX Status Banner */}
            {(txPending || txConfirming) && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-[#f0b90b]/10 border border-[#f0b90b]/30 rounded-2xl">
                    <Loader2 className="w-5 h-5 text-[#f0b90b] animate-spin flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-[#f0b90b]">{txPending ? 'Waiting for wallet signature...' : 'Transaction confirming on-chain...'}</p>
                        {activeTxHash && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{activeTxHash.slice(0, 20)}...</p>}
                    </div>
                </motion.div>
            )}

            {/* Orders Table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-5 pb-3 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-[#f0b90b]" /> Escrow Orders
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">All orders with on-chain transactions</p>
                    </div>
                    {!isConnected && (
                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                            <Wallet className="w-3.5 h-3.5" /> Connect wallet for MetaMask actions
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>No escrow orders found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {orders.map((order, idx) => {
                            const explorer = CHAIN_EXPLORERS[order.chain_id];
                            const isExpanded = expandedOrder === order.order_id;
                            const isDisputed = order.status === 'DISPUTED';
                            const canRelease = ['ONCHAIN_CONFIRMED', 'PAID', 'DELIVERING', 'DISPUTED'].includes(order.status);
                            const canRefund = ['ONCHAIN_CONFIRMED', 'PAID', 'DISPUTED'].includes(order.status);
                            const chainMeta = getChainMetaOrFallback(order.chain_id);

                            return (
                                <motion.div key={order.order_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.02 }}
                                    className={`transition-colors ${isDisputed ? 'bg-orange-500/5' : ''}`}>
                                    {/* Main row */}
                                    <div className="p-4 flex items-center gap-4 flex-wrap cursor-pointer hover:bg-muted/50"
                                        onClick={() => setExpandedOrder(isExpanded ? null : order.order_id)}>
                                        <div className="flex-1 min-w-[250px] space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold">{order.order_number}</span>
                                                <StatusBadge status={order.status} />
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                    {chainMeta.shortName}
                                                </span>
                                                {isDisputed && <span className="animate-pulse text-xs text-orange-400 font-bold">⚠ NEEDS RESOLUTION</span>}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                                <span>👤 {order.buyer_name}</span>
                                                <span>→</span>
                                                <span>🏪 {order.seller_name}</span>
                                                {(() => {
                                                    const pricing = getPricingDisplay(order);
                                                    return pricing.mode === 'token' ? (
                                                        <span className="inline-flex items-center gap-3 flex-wrap">
                                                            <TokenAmountInline amount={pricing.tokenAmount} symbol={pricing.tokenSymbol} size="sm" amountClassName="text-[#f0b90b]" />
                                                            <UsdtAmountInline amount={pricing.usdAmount} size="sm" amountClassName="text-foreground" />
                                                        </span>
                                                    ) : (
                                                        <UsdtAmountInline amount={pricing.usdAmount} size="sm" amountClassName="text-foreground" />
                                                    );
                                                })()}
                                            </div>
                                            {order.tx_hash && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <Link2 className="w-3 h-3 text-muted-foreground" />
                                                    <code className="font-mono text-blue-400 truncate max-w-[200px]">{order.tx_hash}</code>
                                                    <button onClick={e => { e.stopPropagation(); copyText(order.tx_hash, `tx-${order.order_id}`); }}>
                                                        {copied === `tx-${order.order_id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />}
                                                    </button>
                                                    {explorer?.tx && (
                                                        <a href={`${explorer.tx}${order.tx_hash}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                                            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-[#f0b90b]" />
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Server-side resolve (no MetaMask needed) */}
                                            {isDisputed && (
                                                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => handleServerResolve(order, 'BUYER')}
                                                        disabled={!!actionLoading}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 text-xs font-medium transition-all disabled:opacity-40"
                                                    >
                                                        {actionLoading === `server-${order.order_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                        Refund Buyer
                                                    </button>
                                                    <button
                                                        onClick={() => handleServerResolve(order, 'SELLER')}
                                                        disabled={!!actionLoading}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-medium transition-all disabled:opacity-40"
                                                    >
                                                        {actionLoading === `server-${order.order_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                                        Release Seller
                                                    </button>
                                                </div>
                                            )}

                                            {/* MetaMask actions (if wallet connected to correct chain) */}
                                            {isConnected && chainId === order.chain_id && (
                                                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                                                    {canRelease && (
                                                        <button onClick={() => handleRelease(order)}
                                                            disabled={!!actionLoading || txPending}
                                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 text-xs font-medium transition-all disabled:opacity-40"
                                                            title="Release via MetaMask (you need OPERATOR_ROLE)">
                                                            {actionLoading === `release-${order.order_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                                            MM Release
                                                        </button>
                                                    )}
                                                    {canRefund && (
                                                        <button onClick={() => handleRefund(order)}
                                                            disabled={!!actionLoading || txPending}
                                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 text-xs font-medium transition-all disabled:opacity-40"
                                                            title="Refund via MetaMask (you need OPERATOR_ROLE)">
                                                            {actionLoading === `refund-${order.order_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                            MM Refund
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/30 border-t border-border">
                                            {[
                                                { label: 'Order ID', val: order.order_id },
                                                { label: 'Internal ID', val: order.internal_order_id },
                                                { label: 'Escrow Contract', val: order.escrow_contract?.slice(0, 14) + '...' },
                                                { label: 'Created', val: new Date(order.created_at).toLocaleDateString('vi-VN') },
                                            ].map(({ label, val }) => (
                                                <div key={label} className="pt-3">
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                                                    <p className="text-xs font-mono mt-0.5 truncate">{val || '—'}</p>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="rounded-2xl bg-blue-500/5 border border-blue-500/20 p-5">
                <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="font-bold text-blue-400 text-sm">Hai cách resolve dispute:</p>
                        <p>🔵 <strong>Refund/Release Buyer/Seller (sidebar buttons)</strong>: Backend dùng ADMIN_PRIVATE_KEY gọi contract — không cần MetaMask. Hoạt động từ server.</p>
                        <p>🟠 <strong>MM Release/Refund</strong>: MetaMask của admin trực tiếp gọi contract — cần wallet có OPERATOR_ROLE và đúng chain.</p>
                        <p>⚠ Ví operator backend và fee vault được đọc từ cấu hình server. Xem các card trạng thái phía trên để kiểm tra địa chỉ đang active trên từng chain.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
