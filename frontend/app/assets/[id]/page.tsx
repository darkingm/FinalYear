'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    FileText, Shield, Percent, Users, Coins, ArrowLeft,
    DollarSign, Wallet, Loader2, CheckCircle2, ExternalLink,
    Building, TrendingUp, Info, Lock, AlertCircle, RefreshCw,
    TrendingDown, Gift,
} from 'lucide-react';
import Link from 'next/link';
import {
    useAccount, useWriteContract, useWaitForTransactionReceipt,
    useReadContract, useSendTransaction,
} from 'wagmi';
import { parseAbi, parseUnits, formatUnits, isAddress } from 'viem';
import { useSession } from 'next-auth/react';
import { rwaApi } from '@/lib/api/rwa';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { RWAAsset } from '../page';

/* ── ABIs ───────────────────────────────────────────────────────────────── */
const ERC20_ABI = parseAbi([
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
]);

const RWA_TOKEN_ABI = parseAbi([
    'function mint(address to, uint256 amount) external',
    'function balanceOf(address account) view returns (uint256)',
    'function tokensAvailable() view returns (uint256)',
    'function pricePerTokenUSD() view returns (uint256)',
    'function claimReward() external',
]);

const TYPE_COLOR: Record<string, string> = {
    REAL_ESTATE: 'text-blue-400',
    BOND: 'text-amber-400',
    EQUITY: 'text-emerald-400',
    COMMODITY: 'text-orange-400',
};

const TYPE_BG: Record<string, string> = {
    REAL_ESTATE: 'from-blue-500/10 to-blue-500/5',
    BOND: 'from-amber-500/10 to-amber-500/5',
    EQUITY: 'from-emerald-500/10 to-emerald-500/5',
    COMMODITY: 'from-orange-500/10 to-orange-500/5',
};

/* ─── Invest Panel ──────────────────────────────────────────────────────── */
function InvestPanel({ asset, kycStatus, onInvestSuccess }: {
    asset: RWAAsset;
    kycStatus: boolean;
    onInvestSuccess: () => void;
}) {
    const { address, isConnected } = useAccount();
    const { data: session } = useSession();

    const [tokenAmount, setTokenAmount] = useState(1);
    const [step, setStep] = useState<'idle' | 'approving' | 'purchasing' | 'done'>('idle');
    const [pendingReward, setPendingReward] = useState<string | null>(null);

    const totalCostUsd = tokenAmount * Number(asset.price_per_token_usd);
    const tokenContractAddress = (asset as any).token_address as `0x${string}` | undefined;

    // Read user's RWA token balance
    const { data: userTokenBalance } = useReadContract({
        address: tokenContractAddress,
        abi: RWA_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!tokenContractAddress && !!address },
    });

    /* ── Mint via backend (admin-minted for FYP) ─────────────────────────── */
    const handleInvest = useCallback(async () => {
        if (!isConnected || !address) return toast.error('Vui lòng kết nối ví MetaMask trước');
        if (!kycStatus) return toast.error('Cần xác minh KYC để đầu tư');
        if (!session) return toast.error('Vui lòng đăng nhập');
        if (tokenAmount <= 0) return toast.error('Số lượng token phải > 0');

        const remaining = asset.total_tokens - asset.tokens_sold;
        if (tokenAmount > remaining) return toast.error(`Chỉ còn ${remaining} token khả dụng`);

        setStep('purchasing');
        try {
            await rwaApi.portfolio.purchase({
                asset_id: asset.asset_id,
                user_id: (session as any)?.user?.id,
                wallet_address: address,
                token_amount: tokenAmount,
                cost_usd: totalCostUsd,
            });
            setStep('done');
            toast.success(`🎉 Đầu tư thành công! ${tokenAmount} ${asset.symbol} token đã được phát hành vào ví của bạn!`);
            onInvestSuccess();
        } catch (e: any) {
            setStep('idle');
            const msg = e.response?.data?.error || e.message || 'Đầu tư thất bại';
            toast.error(msg);
        }
    }, [isConnected, address, kycStatus, session, tokenAmount, asset, totalCostUsd, onInvestSuccess]);

    /* ── Claim reward ─────────────────────────────────────────────────────── */
    const { writeContractAsync, isPending: claimPending } = useWriteContract();

    const handleClaimReward = useCallback(async () => {
        if (!tokenContractAddress || !address) return;
        try {
            await writeContractAsync({
                address: tokenContractAddress,
                abi: RWA_TOKEN_ABI,
                functionName: 'claimReward',
            });
            toast.success('Phần thưởng đã được chuyển về ví!');
        } catch (e: any) {
            toast.error(e.shortMessage || 'Không thể claim phần thưởng');
        }
    }, [tokenContractAddress, address, writeContractAsync]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-card border border-border rounded-2xl p-6 sticky top-24 space-y-5"
        >
            <h2 className="font-black text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#f0b90b]" /> Đầu tư ngay
            </h2>

            {/* User holding */}
            {isConnected && userTokenBalance !== undefined && (
                <div className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl p-3 text-sm flex items-center gap-2">
                    <Coins className="w-4 h-4 text-[#f0b90b]" />
                    <span>Đang nắm giữ: <span className="font-black text-[#f0b90b]">{userTokenBalance.toString()} {asset.symbol}</span></span>
                </div>
            )}

            {/* Token amount control */}
            <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Số lượng Token</label>
                <div className="flex items-center border border-border rounded-xl overflow-hidden">
                    <button
                        onClick={() => setTokenAmount(v => Math.max(1, v - 1))}
                        className="px-4 py-3 bg-muted hover:bg-muted/70 font-bold text-xl transition-colors select-none"
                    >−</button>
                    <input
                        type="number"
                        value={tokenAmount}
                        onChange={e => setTokenAmount(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        className="flex-1 text-center bg-transparent py-3 font-bold text-xl focus:outline-none"
                    />
                    <button
                        onClick={() => setTokenAmount(v => v + 1)}
                        className="px-4 py-3 bg-muted hover:bg-muted/70 font-bold text-xl transition-colors select-none"
                    >+</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {[1, 5, 10, 50].map(n => (
                        <button key={n} onClick={() => setTokenAmount(n)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${tokenAmount === n
                                ? 'bg-[#f0b90b]/15 border-[#f0b90b]/40 text-[#f0b90b]'
                                : 'border-border hover:border-muted-foreground'}`}>
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            {/* Price breakdown */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá / token</span>
                    <span className="font-semibold">${Number(asset.price_per_token_usd).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Số lượng</span>
                    <span className="font-semibold">× {tokenAmount}</span>
                </div>
                {asset.expected_apy && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">APY dự kiến</span>
                        <span className="font-semibold text-emerald-400">{Number(asset.expected_apy).toFixed(1)}% / năm</span>
                    </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between">
                    <span className="font-bold">Tổng cộng</span>
                    <span className="font-black text-[#f0b90b] text-xl">${totalCostUsd.toLocaleString()}</span>
                </div>
            </div>

            {/* Status messages */}
            {!isConnected ? (
                <div className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 flex gap-2 items-start">
                    <Wallet className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Kết nối ví MetaMask để đầu tư</span>
                </div>
            ) : !session ? (
                <div className="text-sm text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-xl p-3 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Đăng nhập tài khoản để đầu tư</span>
                </div>
            ) : !kycStatus ? (
                <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3 flex gap-2 items-start">
                    <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Cần xác minh KYC (eKYC). Liên hệ admin để kích hoạt.</span>
                </div>
            ) : step === 'done' ? (
                <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 flex gap-2 items-start">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Đầu tư thành công! Token đã được phát hành vào ví của bạn.</span>
                </div>
            ) : (
                <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-3 flex gap-2 items-start">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>KYC đã xác minh — sẵn sàng đầu tư</span>
                </div>
            )}

            {/* Invest Button */}
            <button
                onClick={handleInvest}
                disabled={step !== 'idle' || !isConnected || !kycStatus || !session || tokenAmount <= 0}
                className="w-full py-3.5 bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-black font-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base shadow-lg shadow-yellow-500/20"
            >
                {step === 'purchasing' ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Đang xử lý...</>
                ) : step === 'done' ? (
                    <><CheckCircle2 className="w-5 h-5" /> Đầu tư thêm</>
                ) : (
                    <><Coins className="w-5 h-5" /> Đầu tư ${totalCostUsd.toLocaleString()}</>
                )}
            </button>

            {/* Claim Reward button */}
            {isConnected && tokenContractAddress && (
                <button
                    onClick={handleClaimReward}
                    disabled={claimPending}
                    className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2 text-sm"
                >
                    {claimPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    Claim phần thưởng (dividends)
                </button>
            )}

            {/* Disclaimer */}
            <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Token phát hành on-chain sau khi xác nhận thanh toán</div>
                <div className="flex items-start gap-2"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Lợi nhuận tự động phân phối cho holder theo tỷ lệ nắm giữ</div>
                <div className="flex items-start gap-2"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Đây là hệ thống FYP thử nghiệm — không dùng tiền thật</div>
            </div>
        </motion.div>
    );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function AssetDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { address } = useAccount();

    const [asset, setAsset] = useState<RWAAsset | null>(null);
    const [loading, setLoading] = useState(true);
    const [kycStatus, setKycStatus] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [distributions, setDistributions] = useState<any[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchData = useCallback(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([
            rwaApi.assets.get(id as string).then(r => setAsset(r.data.asset)).catch(() => { }),
            rwaApi.profit.stats(id as string).then(r => setStats(r.data.stats)).catch(() => { }),
            rwaApi.profit.history(id as string).then(r => setDistributions(r.data.distributions || [])).catch(() => { }),
        ]).finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

    useEffect(() => {
        if (!address) return;
        rwaApi.kyc.status(address).then(r => setKycStatus(r.data.verified)).catch(() => { });
    }, [address]);

    if (loading) return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header />
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#f0b90b]" />
            </div>
        </div>
    );

    if (!asset) return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header />
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <AlertCircle className="w-16 h-16 text-muted-foreground/30" />
                <p className="text-xl font-bold">Không tìm thấy tài sản</p>
                <Link href="/assets" className="text-[#f0b90b] hover:underline flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Quay lại thị trường
                </Link>
            </div>
        </div>
    );

    const progress = (asset.tokens_sold / asset.total_tokens) * 100;
    const typeMeta = { REAL_ESTATE: 'Bất động sản', BOND: 'Trái phiếu', EQUITY: 'Cổ phần', COMMODITY: 'Hàng hóa' };

    return (
        <div className="min-h-screen bg-background flex flex-col relative">
            <Header />

            <main className="flex-1">
                {/* Breadcrumb */}
                <div className="border-b border-border">
                    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4">
                        <Link href="/assets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Thị trường RWA
                        </Link>
                    </div>
                </div>

                {/* Hero banner */}
                <div className={`bg-gradient-to-br ${TYPE_BG[asset.asset_type] || 'from-muted/20 to-muted/5'} border-b border-border`}>
                    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`text-xs font-bold uppercase tracking-wider ${TYPE_COLOR[asset.asset_type]}`}>
                                    {typeMeta[asset.asset_type] || asset.asset_type}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md">{asset.symbol}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${asset.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                                    {asset.status === 'ACTIVE' ? '● Đang mở' : asset.status}
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black leading-tight">{asset.name}</h1>
                            {asset.location && <p className="text-muted-foreground mt-2">📍 {asset.location}</p>}
                        </motion.div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ── LEFT ─────────────────────────────────────────────── */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Key metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Định giá', value: `$${Number(asset.total_valuation_usd).toLocaleString()}`, icon: <DollarSign className="w-4 h-4" /> },
                                { label: 'Giá / token', value: `$${Number(asset.price_per_token_usd).toLocaleString()}`, icon: <Coins className="w-4 h-4" />, gold: true },
                                { label: 'APY dự kiến', value: asset.expected_apy ? `${Number(asset.expected_apy).toFixed(1)}%` : 'N/A', icon: <Percent className="w-4 h-4" />, green: true },
                                { label: 'Nhà đầu tư', value: String(asset.holder_count ?? '—'), icon: <Users className="w-4 h-4" /> },
                            ].map(m => (
                                <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors">
                                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">{m.icon} {m.label}</div>
                                    <p className={`text-xl font-black ${m.gold ? 'text-[#f0b90b]' : m.green ? 'text-emerald-400' : ''}`}>{m.value}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Funding progress */}
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#f0b90b]" /> Tiến độ huy động vốn</h2>
                                <span className="font-black text-lg">{progress.toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-[#f0b90b] to-[#f0b90b]/60 rounded-full"
                                    initial={{ width: 0 }} animate={{ width: `${Math.min(progress, 100)}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span className="font-semibold text-[#f0b90b]">{asset.tokens_sold.toLocaleString()} đã bán</span>
                                <span>{(asset.total_tokens - asset.tokens_sold).toLocaleString()} còn lại / {asset.total_tokens.toLocaleString()} tổng</span>
                            </div>
                        </div>

                        {/* Description */}
                        {asset.description && (
                            <div className="bg-card border border-border rounded-2xl p-6">
                                <h2 className="font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Về tài sản này</h2>
                                <p className="text-sm leading-relaxed">{asset.description}</p>
                            </div>
                        )}

                        {/* Profit stats */}
                        {stats && (
                            <div className="bg-card border border-border rounded-2xl p-6">
                                <h2 className="font-bold mb-4 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Gift className="w-4 h-4 text-emerald-400" /> Thống kê lợi nhuận
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Tổng đã phân phối', value: `${Number(stats.total_distributed || 0).toFixed(4)} ETH`, green: true },
                                        { label: 'Số lần phân phối', value: String(stats.distribution_count || 0) },
                                        { label: 'Tổng giá trị (USD)', value: `$${Number(stats.total_distributed_usd || 0).toLocaleString()}`, gold: true },
                                    ].map(s => (
                                        <div key={s.label} className="bg-muted/50 rounded-xl p-3">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{s.label}</p>
                                            <p className={`font-black text-base ${s.green ? 'text-emerald-400' : s.gold ? 'text-[#f0b90b]' : ''}`}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Distribution history */}
                        {distributions.length > 0 && (
                            <div className="bg-card border border-border rounded-2xl p-6">
                                <h2 className="font-bold mb-4 text-sm text-muted-foreground uppercase tracking-wider">Lịch sử phân phối lợi nhuận</h2>
                                <div className="space-y-2">
                                    {distributions.slice(0, 8).map((d, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm py-2.5 border-b border-border last:border-0">
                                            <span className="text-muted-foreground">{d.period_description || `Lần ${i + 1}`}</span>
                                            <span className="font-bold text-emerald-400">+{Number(d.amount_eth || 0).toFixed(6)} ETH</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Legal doc */}
                        {asset.legal_doc_ipfs && (
                            <a href={`https://ipfs.io/ipfs/${asset.legal_doc_ipfs}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl text-sm hover:border-primary/30 transition-colors group">
                                <Shield className="w-5 h-5 text-[#f0b90b] flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-semibold">Tài liệu pháp lý</p>
                                    <p className="text-xs text-muted-foreground">Đã xác minh trên IPFS</p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </a>
                        )}
                    </div>

                    {/* ── RIGHT: Invest Panel ───────────────────────────────── */}
                    <div>
                        <InvestPanel
                            asset={asset}
                            kycStatus={kycStatus}
                            onInvestSuccess={() => setRefreshKey(k => k + 1)}
                        />
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
