'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Zap, Copy, Check, ExternalLink, Shield, Play, RotateCcw,
    Pause, AlertTriangle, Wallet, ArrowRightLeft
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi, keccak256, toHex } from 'viem';
import { ESCROW_CONTRACTS } from '@/lib/web3/config';

const ESCROW_WRITE_ABI = parseAbi([
    'function releasePayment(bytes32 orderId) external',
    'function refund(bytes32 orderId) external',
    'function pause() external',
    'function unpause() external',
    'function updatePlatformFee(uint256 newFeePercent) external',
]);

const statusColors: Record<string, string> = {
    UNPAID: 'text-yellow-400 bg-yellow-400/10',
    TX_SUBMITTED: 'text-blue-400 bg-blue-400/10',
    TX_FAILED: 'text-red-400 bg-red-400/10',
    ONCHAIN_CONFIRMED: 'text-emerald-400 bg-emerald-400/10',
    PAID: 'text-green-400 bg-green-400/10',
    DELIVERING: 'text-cyan-400 bg-cyan-400/10',
    COMPLETED: 'text-emerald-500 bg-emerald-500/10',
    DISPUTED: 'text-orange-400 bg-orange-400/10',
    refunded: 'text-purple-400 bg-purple-400/10',
};

export default function AdminEscrowPage() {
    const { address, isConnected, chainId } = useAccount();
    const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const { writeContract, data: txData, isPending: txPending } = useWriteContract();

    const { isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({
        hash: txData,
    });

    useEffect(() => {
        if (txSuccess) {
            toast.success('Transaction confirmed on-chain!');
            setActionLoading(null);
            fetchEscrowOrders();
        }
    }, [txSuccess]);

    const fetchEscrowOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.escrow.orders();
            setEscrowOrders(res.data.orders);
        } catch {
            toast.error('Failed to load escrow orders');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEscrowOrders(); }, [fetchEscrowOrders]);

    const getEscrowAddress = (chain_id: number): `0x${string}` | undefined => {
        const addr = ESCROW_CONTRACTS[chain_id];
        if (!addr || addr === '0x0000000000000000000000000000000000000000') return undefined;
        return addr as `0x${string}`;
    };

    const handleReleasePayment = async (order: any) => {
        const escrowAddr = getEscrowAddress(order.chain_id);
        if (!escrowAddr) {
            toast.error('Escrow contract not configured for this chain');
            return;
        }
        if (!isConnected) {
            toast.error('Please connect your wallet first');
            return;
        }
        setActionLoading(`release-${order.order_id}`);
        try {
            writeContract({
                address: escrowAddr,
                abi: ESCROW_WRITE_ABI,
                functionName: 'releasePayment',
                args: [keccak256(toHex(order.internal_order_id))],
            });
            // Also update backend
            await adminApi.orders.updateStatus(order.order_id, 'COMPLETED', 'Admin released payment from escrow');
        } catch (err: any) {
            toast.error(err.message || 'Failed to release payment');
            setActionLoading(null);
        }
    };

    const handleRefundOnChain = async (order: any) => {
        const escrowAddr = getEscrowAddress(order.chain_id);
        if (!escrowAddr) {
            toast.error('Escrow contract not configured for this chain');
            return;
        }
        if (!isConnected) {
            toast.error('Please connect your wallet first');
            return;
        }
        setActionLoading(`refund-${order.order_id}`);
        try {
            writeContract({
                address: escrowAddr,
                abi: ESCROW_WRITE_ABI,
                functionName: 'refund',
                args: [keccak256(toHex(order.internal_order_id))],
            });
            // Also update backend
            await adminApi.orders.updateStatus(order.order_id, 'refunded', 'Admin refunded from escrow');
            await adminApi.refunds.initiate(order.order_id, 'Admin initiated on-chain refund from escrow');
        } catch (err: any) {
            toast.error(err.message || 'Failed to refund');
            setActionLoading(null);
        }
    };

    const handlePause = async () => {
        const escrowAddr = getEscrowAddress(chainId || 31337);
        if (!escrowAddr || !isConnected) {
            toast.error('Connect wallet and ensure correct chain');
            return;
        }
        try {
            writeContract({
                address: escrowAddr,
                abi: ESCROW_WRITE_ABI,
                functionName: 'pause',
            });
            toast.info('Pause transaction submitted');
        } catch (err: any) {
            toast.error(err.message || 'Failed to pause');
        }
    };

    const handleUnpause = async () => {
        const escrowAddr = getEscrowAddress(chainId || 31337);
        if (!escrowAddr || !isConnected) {
            toast.error('Connect wallet and ensure correct chain');
            return;
        }
        try {
            writeContract({
                address: escrowAddr,
                abi: ESCROW_WRITE_ABI,
                functionName: 'unpause',
            });
            toast.info('Unpause transaction submitted');
        } catch (err: any) {
            toast.error(err.message || 'Failed to unpause');
        }
    };

    const copyText = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(''), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                        <Zap className="w-8 h-8 text-yellow-400" />
                        Smart Contract Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage escrow contract operations on-chain</p>
                </div>
            </div>

            {/* Wallet Status + Contract Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Wallet Status */}
                <div className="rounded-2xl bg-white border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Admin Wallet
                    </h3>
                    {isConnected ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-sm text-green-400 font-medium">Connected</span>
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50">
                                <code className="text-sm text-blue-400 font-mono flex-1 truncate">{address}</code>
                                <button onClick={() => copyText(address!, 'wallet')} className="p-1 hover:bg-gray-50 rounded">
                                    {copied === 'wallet' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                                </button>
                            </div>
                            <div className="text-xs text-gray-500">Chain ID: {chainId}</div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <Wallet className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Connect your wallet to interact with smart contracts</p>
                            <p className="text-xs text-gray-600 mt-1">Use the wallet button in the header</p>
                        </div>
                    )}
                </div>

                {/* Contract Controls */}
                <div className="rounded-2xl bg-white border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Contract Controls
                    </h3>
                    <div className="space-y-3">
                        <div className="text-xs text-gray-500 mb-2">
                            Escrow Contract: <code className="text-blue-400 font-mono">{ESCROW_CONTRACTS[chainId || 31337]?.slice(0, 20)}...</code>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handlePause}
                                disabled={!isConnected || txPending}
                                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 text-sm font-medium transition-all disabled:opacity-40"
                            >
                                <Pause className="w-4 h-4" /> Pause Contract
                            </button>
                            <button
                                onClick={handleUnpause}
                                disabled={!isConnected || txPending}
                                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 text-sm font-medium transition-all disabled:opacity-40"
                            >
                                <Play className="w-4 h-4" /> Unpause Contract
                            </button>
                        </div>
                        {(txPending || txConfirming) && (
                            <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/5 px-3 py-2 rounded-lg">
                                <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                {txPending ? 'Waiting for wallet confirmation...' : 'Confirming on-chain...'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Escrow Orders */}
            <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                <div className="p-6 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                        On-Chain Escrow Orders
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Orders with blockchain transactions — release or refund</p>
                </div>

                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-50 animate-pulse" />)}
                    </div>
                ) : escrowOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Zap className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                        <p>No crypto escrow orders found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {escrowOrders.map((order, idx) => (
                            <motion.div
                                key={order.order_id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.03 }}
                                className="p-5 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[280px]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-sm font-medium text-blue-400">{order.order_number}</span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${statusColors[order.status] || 'text-gray-400 bg-gray-400/10'}`}>{order.status}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400">Chain {order.chain_id}</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                                            <div>
                                                <span className="text-gray-500">Buyer: </span>
                                                <span className="text-gray-300">{order.buyer_name}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Seller: </span>
                                                <span className="text-gray-300">{order.seller_name}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Amount: </span>
                                                <span className="text-gray-900 font-medium">${parseFloat(order.total_amount).toFixed(2)}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Tokens: </span>
                                                <span className="text-gray-900">{order.amount_token ? parseFloat(order.amount_token).toFixed(4) : 'N/A'}</span>
                                            </div>
                                        </div>
                                        {order.tx_hash && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-500">TX:</span>
                                                <code className="text-blue-400 font-mono truncate max-w-[200px]">{order.tx_hash}</code>
                                                <button onClick={() => copyText(order.tx_hash, `tx-${order.order_id}`)} className="p-0.5 hover:bg-gray-50 rounded">
                                                    {copied === `tx-${order.order_id}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        {(order.status === 'ONCHAIN_CONFIRMED' || order.status === 'PAID' || order.status === 'DELIVERING' || order.status === 'COMPLETED') && (
                                            <button
                                                onClick={() => handleReleasePayment(order)}
                                                disabled={!isConnected || actionLoading === `release-${order.order_id}` || txPending}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 text-xs font-medium transition-all disabled:opacity-40"
                                            >
                                                {actionLoading === `release-${order.order_id}` ? (
                                                    <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Play className="w-3.5 h-3.5" />
                                                )}
                                                Release to Seller
                                            </button>
                                        )}
                                        {(order.status === 'ONCHAIN_CONFIRMED' || order.status === 'PAID' || order.status === 'DISPUTED') && (
                                            <button
                                                onClick={() => handleRefundOnChain(order)}
                                                disabled={!isConnected || actionLoading === `refund-${order.order_id}` || txPending}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 text-xs font-medium transition-all disabled:opacity-40"
                                            >
                                                {actionLoading === `refund-${order.order_id}` ? (
                                                    <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                )}
                                                Refund to Buyer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info Alert */}
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-5">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-amber-400 mb-1">Important Notes</h4>
                        <ul className="space-y-1 text-xs text-gray-400">
                            <li>• <strong>Release Payment</strong>: Sends escrowed tokens to the seller and fees to the platform vault.</li>
                            <li>• <strong>Refund to Buyer</strong>: Returns all escrowed tokens (including fees) back to the buyer.</li>
                            <li>• Your wallet must have the <code className="text-amber-400">OPERATOR_ROLE</code> on the contract.</li>
                            <li>• Make sure you&apos;re connected to the correct network matching the order&apos;s chain ID.</li>
                            <li>• Pause/Unpause affects all new deposits globally on the specific chain.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
