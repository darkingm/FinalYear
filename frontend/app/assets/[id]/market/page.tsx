'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Store, Tag, Clock, ChevronLeft, Loader2, Plus, X, ArrowUpDown,
    CheckCircle, Wallet, History, AlertTriangle,
} from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { parseAbi, parseEther, formatEther, parseEventLogs } from 'viem';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getWagmiConfig } from '@/lib/web3/config';
import {
    getRwaMarketEscrowAddress,
    isConfiguredContractAddress,
    parseRwaWholeTokenAmount,
} from '@/lib/rwa/onchain';

const ESCROW_ABI = parseAbi([
    'function listTokens(address tokenAddress, uint256 amount, uint256 pricePerTokenWei) external returns (uint256)',
    'function buyListing(uint256 listingId) external payable',
    'function cancelListing(uint256 listingId) external',
    'event Listed(uint256 indexed listingId, address indexed seller, address token, uint256 amount, uint256 pricePerToken)',
    'event Sold(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPriceWei)',
    'event Cancelled(uint256 indexed listingId)',
]);

const ERC20_ABI = parseAbi([
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
]);

type Tab = 'listings' | 'history';

export default function MarketPage() {
    const { id: assetId } = useParams<{ id: string }>();
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const marketEscrowAddress = getRwaMarketEscrowAddress();

    const [tab, setTab] = useState<Tab>('listings');
    const [listings, setListings] = useState<any[]>([]);
    const [trades, setTrades] = useState<any[]>([]);
    const [asset, setAsset] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [txBusy, setTxBusy] = useState(false);

    // Create listing form
    const [showCreate, setShowCreate] = useState(false);
    const [tokenAmount, setTokenAmount] = useState('');
    const [pricePerToken, setPricePerToken] = useState('');

    const fetchData = useCallback(() => {
        if (!assetId) return;
        setLoading(true);
        Promise.all([
            rwaApi.market.listings(assetId).then(r => setListings(r.data.listings || [])),
            rwaApi.market.trades(assetId).then(r => setTrades(r.data.trades || [])),
            rwaApi.assets.get(assetId).then(r => setAsset(r.data.asset)),
        ]).catch(() => {}).finally(() => setLoading(false));
    }, [assetId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreateListing = async () => {
        if (!tokenAmount || !pricePerToken || !address) return toast.error('Fill all fields');
        if (!marketEscrowAddress) return toast.error('RWA market escrow contract is not configured');
        if (!isConfiguredContractAddress(asset?.token_contract_address)) {
            return toast.error('Asset token contract is not deployed');
        }
        if (!/^\d+$/.test(tokenAmount) || Number(tokenAmount) <= 0) {
            return toast.error('Token amount must be a positive whole number');
        }
        try {
            setTxBusy(true);
            const wagmiConfig = getWagmiConfig();
            const amountWei = parseRwaWholeTokenAmount(tokenAmount);
            const priceWei = parseEther(pricePerToken).toString();
            const priceWeiBigInt = BigInt(priceWei);

            const approveHash = await writeContractAsync({
                address: asset.token_contract_address,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [marketEscrowAddress, amountWei],
            });
            await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

            const listingHash = await writeContractAsync({
                address: marketEscrowAddress,
                abi: ESCROW_ABI,
                functionName: 'listTokens',
                args: [asset.token_contract_address, amountWei, priceWeiBigInt],
            });
            const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: listingHash });
            const listedLogs = parseEventLogs({
                abi: ESCROW_ABI,
                eventName: 'Listed',
                logs: receipt.logs,
            }) as any[];
            const onchainListingId = listedLogs[0]?.args?.listingId;
            if (!onchainListingId) throw new Error('Listed event not found in receipt');

            await rwaApi.market.createListing(assetId!, {
                seller_address: address,
                token_amount: Number(tokenAmount),
                price_per_token_wei: priceWei,
                onchain_listing_id: Number(onchainListingId),
                listing_tx_hash: listingHash,
            });
            toast.success('Listing created!');
            setShowCreate(false);
            setTokenAmount(''); setPricePerToken('');
            fetchData();
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Failed to create listing');
        } finally {
            setTxBusy(false);
        }
    };

    const handleBuy = async (listing: any) => {
        if (!isConnected || !address) return toast.error('Connect wallet first');
        if (!marketEscrowAddress) return toast.error('RWA market escrow contract is not configured');
        if (!listing.onchain_listing_id) return toast.error('Listing is missing on-chain id');
        try {
            setTxBusy(true);
            const totalPriceWei = BigInt(listing.price_per_token_wei) * BigInt(listing.token_amount);
            const hash = await writeContractAsync({
                address: marketEscrowAddress,
                abi: ESCROW_ABI,
                functionName: 'buyListing',
                args: [BigInt(listing.onchain_listing_id)],
                value: totalPriceWei,
            });
            await waitForTransactionReceipt(getWagmiConfig(), { hash });
            await rwaApi.market.buy(listing.id, {
                buyer_address: address,
                trade_tx_hash: hash,
            });
            toast.success('Purchase successful!');
            fetchData();
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Purchase failed');
        } finally {
            setTxBusy(false);
        }
    };

    const handleCancel = async (listing: any) => {
        if (!marketEscrowAddress) return toast.error('RWA market escrow contract is not configured');
        if (!listing.onchain_listing_id) return toast.error('Listing is missing on-chain id');
        try {
            setTxBusy(true);
            const hash = await writeContractAsync({
                address: marketEscrowAddress,
                abi: ESCROW_ABI,
                functionName: 'cancelListing',
                args: [BigInt(listing.onchain_listing_id)],
            });
            await waitForTransactionReceipt(getWagmiConfig(), { hash });
            await rwaApi.market.cancelListing(listing.id, hash);
            toast.success('Listing cancelled');
            fetchData();
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Cancel failed');
        } finally {
            setTxBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1">
                {/* Header */}
                <div className="border-b border-border bg-gradient-to-br from-background via-emerald-500/5 to-background">
                    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
                        <Link href={`/assets/${assetId}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
                            <ChevronLeft className="w-3 h-3" /> Back to Asset
                        </Link>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <h1 className="text-2xl font-black flex items-center gap-3">
                                    <Store className="w-7 h-7 text-emerald-400" /> Secondary Market
                                </h1>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {asset?.name || 'Loading...'} — Buy & sell tokens P2P
                                </p>
                            </div>
                            {isConnected && marketEscrowAddress && (
                                <button onClick={() => setShowCreate(!showCreate)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold transition-all">
                                    <Plus className="w-4 h-4" /> Sell Tokens
                                </button>
                            )}
                        </div>
                        {!marketEscrowAddress && (
                            <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-300">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>Secondary market on-chain escrow is not configured. Set NEXT_PUBLIC_RWA_MARKET_ESCROW_ADDRESS to enable listing, buying, and cancelling.</span>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 mt-6 bg-muted/50 rounded-xl p-1 w-fit">
                            {(['listings', 'history'] as Tab[]).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize ${
                                        tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    }`}>
                                    {t === 'listings' ? '📋 Active Listings' : '📜 Trade History'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
                    {/* Create listing form */}
                    {showCreate && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-card border border-emerald-500/20 rounded-2xl p-6 space-y-4">
                            <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-400">Create Listing</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">Token Amount</label>
                                    <input value={tokenAmount} onChange={e => setTokenAmount(e.target.value)}
                                        type="number" placeholder="e.g. 100"
                                        className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">Price per Token (ETH)</label>
                                    <input value={pricePerToken} onChange={e => setPricePerToken(e.target.value)}
                                        type="number" step="0.001" placeholder="e.g. 0.01"
                                        className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm" />
                                </div>
                            </div>
                            {tokenAmount && pricePerToken && (
                                <p className="text-xs text-muted-foreground">
                                    Total: <span className="font-bold text-foreground">{(Number(tokenAmount) * Number(pricePerToken)).toFixed(4)} ETH</span>
                                </p>
                            )}
                            <div className="flex gap-3">
                                <button onClick={handleCreateListing}
                                    disabled={txBusy || !marketEscrowAddress}
                                    className="px-5 py-2 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                    {txBusy ? 'Confirming...' : 'List for Sale'}
                                </button>
                                <button onClick={() => setShowCreate(false)}
                                    className="px-5 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : tab === 'listings' ? (
                        /* ── Listings Tab ─────────────────────────────── */
                        listings.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <Store className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-semibold">No active listings</p>
                                <p className="text-sm mt-1">Be the first to list tokens for sale</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {listings.map((l, i) => {
                                    const totalEth = (Number(l.token_amount) * Number(formatEther(BigInt(l.price_per_token_wei)))).toFixed(4);
                                    const isSeller = address && l.seller_address.toLowerCase() === address.toLowerCase();
                                    return (
                                        <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-emerald-500/30 transition-colors">
                                            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                                                <Tag className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-bold text-sm">{Number(l.token_amount).toLocaleString()} tokens</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        by {l.seller_address.substring(0, 6)}...{l.seller_address.substring(38)}
                                                    </span>
                                                    {isSeller && (
                                                        <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                                                            YOUR LISTING
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>@ <strong className="text-foreground">{formatEther(BigInt(l.price_per_token_wei))} ETH</strong>/token</span>
                                                    <span>Total: <strong className="text-emerald-400">{totalEth} ETH</strong></span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(l.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            {isConnected && !isSeller && marketEscrowAddress && (
                                                <button onClick={() => handleBuy(l)}
                                                    disabled={txBusy || !l.onchain_listing_id}
                                                    className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                                                    Buy
                                                </button>
                                            )}
                                            {isSeller && marketEscrowAddress && (
                                                <button onClick={() => handleCancel(l)}
                                                    disabled={txBusy || !l.onchain_listing_id}
                                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                                                    <X className="w-3 h-3 inline mr-1" /> Cancel
                                                </button>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        /* ── Trade History Tab ────────────────────────── */
                        trades.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-semibold">No trades yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {trades.map((t, i) => (
                                    <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-sm">
                                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold">{Number(t.token_amount).toLocaleString()} tokens</span>
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                {t.seller_address?.substring(0, 6)}... → {t.buyer_address?.substring(0, 6)}...
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{new Date(t.traded_at).toLocaleDateString()}</span>
                                        <span className="text-xs font-bold text-emerald-400">
                                            {formatEther(BigInt(t.total_price_wei || '0'))} ETH
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
