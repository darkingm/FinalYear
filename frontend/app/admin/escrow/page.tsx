'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Zap, Copy, Check, ExternalLink, Shield, Play, RotateCcw,
    Pause, AlertTriangle, Wallet, ArrowRightLeft, RefreshCw,
    Activity, Database, TrendingUp, Clock, Link2, ChevronDown,
    CheckCircle2, XCircle, Loader2, Info,
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { paymentClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseAbi, keccak256, toHex, formatEther } from 'viem';
import { ESCROW_CONTRACTS } from '@/lib/web3/config';
import { CHAIN_EXPLORERS } from '@/app/checkout/[orderId]/page';

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

const CHAIN_NAMES: Record<number, string> = {
    31337: 'Hardhat VPS',
    80002: 'Polygon Amoy',
    97: 'BNB Testnet',
    137: 'Polygon',
    42161: 'Arbitrum',
    56: 'BSC',
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
    icon: React.ReactNode; title: string; value: string | number; sub?: string; color?: string;
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
    const { address, isConnected, chainId } = useAccount();
    const publicClient = usePublicClient();

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [chainStats, setChainStats] = useState<Record<number, {
        balance: string; blockNumber: number; isPaused: boolean; fee: string; status: 'ok' | 'error' | 'loading';
    }>>({});
    const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
    const [resolveModal, setResolveModal] = useState<{ order: any; type: 'release' | 'refund' } | null>(null);

    const { writeContract, data: txData, isPending: txPending } = useWriteContract();
    const { isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txData });

    /* ─── Fetch data ── */
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.escrow.orders();
            setOrders(res.data.orders || []);
        } catch {
            toast.error('Failed to load escrow orders');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    useEffect(() => {
        if (txSuccess) {
            toast.success('On-chain transaction confirmed! ✅');
            setActionLoading(null);
            setResolveModal(null);
            fetchOrders();
        }
    }, [txSuccess, fetchOrders]);

    /* ─── Fetch live chain stats ── */
    const fetchChainStat = useCallback(async (cid: number, addr: `0x${string}`) => {
        setChainStats(prev => ({ ...prev, [cid]: { ...prev[cid], status: 'loading' } as any }));
        try {
            // Use the backend RPC to query, not MetaMask (we want all chains, not just connected one)
            const rpc = {
                31337: 'http://103.20.96.79:8545',
                80002: 'https://rpc-amoy.polygon.technology',
                97: 'https://data-seed-prebsc-1-s1.binance.org:8545',
            } as Record<number, string>;

            const rpcUrl = rpc[cid];
            if (!rpcUrl) return;

            const call = async (method: string, params: any[]) => {
                const r = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
                });
                return (await r.json()).result;
            };

            const [rawBal, rawBlock, rawPaused, rawFee] = await Promise.all([
                call('eth_getBalance', [addr, 'latest']),
                call('eth_blockNumber', []),
                // Call paused() function: selector 0x5c975abb
                call('eth_call', [{ to: addr, data: '0x5c975abb' }, 'latest']),
                // Call platformFeePercent(): selector 0x4d146cd8
                call('eth_call', [{ to: addr, data: '0x4d146cd8' }, 'latest']),
            ]);

            const balEth = rawBal ? (parseInt(rawBal, 16) / 1e18).toFixed(6) : '?';
            const block = rawBlock ? parseInt(rawBlock, 16) : 0;
            const isPaused = rawPaused ? rawPaused !== '0x' + '0'.repeat(64) : false;
            const fee = rawFee ? (parseInt(rawFee, 16) / 100).toFixed(2) : '1.50';

            setChainStats(prev => ({
                ...prev,
                [cid]: { balance: balEth, blockNumber: block, isPaused, fee, status: 'ok' },
            }));
        } catch {
            setChainStats(prev => ({ ...prev, [cid]: { ...prev[cid], status: 'error' } as any }));
        }
    }, []);

    useEffect(() => {
        Object.entries(ESCROW_CONTRACTS).forEach(([cid, addr]) => {
            const chainIdNum = parseInt(cid);
            if (addr && addr !== '0x0000000000000000000000000000000000000000') {
                fetchChainStat(chainIdNum, addr as `0x${string}`);
            }
        });
    }, [fetchChainStat]);

    /* ─── Actions ── */
    const getEscrowAddr = (cid: number): `0x${string}` | undefined => {
        const a = ESCROW_CONTRACTS[cid];
        return a && a !== '0x0000000000000000000000000000000000000000' ? a as `0x${string}` : undefined;
    };

    const handleRelease = async (order: any) => {
        const addr = getEscrowAddr(order.chain_id);
        if (!addr) return toast.error('Escrow not configured for this chain');
        if (!isConnected) return toast.error('Connect wallet first');
        setActionLoading(`release-${order.order_id}`);
        try {
            writeContract({
                address: addr, abi: ESCROW_ABI, functionName: 'releasePayment',
                args: [keccak256(toHex(order.internal_order_id))]
            });
            await adminApi.orders.updateStatus(order.order_id, 'COMPLETED', 'Admin released via escrow dashboard');
            toast.info('Release TX sent — waiting for confirmation...');
        } catch (e: any) {
            toast.error(e.message || 'Failed'); setActionLoading(null);
        }
    };

    const handleRefund = async (order: any) => {
        const addr = getEscrowAddr(order.chain_id);
        if (!addr) return toast.error('Escrow not configured for this chain');
        if (!isConnected) return toast.error('Connect wallet first');
        setActionLoading(`refund-${order.order_id}`);
        try {
            writeContract({
                address: addr, abi: ESCROW_ABI, functionName: 'refund',
                args: [keccak256(toHex(order.internal_order_id))]
            });
            await adminApi.orders.updateStatus(order.order_id, 'REFUNDED', 'Admin refunded via escrow dashboard');
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

    /* ─── Computed stats ── */
    const totalLocked = orders.filter(o => ['PAID', 'ONCHAIN_CONFIRMED', 'DISPUTED', 'DELIVERING'].includes(o.status)).length;
    const totalDisputed = orders.filter(o => o.status === 'DISPUTED').length;
    const totalCompleted = orders.filter(o => o.status === 'COMPLETED').length;
    const totalRefunded = orders.filter(o => o.status === 'REFUNDED').length;

    /* ─── Active chains to display ── */
    const activeChains = Object.entries(ESCROW_CONTRACTS)
        .filter(([, addr]) => addr && addr !== '0x0000000000000000000000000000000000000000')
        .map(([cid, addr]) => ({ chainId: parseInt(cid), address: addr! }));

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

            {/* Chain Status Cards */}
            <div>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Live Contract Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeChains.map(({ chainId: cid, address: addr }) => {
                        const stat = chainStats[cid];
                        const explorer = CHAIN_EXPLORERS[cid];
                        return (
                            <motion.div key={cid} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                                className="bg-card border border-border rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${stat?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : stat?.status === 'error' ? 'bg-red-500' : 'bg-yellow-400 animate-pulse'}`} />
                                        <span className="font-bold text-sm">{CHAIN_NAMES[cid] || `Chain ${cid}`}</span>
                                        <span className="text-xs text-muted-foreground">#{cid}</span>
                                    </div>
                                    {stat?.isPaused !== undefined && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stat.isPaused ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
                                            {stat.isPaused ? '⏸ PAUSED' : '▶ ACTIVE'}
                                        </span>
                                    )}
                                </div>

                                {stat?.status === 'loading' ? (
                                    <div className="space-y-2">
                                        {[1, 2, 3].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
                                    </div>
                                ) : stat?.status === 'error' ? (
                                    <p className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> RPC unreachable</p>
                                ) : stat ? (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground text-xs">Balance locked</span>
                                            <span className="font-bold text-[#f0b90b]">{stat.balance} ETH</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground text-xs">Block height</span>
                                            <span className="font-mono text-xs">{stat.blockNumber.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground text-xs">Platform fee</span>
                                            <span className="text-xs">{stat.fee}%</span>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="pt-2 border-t border-border">
                                    <div className="flex items-center gap-2">
                                        <code className="text-[10px] font-mono text-muted-foreground flex-1 truncate">{addr}</code>
                                        <button onClick={() => copyText(addr, `addr-${cid}`)} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                                            {copied === `addr-${cid}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                        {explorer?.address && (
                                            <a href={`${explorer.address}${addr}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-muted-foreground hover:text-[#f0b90b] transition-colors">
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Chain controls */}
                                {isConnected && chainId === cid && (
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={() => writeContract({ address: addr as `0x${string}`, abi: ESCROW_ABI, functionName: 'pause' })}
                                            disabled={txPending} className="flex-1 py-1.5 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors disabled:opacity-40">
                                            ⏸ Pause
                                        </button>
                                        <button onClick={() => writeContract({ address: addr as `0x${string}`, abi: ESCROW_ABI, functionName: 'unpause' })}
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
                        {txData && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{txData.slice(0, 20)}...</p>}
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
                                                    {CHAIN_NAMES[order.chain_id] || `Chain ${order.chain_id}`}
                                                </span>
                                                {isDisputed && <span className="animate-pulse text-xs text-orange-400 font-bold">⚠ NEEDS RESOLUTION</span>}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                                <span>👤 {order.buyer_name}</span>
                                                <span>→</span>
                                                <span>🏪 {order.seller_name}</span>
                                                <span className="font-bold text-foreground">${parseFloat(order.total_amount || 0).toFixed(2)}</span>
                                                {order.amount_token && <span className="text-[#f0b90b]">{parseFloat(order.amount_token).toFixed(6)} tokens</span>}
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
                        <p>⚠ ADMIN_PRIVATE_KEY wallet là <code className="text-blue-400">0xC9F9052095481DE14a2f54c1103203328578C683</code> — đã được cấp OPERATOR_ROLE và 15 ETH khi deploy.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
