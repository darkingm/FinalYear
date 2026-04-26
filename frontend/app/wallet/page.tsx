'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient, paymentClient } from '@/lib/api/client';
import { getRecommendedCheckoutChainMetas } from '@/lib/web3/testnet-lite';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useAccount, useSignMessage, useBalance, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Copy, QrCode, Link2, Trash2, Star,
  ChevronDown, ChevronUp, RefreshCw, Clock, CheckCircle,
  AlertCircle, Loader2, Shield, ArrowDownToLine, ExternalLink,
  Plus, Info, Zap, Pencil, Banknote, ShieldCheck,
} from 'lucide-react';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';
import { NetworkDiagnostics } from '@/components/web3/NetworkDiagnostics';
import {
  DepositInvoiceCard,
  PastIntentsList,
  type DepositIntent,
  type ChainToken,
} from '@/components/wallet/DepositInvoice';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface UserWallet {
  wallet_db_id: number;
  chain_type: string;
  chain_id: number | null;
  address: string;
  label: string | null;
  is_primary: boolean;
  is_verified?: boolean;
  chain_info: { name: string; type: string; symbol: string; explorer?: string };
  created_at: string;
}

interface SellerPayoutInfo {
  is_seller: boolean;
  payout_wallet: string | null;
}

interface Deposit {
  deposit_id: number;
  tx_hash: string;
  chain_id: number;
  amount: string;
  symbol: string;
  chain_name: string;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

/* ─── Testnet network definitions ────────────────────────────────────────── */
const TESTNET_NETWORKS = getRecommendedCheckoutChainMetas().map((network) => ({
  chainId: network.chainId,
  name: network.name,
  symbol: network.nativeSymbol,
  icon: network.icon,
  rpcUrl: network.rpcUrl || '',
  color: network.mode === 'demo'
    ? '#22c55e'
    : network.mode === 'primary'
      ? '#3b82f6'
      : network.mode === 'secondary'
        ? '#8247e5'
        : '#f0b90b',
  badge: network.badge,
  tokens: [network.nativeSymbol],
  note: network.description,
  faucet: network.faucetUrl,
}));

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`Đã sao chép ${label}`);
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

/* ─── Balance display per wallet (uses wallet's saved chainId, falls back to current) ────── */
function WalletBalanceDisplay({ address, chainId }: { address: string; chainId?: number | null }) {
  const { data, isLoading } = useBalance({
    address: address as `0x${string}`,
    chainId: chainId ?? undefined,
  });
  if (isLoading) return <span className="text-[10px] text-muted-foreground animate-pulse">Loading...</span>;
  if (!data) return <span className="text-[10px] text-muted-foreground">—</span>;
  const val = parseFloat(data.formatted);
  const display = val >= 1000 ? val.toLocaleString('en-US', { maximumFractionDigits: 2 }) : val >= 0.01 ? val.toFixed(4) : val.toFixed(6);
  return (
    <span className="text-xs font-bold text-emerald-400">
      {display} <span className="text-muted-foreground font-normal">{data.symbol}</span>
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function WalletPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, reauthRequired } = useAuth();
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();

  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'history'>('qr');
  const [selectedQRWallet, setSelectedQRWallet] = useState<UserWallet | null>(null);
  const [expandedNetwork, setExpandedNetwork] = useState<number | null>(31337);
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [sellerInfo, setSellerInfo] = useState<SellerPayoutInfo>({ is_seller: false, payout_wallet: null });

  // Deposit invoice state
  const [intents, setIntents] = useState<DepositIntent[]>([]);
  const [activeIntent, setActiveIntent] = useState<DepositIntent | null>(null);
  const [tokensByChain, setTokensByChain] = useState<Record<number, ChainToken[]>>({});
  const [formChainId, setFormChainId] = useState<number>(31337);
  const [formTokenId, setFormTokenId] = useState<number | ''>('');
  const [formAmount, setFormAmount] = useState('');
  const [formFromWalletId, setFormFromWalletId] = useState<number | ''>('');
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /* ─── Auth guard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(buildLoginRedirectUrl('/wallet', reauthRequired ? 'reauth_required' : undefined));
    }
  }, [authLoading, isAuthenticated, router, reauthRequired]);

  /* ─── Load data ──────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [walletsRes, depositsRes, profileRes] = await Promise.allSettled([
        apiClient.get('/api/wallets'),
        apiClient.get('/api/wallets/deposits'),
        apiClient.get('/api/users/profile'),
      ]);
      if (walletsRes.status === 'fulfilled') {
        const raw = walletsRes.value.data;
        // Backend now returns { success, data: [...] }; keep legacy fallbacks for safety.
        const ws: UserWallet[] = Array.isArray(raw) ? raw
          : Array.isArray(raw?.data) ? raw.data
            : Array.isArray(raw?.wallets) ? raw.wallets
              : [];
        setWallets(ws);
        const primary = ws.find(w => w.is_primary) || ws[0];
        if (primary && !selectedQRWallet) setSelectedQRWallet(primary);
      }
      if (depositsRes.status === 'fulfilled') {
        const raw = depositsRes.value.data;
        setDeposits(
          Array.isArray(raw) ? raw
            : Array.isArray(raw?.data) ? raw.data
              : Array.isArray(raw?.deposits) ? raw.deposits
                : []
        );
      }
      if (profileRes.status === 'fulfilled') {
        const u = profileRes.value.data?.user || profileRes.value.data?.data || profileRes.value.data;
        if (u) {
          setSellerInfo({
            is_seller: !!(u.role === 'seller' || u.role === 'admin' || u.is_seller || u.seller_id),
            payout_wallet: u.payout_wallet ?? u.seller?.payout_wallet ?? null,
          });
        }
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Load deposit intents ──────────────────────────────────────────── */
  const fetchIntents = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiClient.get('/api/wallets/deposit-intents');
      const raw = res.data;
      const list: DepositIntent[] = Array.isArray(raw) ? raw
        : Array.isArray(raw?.data) ? raw.data : [];
      setIntents(list);
      // If activeIntent is shown, refresh it from the latest list
      setActiveIntent(prev => prev ? (list.find(i => i.intent_id === prev.intent_id) || null) : null);
    } catch { /* silent */ }
  }, [isAuthenticated]);

  useEffect(() => { fetchIntents(); }, [fetchIntents]);

  /* ─── Live tick for countdown + auto-refresh while pending intent open ── */
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!activeIntent || activeIntent.status !== 'pending') return;
    const poll = setInterval(() => {
      fetchIntents();
      fetchData();
    }, 5000);
    return () => clearInterval(poll);
  }, [activeIntent, fetchIntents, fetchData]);

  /* ─── Load tokens for a chain (cached) ──────────────────────────────── */
  const loadTokens = useCallback(async (chainId: number) => {
    if (tokensByChain[chainId]) return tokensByChain[chainId];
    setTokenLoading(true);
    try {
      const res = await apiClient.get(`/api/wallets/chains/${chainId}/tokens`);
      const raw = res.data;
      const list: ChainToken[] = Array.isArray(raw) ? raw
        : Array.isArray(raw?.data) ? raw.data : [];
      setTokensByChain(prev => ({ ...prev, [chainId]: list }));
      return list;
    } catch {
      return [];
    } finally {
      setTokenLoading(false);
    }
  }, [tokensByChain]);

  useEffect(() => { loadTokens(formChainId); }, [formChainId, loadTokens]);

  /* ─── Create deposit intent ─────────────────────────────────────────── */
  const handleCreateIntent = async () => {
    if (!formTokenId || !formAmount || !formFromWalletId) {
      toast.error('Vui lòng nhập đủ token, số lượng và ví gửi');
      return;
    }
    const wallet = wallets.find(w => w.wallet_db_id === formFromWalletId);
    if (!wallet) { toast.error('Ví gửi không hợp lệ'); return; }
    if (!wallet.is_verified) { toast.error('Ví gửi phải được xác thực trước. Hãy liên kết lại bằng MetaMask.'); return; }
    const amountNum = Number(formAmount);
    if (!isFinite(amountNum) || amountNum <= 0) {
      toast.error('Số lượng không hợp lệ');
      return;
    }
    setCreatingIntent(true);
    try {
      const res = await apiClient.post('/api/wallets/deposit-intents', {
        chain_id: formChainId,
        token_id: formTokenId,
        amount: formAmount,
        from_address: wallet.address,
        ttl_minutes: 15,
      });
      const intent: DepositIntent = res.data?.data || res.data;
      setActiveIntent(intent);
      setIntents(prev => [intent, ...prev.filter(i => i.intent_id !== intent.intent_id)]);
      setFormAmount('');
      toast.success('Đã tạo phiếu nạp tiền — quét QR để gửi');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Tạo phiếu nạp thất bại');
    } finally {
      setCreatingIntent(false);
    }
  };

  const handleCancelIntent = async (id: number) => {
    if (!confirm('Huỷ phiếu nạp này?')) return;
    try {
      await apiClient.delete(`/api/wallets/deposit-intents/${id}`);
      toast.success('Đã huỷ phiếu nạp');
      if (activeIntent?.intent_id === id) setActiveIntent(null);
      fetchIntents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Huỷ phiếu nạp thất bại');
    }
  };

  /* ─── Detect MetaMask account switch ───────────────────────────────── */
  const prevAddrRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!address || address === prevAddrRef.current) { prevAddrRef.current = address; return; }
    prevAddrRef.current = address;
    const already = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (already) {
      toast.info(`Đã chuyển sang ví đã liên kết: ${shortAddr(address)}`);
      setSelectedQRWallet(already);
    } else {
      toast(`Ví mới: ${shortAddr(address)}`, { description: 'Nhấn "Liên kết ví này" để thêm vào danh sách', icon: '🔔' });
    }
  }, [address, wallets]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Link MetaMask wallet (full SIWE so backend can verify ownership) ── */
  const handleLinkWallet = async () => {
    if (!isConnected || !address) { toast.error('Vui lòng kết nối MetaMask trước'); return; }
    const already = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (already) { toast('Ví này đã được liên kết', { icon: 'ℹ️' }); return; }

    setLinking(true);
    try {
      const domain = window.location.host;
      const origin = window.location.origin;
      const nonce = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const issuedAt = new Date().toISOString();
      const expiration = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nLink wallet to Web3Market account\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chainId || 1}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expiration}`;

      const signature = await signMessageAsync({ message });
      await apiClient.post('/api/wallets', {
        chain_type: 'evm',
        chain_id: chainId || 1,
        address,
        label: `MetaMask (${shortAddr(address)})`,
        is_primary: wallets.length === 0,
        message,
        signature,
      });
      toast.success('Đã liên kết ví MetaMask!');
      fetchData();
    } catch (err: any) {
      if (err.code === 4001) toast.error('Người dùng từ chối ký xác nhận');
      else toast.error(err.response?.data?.message || 'Liên kết ví thất bại');
    } finally { setLinking(false); }
  };

  /* ─── Edit wallet label ──────────────────────────────────────────────── */
  const handleSaveLabel = async (id: number) => {
    try {
      await apiClient.patch(`/api/wallets/${id}/label`, { label: labelDraft.trim() || null });
      toast.success('Đã cập nhật tên ví');
      setEditingLabel(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cập nhật tên ví thất bại');
    }
  };

  /* ─── Set wallet as seller payout ────────────────────────────────────── */
  const handleSetPayout = async (w: UserWallet) => {
    if (!w.is_verified) { toast.error('Ví chưa được xác thực — không thể đặt làm payout'); return; }
    if (!confirm(`Đặt ví ${shortAddr(w.address)} làm địa chỉ nhận thanh toán cho cửa hàng?`)) return;
    try {
      const res = await apiClient.patch(`/api/wallets/${w.wallet_db_id}/set-payout`);
      const payout = res.data?.data?.payout_wallet ?? w.address;
      setSellerInfo(s => ({ ...s, payout_wallet: payout, is_seller: true }));
      toast.success('Đã cập nhật ví nhận thanh toán');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cập nhật payout wallet thất bại');
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('Xóa ví này?')) return;
    try {
      await apiClient.delete(`/api/wallets/${id}`);
      toast.success('Đã xóa ví');
      if (selectedQRWallet?.wallet_db_id === id) setSelectedQRWallet(null);
      fetchData();
    } catch { toast.error('Xóa ví thất bại'); }
  };

  const handleSetPrimary = async (id: number) => {
    try {
      await apiClient.patch(`/api/wallets/${id}/primary`);
      toast.success('Đã đặt làm ví chính');
      fetchData();
    } catch { toast.error('Thao tác thất bại'); }
  };

  const addNetworkToMetaMask = async (net: typeof TESTNET_NETWORKS[0]) => {
    try {
      await (window as any).ethereum?.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${net.chainId.toString(16)}`,
          chainName: net.name,
          nativeCurrency: { name: net.symbol, symbol: net.symbol, decimals: 18 },
          rpcUrls: [net.rpcUrl],
        }],
      });
      toast.success(`Đã thêm mạng ${net.name}`);
    } catch { toast.error('Không thể thêm mạng'); }
  };

  /* ─── Loading state ──────────────────────────────────────────────────── */
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#f0b90b]" />
        </div>
        <Footer />
      </div>
    );
  }

  const qrWallet = selectedQRWallet || wallets.find(w => w.is_primary) || wallets[0];

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground selection:bg-[#f0b90b]/30">
      {/* Ambient */}
      <div className="fixed top-[-15%] right-[-5%] w-[45%] h-[45%] bg-[#f0b90b]/4 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-5%] w-[40%] h-[40%] bg-purple-500/4 blur-[100px] rounded-full pointer-events-none" />

      <Header />

      <main className="flex-1 py-10 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">

          {/* Title */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-[#f0b90b]/15 border border-[#f0b90b]/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#f0b90b]" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Ví của tôi</h1>
              <p className="text-sm text-muted-foreground">Liên kết MetaMask · Nạp tiền · Lịch sử</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── LEFT: Wallet management ────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* MetaMask connect / link */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
                  <Link2 className="w-4 h-4 text-[#f0b90b]" /> Liên kết ví MetaMask
                </h2>
                <ConnectButton.Custom>
                  {({ account, openConnectModal, mounted }) => {
                    if (!mounted) return null;
                    if (!account) return (
                      <button
                        onClick={openConnectModal}
                        className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#f0b90b]/40 text-[#f0b90b] text-sm font-semibold hover:border-[#f0b90b] hover:bg-[#f0b90b]/5 transition-all flex items-center justify-center gap-2"
                      >
                        <Wallet className="w-4 h-4" /> Kết nối MetaMask
                      </button>
                    );
                    const isAlreadyLinked = wallets.some(w => w.address.toLowerCase() === account.address.toLowerCase());
                    return (
                      <div className="space-y-3">
                        <div className={`flex items-center gap-2 p-3 rounded-xl ${isAlreadyLinked ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-500/8 border border-emerald-500/20'}`}>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-emerald-400 font-semibold">Đã kết nối</p>
                            <p className="font-mono text-xs text-muted-foreground truncate">{account.address}</p>
                          </div>
                        </div>
                        {isAlreadyLinked ? (
                          <div className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">Đã liên kết</span>
                          </div>
                        ) : (
                          <button
                            onClick={handleLinkWallet}
                            disabled={linking}
                            className="w-full py-2.5 rounded-xl bg-[#f0b90b] text-black text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
                          >
                            {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {linking ? 'Đang liên kết...' : '+ Liên kết ví này'}
                          </button>
                        )}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>

              {/* Linked wallets list */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#f0b90b]" /> Ví đã liên kết ({wallets.length})
                  </h2>
                  <button onClick={fetchData} className="text-muted-foreground hover:text-foreground p-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {wallets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Chưa có ví nào</p>
                    <p className="text-xs mt-1">Kết nối và liên kết MetaMask bên trên</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wallets.map(w => (
                      <div
                        key={w.wallet_db_id}
                        onClick={() => { setSelectedQRWallet(w); setActiveTab('qr'); }}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${qrWallet?.wallet_db_id === w.wallet_db_id
                          ? 'border-[#f0b90b]/60 bg-[#f0b90b]/5'
                          : 'border-border hover:border-[#f0b90b]/30'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              {w.is_primary && (
                                <span className="text-[10px] font-bold text-[#f0b90b] bg-[#f0b90b]/10 px-1.5 py-0.5 rounded-full">PRIMARY</span>
                              )}
                              <span className="text-xs text-muted-foreground">{w.chain_info?.name || 'EVM'}</span>
                            </div>
                            {editingLabel === w.wallet_db_id ? (
                              <div className="flex items-center gap-1 mb-1" onClick={e => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={labelDraft}
                                  onChange={e => setLabelDraft(e.target.value)}
                                  maxLength={100}
                                  autoFocus
                                  className="flex-1 min-w-0 px-2 py-1 text-xs bg-background border border-border rounded"
                                />
                                <button
                                  onClick={() => handleSaveLabel(w.wallet_db_id)}
                                  className="text-[10px] font-bold text-emerald-400 px-1.5 py-1 hover:bg-emerald-500/10 rounded"
                                >OK</button>
                                <button
                                  onClick={() => { setEditingLabel(null); setLabelDraft(''); }}
                                  className="text-[10px] text-muted-foreground px-1.5 py-1 hover:bg-muted rounded"
                                >X</button>
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted-foreground truncate mb-0.5">
                                {w.label || 'Chưa đặt tên'}
                              </p>
                            )}
                            <p className="font-mono text-xs text-foreground">{shortAddr(w.address)}</p>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <WalletBalanceDisplay address={w.address} chainId={w.chain_id} />
                              {w.is_verified && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                  <ShieldCheck className="w-3 h-3" /> Verified
                                </span>
                              )}
                              {sellerInfo.is_seller && sellerInfo.payout_wallet?.toLowerCase() === w.address.toLowerCase() && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400">
                                  <Banknote className="w-3 h-3" /> Payout
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setEditingLabel(w.wallet_db_id);
                                setLabelDraft(w.label || '');
                              }}
                              title="Đổi tên ví"
                              className="p-1.5 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {sellerInfo.is_seller && w.chain_type === 'evm' && (
                              <button
                                onClick={e => { e.stopPropagation(); handleSetPayout(w); }}
                                title="Đặt làm ví nhận thanh toán bán hàng"
                                className="p-1.5 text-muted-foreground hover:text-blue-400"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!w.is_primary && (
                              <button onClick={e => { e.stopPropagation(); handleSetPrimary(w.wallet_db_id); }} title="Đặt làm ví chính" className="p-1.5 text-muted-foreground hover:text-[#f0b90b]">
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); copyText(w.address, 'địa chỉ ví'); }} className="p-1.5 text-muted-foreground hover:text-foreground">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleRemove(w.wallet_db_id); }} className="p-1.5 text-muted-foreground hover:text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: QR + History ─────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-4">

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-muted rounded-xl">
                {[
                  { key: 'qr', icon: QrCode, label: 'Nạp tiền' },
                  { key: 'history', icon: Clock, label: 'Lịch sử' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as 'qr' | 'history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">

                {/* QR Tab */}
                {activeTab === 'qr' && (
                  <motion.div key="qr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

                    {/* Network mismatch warning */}
                    {qrWallet && qrWallet.chain_type === 'evm' && qrWallet.chain_id && isConnected && chainId && qrWallet.chain_id !== chainId && (
                      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-xs text-amber-400/90">
                          MetaMask đang ở chain <strong>{chainId}</strong> nhưng ví đang chọn lưu trên chain <strong>{qrWallet.chain_id}</strong>. Số dư hiển thị có thể không chính xác.
                        </div>
                        <button
                          onClick={() => qrWallet.chain_id && switchChain?.({ chainId: qrWallet.chain_id })}
                          className="text-[11px] font-bold text-amber-400 underline whitespace-nowrap"
                        >
                          Chuyển mạng
                        </button>
                      </div>
                    )}

                    {/* Seller payout banner */}
                    {sellerInfo.is_seller && !sellerInfo.payout_wallet && wallets.some(w => w.is_verified && w.chain_type === 'evm') && (
                      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <Banknote className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-400/90 flex-1">
                          Bạn là người bán nhưng chưa đặt <strong>ví nhận thanh toán</strong>. Bấm icon <Banknote className="inline w-3 h-3" /> ở danh sách ví bên trái để chọn.
                        </p>
                      </div>
                    )}

                    {/* Deposit Invoice Card */}
                    <DepositInvoiceCard
                      activeIntent={activeIntent}
                      now={now}
                      tokens={tokensByChain[formChainId] || []}
                      tokenLoading={tokenLoading}
                      wallets={wallets}
                      formChainId={formChainId}
                      formTokenId={formTokenId}
                      formAmount={formAmount}
                      formFromWalletId={formFromWalletId}
                      creating={creatingIntent}
                      onChainChange={(c) => { setFormChainId(c); setFormTokenId(''); }}
                      onTokenChange={setFormTokenId}
                      onAmountChange={setFormAmount}
                      onWalletChange={setFormFromWalletId}
                      onSubmit={handleCreateIntent}
                      onCancel={() => activeIntent && handleCancelIntent(activeIntent.intent_id)}
                      onClose={() => setActiveIntent(null)}
                      onCopy={(text, label) => copyText(text, label)}
                    />

                    {/* Past intents (collapsed) */}
                    {intents.filter(i => !activeIntent || i.intent_id !== activeIntent.intent_id).length > 0 && (
                      <PastIntentsList
                        intents={intents.filter(i => !activeIntent || i.intent_id !== activeIntent.intent_id)}
                        onResume={(i) => setActiveIntent(i)}
                        onCancel={(id) => handleCancelIntent(id)}
                      />
                    )}

                    {/* Network info accordion */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                        <ArrowDownToLine className="w-4 h-4 text-[#f0b90b]" /> Thông tin mạng nạp tiền
                      </h3>
                      <div className="space-y-2">
                        {TESTNET_NETWORKS.map(net => (
                          <div key={net.chainId} className="border border-border rounded-xl overflow-hidden">
                            <button
                              onClick={() => setExpandedNetwork(expandedNetwork === net.chainId ? null : net.chainId)}
                              className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
                            >
                              <span className="text-xl">{net.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm">{net.name}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: net.color, backgroundColor: `${net.color}15`, border: `1px solid ${net.color}30` }}>
                                    {net.badge}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{net.note}</p>
                              </div>
                              {expandedNetwork === net.chainId
                                ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              }
                            </button>

                            <AnimatePresence>
                              {expandedNetwork === net.chainId && (
                                <motion.div
                                  initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                  className="overflow-hidden border-t border-border"
                                >
                                  <div className="p-4 space-y-3">
                                    {/* Grid info */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="p-2.5 bg-background border border-border rounded-lg">
                                        <p className="text-muted-foreground mb-0.5">Chain ID</p>
                                        <p className="font-mono font-bold">{net.chainId}</p>
                                      </div>
                                      <div className="p-2.5 bg-background border border-border rounded-lg">
                                        <p className="text-muted-foreground mb-0.5">Ký hiệu</p>
                                        <p className="font-bold">{net.symbol}</p>
                                      </div>
                                    </div>

                                    {/* RPC URL */}
                                    <div className="p-2.5 bg-background border border-border rounded-lg">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs text-muted-foreground">RPC URL</p>
                                        <button onClick={() => copyText(net.rpcUrl, 'RPC URL')} className="text-muted-foreground hover:text-foreground">
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <p className="font-mono text-xs break-all">{net.rpcUrl}</p>
                                    </div>

                                    {/* Tokens list */}
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1.5">Tokens hỗ trợ</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {net.tokens.map(t => (
                                          <span key={t} className="text-xs font-bold px-2.5 py-1 bg-muted rounded-full">{t}</span>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Faucet link */}
                                    {net.faucet && (
                                      <a href={net.faucet} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs text-[#f0b90b] hover:underline">
                                        <ExternalLink className="w-3 h-3" />
                                        Lấy {net.symbol} miễn phí tại faucet →
                                      </a>
                                    )}

                                    {/* Add to MetaMask */}
                                    <button
                                      onClick={() => addNetworkToMetaMask(net)}
                                      className="w-full py-2 text-xs font-semibold bg-muted hover:bg-muted/70 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Thêm mạng này vào MetaMask
                                    </button>

                                    {/* Hardhat Faucet — only for chain 31337 */}
                                    {net.chainId === 31337 && isConnected && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            const res = await paymentClient.post('/api/faucet/hardhat', { wallet: address });
                                            toast.success(res.data.message || 'Sent 10 ETH test!');
                                          } catch (e: any) {
                                            toast.error(e.response?.data?.message || 'Faucet failed');
                                          }
                                        }}
                                        className="w-full py-2.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                      >
                                        <Zap className="w-3.5 h-3.5" />
                                        Nhận 10 ETH test (Hardhat Faucet)
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>

                      {/* Info note */}
                      <div className="mt-4 flex items-start gap-2 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
                        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-400/90">
                          Trên tất cả mạng EVM (Ethereum, Polygon, BNB...), địa chỉ ví của bạn là <strong>giống nhau</strong>.
                          Chỉ cần chọn đúng mạng khi gửi.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#f0b90b]" /> Lịch sử nạp tiền
                        </h3>
                        <button onClick={fetchData} className="text-muted-foreground hover:text-foreground p-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {deposits.length === 0 ? (
                        <div className="text-center py-14 text-muted-foreground">
                          <ArrowDownToLine className="w-12 h-12 mx-auto mb-4 opacity-15" />
                          <p className="font-semibold">Chưa có giao dịch</p>
                          <p className="text-sm mt-1">Các lần nạp tiền sẽ hiện ở đây sau khi xác nhận trên blockchain</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {deposits.map(d => (
                            <div key={d.deposit_id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${d.status === 'confirmed' ? 'bg-emerald-500/15' : d.status === 'failed' ? 'bg-red-500/15' : 'bg-amber-500/15'
                                }`}>
                                {d.status === 'confirmed'
                                  ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                                  : d.status === 'failed'
                                    ? <AlertCircle className="w-4 h-4 text-red-400" />
                                    : <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm">{Number(d.amount).toFixed(6)} <span className="text-[#f0b90b]">{d.symbol}</span></p>
                                <p className="text-xs text-muted-foreground">{d.chain_name}</p>
                                <p className="font-mono text-[10px] text-muted-foreground truncate">{d.tx_hash.slice(0, 24)}...</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-xs font-semibold ${d.status === 'confirmed' ? 'text-emerald-400' : d.status === 'failed' ? 'text-red-400' : 'text-amber-400'
                                  }`}>
                                  {d.status === 'confirmed' ? '✓ Thành công' : d.status === 'failed' ? '✗ Thất bại' : '⏳ Đang xử lý'}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {new Date(d.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Network Diagnostics ─────────────────────────────────── */}
          <div className="mt-8">
            <NetworkDiagnostics />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
