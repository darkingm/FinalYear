'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Vote, Clock, CheckCircle, XCircle, AlertCircle,
    Plus, ChevronLeft, Users, Loader2, ArrowRight,
} from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { parseAbi, parseEventLogs } from 'viem';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getWagmiConfig } from '@/lib/web3/config';
import { isConfiguredContractAddress } from '@/lib/rwa/onchain';

const GOV_ABI = parseAbi([
    // Use 4-param version — the 3-param overload has a msg.sender bug in the contract
    'function createProposal(uint8 pType, string description, string ipfsDoc, bytes32 executionHash) external returns (uint256)',
    'function castVote(uint256 proposalId, bool support) external',
    'function executeProposal(uint256 proposalId) external',
    'function getVotingPower(address voter, uint256 proposalId) view returns (uint256)',
    'function getProposal(uint256 id) view returns ((uint256 id,address proposer,uint8 proposalType,string description,string ipfsDoc,bytes32 executionHash,uint256 snapshotBlock,uint256 forVotes,uint256 againstVotes,uint256 deadline,uint8 status,bool executed))',
    'event ProposalCreated(uint256 indexed id, address indexed proposer, uint8 pType, string description, bytes32 executionHash, uint256 deadline)',
    'event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)',
]);
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const PROPOSAL_TYPES = [
    { value: 'GENERAL', label: 'General', typeIndex: 0 },
    { value: 'UPDATE_VALUATION', label: 'Update Valuation', typeIndex: 1 },
    { value: 'DISTRIBUTE_PROFIT', label: 'Distribute Profit', typeIndex: 2 },
    { value: 'SELL_ASSET', label: 'Sell Asset', typeIndex: 3 },
    { value: 'INITIATE_BUYOUT', label: 'Initiate Buyout', typeIndex: 4 },
    { value: 'REPLACE_OPERATOR', label: 'Replace Operator', typeIndex: 5 },
];

const STATUS_STYLE: Record<string, string> = {
    ACTIVE: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    PASSED: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    REJECTED: 'bg-red-400/10 text-red-400 border-red-400/20',
    EXECUTED: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
    CANCELLED: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] || ''}`}>
            {status === 'ACTIVE' && <Clock className="w-3 h-3" />}
            {status === 'PASSED' && <CheckCircle className="w-3 h-3" />}
            {status === 'REJECTED' && <XCircle className="w-3 h-3" />}
            {status}
        </span>
    );
}

function TimeRemaining({ deadline }: { deadline: string }) {
    const now = Date.now();
    const end = new Date(deadline).getTime();
    const diff = end - now;
    if (diff <= 0) return <span className="text-red-400 text-xs font-bold">Voting ended</span>;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return <span className="text-blue-400 text-xs font-bold">{hours}h {mins}m remaining</span>;
}

export default function GovernancePage() {
    const { id: assetId } = useParams<{ id: string }>();
    const router = useRouter();
    const { address, isConnected } = useAccount();
    const { writeContractAsync, isPending } = useWriteContract();

    const [proposals, setProposals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [asset, setAsset] = useState<any>(null);
    const [txBusy, setTxBusy] = useState(false);

    // Create form
    const [newType, setNewType] = useState('GENERAL');
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const fetchData = useCallback(() => {
        if (!assetId) return;
        setLoading(true);
        Promise.all([
            rwaApi.governance.proposals(assetId).then(r => setProposals(r.data.proposals || [])),
            rwaApi.assets.get(assetId).then(r => setAsset(r.data.asset)),
        ]).catch(() => {}).finally(() => setLoading(false));
    }, [assetId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreateProposal = async () => {
        if (!isConnected || !address) return toast.error('Connect wallet first');
        if (!newTitle.trim()) return toast.error('Title is required');
        if (!isConfiguredContractAddress(asset?.governance_contract_address)) {
            return toast.error('This asset has no on-chain governance contract');
        }
        const proposalType = PROPOSAL_TYPES.find(t => t.value === newType);
        if (!proposalType) return toast.error('Invalid proposal type');
        if (['SELL_ASSET', 'INITIATE_BUYOUT'].includes(newType)) {
            return toast.error('Actionable proposals need an execution hash flow before they can be submitted');
        }
        try {
            setTxBusy(true);
            const hash = await writeContractAsync({
                address: asset.governance_contract_address,
                abi: GOV_ABI,
                functionName: 'createProposal',
                args: [proposalType.typeIndex, newDesc || newTitle, '', ZERO_BYTES32],
            });
            const receipt = await waitForTransactionReceipt(getWagmiConfig(), { hash });
            const createdLogs = parseEventLogs({
                abi: GOV_ABI,
                eventName: 'ProposalCreated',
                logs: receipt.logs,
            }) as any[];
            const onchainId = createdLogs[0]?.args?.id;
            if (!onchainId) throw new Error('ProposalCreated event not found in receipt');

            await rwaApi.governance.createProposal(assetId!, {
                proposer_address: address,
                proposal_type: newType,
                title: newTitle,
                description: newDesc,
                onchain_id: Number(onchainId),
                tx_hash: hash,
            });
            toast.success('Proposal created!');
            setShowCreate(false);
            setNewTitle(''); setNewDesc('');
            fetchData();
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Failed to create proposal');
        } finally {
            setTxBusy(false);
        }
    };

    const handleVote = async (proposal: any, support: boolean) => {
        if (!isConnected || !address) return toast.error('Connect wallet first');
        if (!isConfiguredContractAddress(asset?.governance_contract_address)) {
            return toast.error('This asset has no on-chain governance contract');
        }
        if (!proposal.onchain_id) return toast.error('Proposal is missing on-chain id');
        try {
            setTxBusy(true);
            const hash = await writeContractAsync({
                address: asset.governance_contract_address,
                abi: GOV_ABI,
                functionName: 'castVote',
                args: [BigInt(proposal.onchain_id), support],
            });
            await waitForTransactionReceipt(getWagmiConfig(), { hash });
            await rwaApi.governance.vote(proposal.id, {
                voter_address: address,
                support,
                weight: 1,
                tx_hash: hash,
            });
            toast.success(`Vote ${support ? 'FOR' : 'AGAINST'} recorded!`);
            fetchData();
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Failed to vote');
        } finally {
            setTxBusy(false);
        }
    };

    const handleFinalizeProposal = async (proposal: any) => {
        if (!isConnected || !address) return toast.error('Connect wallet first');
        if (!isConfiguredContractAddress(asset?.governance_contract_address)) {
            return toast.error('This asset has no on-chain governance contract');
        }
        if (!proposal.onchain_id) return toast.error('Proposal is missing on-chain id');
        try {
            setTxBusy(true);
            const hash = await writeContractAsync({
                address: asset.governance_contract_address,
                abi: GOV_ABI,
                functionName: 'executeProposal',
                args: [BigInt(proposal.onchain_id)],
            });
            await waitForTransactionReceipt(getWagmiConfig(), { hash });

            const onChainProposal = await readContract(getWagmiConfig(), {
                address: asset.governance_contract_address,
                abi: GOV_ABI,
                functionName: 'getProposal',
                args: [BigInt(proposal.onchain_id)],
            }) as any;
            const statusIndex = Number(onChainProposal.status ?? onChainProposal[9]);
            const finalStatus = statusIndex === 1 ? 'PASSED' : statusIndex === 2 ? 'REJECTED' : null;
            if (!finalStatus) throw new Error('On-chain proposal did not finalize to PASSED or REJECTED');

            await rwaApi.governance.execute(proposal.id, {
                execute_tx_hash: hash,
                final_status: finalStatus,
            });
            toast.success(`Proposal finalized as ${finalStatus}`);
            fetchData();
        } catch (err: any) {
            toast.error(err.shortMessage || err.response?.data?.error || err.message || 'Failed to finalize proposal');
        } finally {
            setTxBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1">
                {/* Header */}
                <div className="border-b border-border bg-gradient-to-br from-background via-violet-500/5 to-background">
                    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
                        <Link href={`/assets/${assetId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
                            <ChevronLeft className="w-3 h-3" /> Back to Asset
                        </Link>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <h1 className="text-2xl font-black flex items-center gap-3">
                                    <Vote className="w-7 h-7 text-violet-400" /> Governance
                                </h1>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {asset?.name || 'Loading...'} — Token holder proposals & voting
                                </p>
                            </div>
                            {isConnected && isConfiguredContractAddress(asset?.governance_contract_address) && (
                                <button onClick={() => setShowCreate(!showCreate)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-xl text-sm font-bold transition-all">
                                    <Plus className="w-4 h-4" /> New Proposal
                                </button>
                            )}
                        </div>
                        {!isConfiguredContractAddress(asset?.governance_contract_address) && (
                            <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-300">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>This asset has no on-chain governance contract. Governance actions are locked to prevent DB-only proposals/votes.</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
                    {/* Create form */}
                    {showCreate && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-card border border-violet-500/20 rounded-2xl p-6 space-y-4">
                            <h2 className="font-bold text-sm uppercase tracking-wider text-violet-400">Create Proposal</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">Type</label>
                                    <select value={newType} onChange={e => setNewType(e.target.value)}
                                        className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm">
                                        {PROPOSAL_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">Title</label>
                                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                        placeholder="e.g. Distribute Q2 profits"
                                        className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Description</label>
                                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
                                    placeholder="Detailed description of your proposal..."
                                    className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm resize-none" />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleCreateProposal}
                                    disabled={txBusy}
                                    className="px-5 py-2 bg-violet-500 text-white font-bold text-sm rounded-xl hover:bg-violet-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                    {txBusy ? 'Confirming...' : 'Submit Proposal'}
                                </button>
                                <button onClick={() => setShowCreate(false)}
                                    className="px-5 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Proposals list */}
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : proposals.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            <Vote className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="text-lg font-semibold">No proposals yet</p>
                            <p className="text-sm mt-1">Be the first to create a governance proposal</p>
                        </div>
                    ) : (
                        proposals.map((p, i) => {
                            const totalVotes = Number(p.for_votes) + Number(p.against_votes);
                            const forPercent = totalVotes > 0 ? (Number(p.for_votes) / totalVotes) * 100 : 0;
                            const againstPercent = totalVotes > 0 ? (Number(p.against_votes) / totalVotes) * 100 : 0;
                            const isActive = p.status === 'ACTIVE' && new Date(p.voting_deadline) > new Date();
                            const canFinalize = p.status === 'ACTIVE'
                                && new Date(p.voting_deadline) <= new Date()
                                && isConnected
                                && isConfiguredContractAddress(asset?.governance_contract_address)
                                && p.onchain_id;
                            const isSupermajority = ['SELL_ASSET', 'INITIATE_BUYOUT', 'REPLACE_OPERATOR'].includes(p.proposal_type);

                            return (
                                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-card border border-border rounded-2xl p-6 hover:border-violet-500/30 transition-colors">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <StatusBadge status={p.status} />
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-0.5 bg-muted rounded-full">
                                                    {p.proposal_type.replace(/_/g, ' ')}
                                                </span>
                                                {isSupermajority && (
                                                    <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                                                        67% required
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-sm">{p.title}</h3>
                                            {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                                        </div>
                                        <TimeRemaining deadline={p.voting_deadline} />
                                    </div>

                                    {/* Vote progress */}
                                    <div className="space-y-2 mt-4">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-emerald-400 font-bold">For: {forPercent.toFixed(1)}%</span>
                                            <span className="text-muted-foreground">{p.vote_count || 0} votes</span>
                                            <span className="text-red-400 font-bold">Against: {againstPercent.toFixed(1)}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                                            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${forPercent}%` }} />
                                            <div className="h-full bg-red-400 transition-all" style={{ width: `${againstPercent}%` }} />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Quorum: {p.quorum_required}%</span>
                                            <span>Proposer: {p.proposer_address?.substring(0, 6)}...{p.proposer_address?.substring(38)}</span>
                                        </div>
                                    </div>

                                    {/* Vote buttons */}
                                    {isActive && isConnected && isConfiguredContractAddress(asset?.governance_contract_address) && (
                                        <div className="flex gap-3 mt-4 pt-3 border-t border-border">
                                            <button onClick={() => handleVote(p, true)}
                                                disabled={txBusy || !p.onchain_id}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                                <CheckCircle className="w-3.5 h-3.5" /> Vote For
                                            </button>
                                            <button onClick={() => handleVote(p, false)}
                                                disabled={txBusy || !p.onchain_id}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                                <XCircle className="w-3.5 h-3.5" /> Vote Against
                                            </button>
                                        </div>
                                    )}
                                    {canFinalize && (
                                        <button onClick={() => handleFinalizeProposal(p)}
                                            disabled={txBusy}
                                            className="w-full mt-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                            {txBusy ? 'Finalizing...' : 'Finalize on-chain result'}
                                        </button>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
