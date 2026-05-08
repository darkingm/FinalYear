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
import { useAccount, useSignMessage, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Copy, QrCode, Link2, Trash2, Star,
  ChevronDown, ChevronUp, RefreshCw, Clock, CheckCircle,
  AlertCircle, Loader2, Shield, ArrowDownToLine, ExternalLink,
  Plus, Info, Zap, ShieldCheck, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';
import { NetworkDiagnostics } from '@/components/web3/NetworkDiagnostics';
import { SellerPayoutWalletSection } from '@/components/wallet/SellerPayoutWalletSection';
import { CHAIN_META } from '@/lib/web3/config';
import { useDualText } from '@/lib/hooks/useDualText';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface UserWallet {
  wallet_db_id: number;
  chain_type: string;
  chain_id: number | null;
  address: string;
  label: string | null;
  is_primary: boolean;
  chain_info: { name: string; type: string; symbol: string; explorer?: string };
  created_at: string;
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

interface CryptoOrderRow {
  order_id: number;
  internal_order_id: string;
  product_name: string;
  status: string;
  payment_method: string | null;
  chain_id: number | null;
  escrow_contract: string | null;
  tx_hash: string | null;
  token_symbol: string | null;
  amount_token: string | number | null;
  created_at: string;
  buyer_id: number;
  seller_id: number;
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

function copyText(text: string, successMsg: string) {
  navigator.clipboard.writeText(text);
  toast.success(successMsg);
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

/* ─── Balance display per wallet (each uses its own useBalance hook) ────── */
function WalletBalanceDisplay({ address }: { address: string }) {
  const { data, isLoading } = useBalance({ address: address as `0x${string}` });
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
  const tr = useDualText();
  const { isAuthenticated, isLoading: authLoading, reauthRequired } = useAuth();
  const { address, isConnected, chainId, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'history' | 'escrow'>('qr');
  const [cryptoOrders, setCryptoOrders] = useState<CryptoOrderRow[]>([]);
  const [cryptoOrdersLoading, setCryptoOrdersLoading] = useState(false);
  const [selectedQRWallet, setSelectedQRWallet] = useState<UserWallet | null>(null);
  const [expandedNetwork, setExpandedNetwork] = useState<number | null>(31337);

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
      const [walletsRes, depositsRes] = await Promise.allSettled([
        apiClient.get('/api/wallets'),
        apiClient.get('/api/wallets/deposits'),
      ]);
      if (walletsRes.status === 'fulfilled') {
        const raw = walletsRes.value.data;
        const ws: UserWallet[] = Array.isArray(raw) ? raw
          : Array.isArray(raw?.wallets) ? raw.wallets
            : [];
        setWallets(ws);
        const primary = ws.find(w => w.is_primary) || ws[0];
        if (primary && !selectedQRWallet) setSelectedQRWallet(primary);
      }
      if (depositsRes.status === 'fulfilled') {
        const raw = depositsRes.value.data;
        setDeposits(Array.isArray(raw) ? raw : Array.isArray(raw?.deposits) ? raw.deposits : []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Load crypto orders for escrow tab ──────────────────────────────── */
  const fetchCryptoOrders = useCallback(async () => {
    if (!isAuthenticated) return;
    setCryptoOrdersLoading(true);
    try {
      const res = await apiClient.get('/api/orders', { params: { limit: 50 } });
      const raw = res.data;
      const list: CryptoOrderRow[] = Array.isArray(raw?.orders) ? raw.orders : [];
      setCryptoOrders(
        list.filter(o => o.payment_method === 'crypto' && o.escrow_contract && o.internal_order_id)
      );
    } catch {
      /* silent */
    } finally {
      setCryptoOrdersLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'escrow') fetchCryptoOrders();
  }, [activeTab, fetchCryptoOrders]);

  /* ─── Detect connected-wallet account switch ──────────────────────────
   * Works for any RainbowKit wallet connector (MetaMask, Coinbase, WalletConnect)
   * because wagmi's useAccount() returns the active address regardless of
   * which connector the user picked.
   */
  const prevAddrRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!address || address === prevAddrRef.current) { prevAddrRef.current = address; return; }
    prevAddrRef.current = address;
    const already = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (already) {
      toast.info(tr(`Đã chuyển sang ví đã liên kết: ${shortAddr(address)}`, `Switched to linked wallet: ${shortAddr(address)}`));
      setSelectedQRWallet(already);
    } else {
      toast(tr(`Ví mới: ${shortAddr(address)}`, `New wallet: ${shortAddr(address)}`), { description: tr('Nhấn "Liên kết ví này" để thêm vào danh sách', 'Click "Link this wallet" to add it to your list'), icon: '🔔' });
    }
  }, [address, wallets]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Link the currently-connected wallet ─────────────────────────────
   * The label uses connector.name (MetaMask / Coinbase Wallet / WalletConnect)
   * so the saved entry reflects the actual provider, not a hard-coded "MetaMask".
   */
  const handleLinkWallet = async () => {
    if (!isConnected || !address) { toast.error(tr('Vui lòng kết nối ví trước', 'Please connect a wallet first')); return; }
    const already = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (already) { toast(tr('Ví này đã được liên kết', 'This wallet is already linked'), { icon: 'ℹ️' }); return; }

    setLinking(true);
    try {
      const ts = Date.now();
      const message = `Link wallet to Crypto Marketplace\nAddress: ${address}\nTimestamp: ${ts}`;
      const signature = await signMessageAsync({ message });
      const walletKind = connector?.name || 'EVM Wallet';
      await apiClient.post('/api/wallets', {
        chain_type: 'evm',
        chain_id: chainId || 1,
        address,
        label: `${walletKind} (${shortAddr(address)})`,
        is_primary: wallets.length === 0,
        message,
        signature,
      });
      toast.success(tr(`Đã liên kết ${walletKind}!`, `${walletKind} linked!`));
      fetchData();
    } catch (err: any) {
      if (err.code === 4001) toast.error(tr('Người dùng từ chối ký xác nhận', 'Signature rejected by user'));
      else toast.error(err.response?.data?.message || tr('Liên kết ví thất bại', 'Wallet linking failed'));
    } finally { setLinking(false); }
  };

  const handleRemove = async (id: number) => {
    if (!confirm(tr('Xóa ví này?', 'Delete this wallet?'))) return;
    try {
      await apiClient.delete(`/api/wallets/${id}`);
      toast.success(tr('Đã xóa ví', 'Wallet deleted'));
      if (selectedQRWallet?.wallet_db_id === id) setSelectedQRWallet(null);
      fetchData();
    } catch { toast.error(tr('Xóa ví thất bại', 'Failed to delete wallet')); }
  };

  const handleSetPrimary = async (id: number) => {
    try {
      await apiClient.patch(`/api/wallets/${id}/primary`);
      toast.success(tr('Đã đặt làm ví chính', 'Set as primary wallet'));
      fetchData();
    } catch { toast.error(tr('Thao tác thất bại', 'Operation failed')); }
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
      toast.success(tr(`Đã thêm mạng ${net.name}`, `Added network ${net.name}`));
    } catch { toast.error(tr('Không thể thêm mạng', 'Could not add network')); }
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
              <h1 className="text-2xl font-black">{tr('Ví của tôi', 'My Wallet')}</h1>
              <p className="text-sm text-muted-foreground">{tr('Liên kết ví (MetaMask · Coinbase · WalletConnect) · QR nạp tiền · Lịch sử', 'Link wallet (MetaMask · Coinbase · WalletConnect) · Deposit QR · History')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── LEFT: Wallet management ────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Wallet connect / link — works with any RainbowKit connector */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
                  <Link2 className="w-4 h-4 text-[#f0b90b]" /> {tr('Liên kết ví Web3', 'Link Web3 wallet')}
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  {tr('Hỗ trợ MetaMask, Coinbase Wallet, WalletConnect — chọn provider khi connect', 'Supports MetaMask, Coinbase Wallet, WalletConnect — pick a provider on connect')}
                </p>
                <ConnectButton.Custom>
                  {({ account, openConnectModal, mounted }) => {
                    if (!mounted) return null;
                    if (!account) return (
                      <button
                        onClick={openConnectModal}
                        className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#f0b90b]/40 text-[#f0b90b] text-sm font-semibold hover:border-[#f0b90b] hover:bg-[#f0b90b]/5 transition-all flex items-center justify-center gap-2"
                      >
                        <Wallet className="w-4 h-4" /> {tr('Kết nối ví', 'Connect wallet')}
                      </button>
                    );
                    const isAlreadyLinked = wallets.some(w => w.address.toLowerCase() === account.address.toLowerCase());
                    return (
                      <div className="space-y-3">
                        <div className={`flex items-center gap-2 p-3 rounded-xl ${isAlreadyLinked ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-500/8 border border-emerald-500/20'}`}>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-emerald-400 font-semibold">{tr('Đã kết nối', 'Connected')}</p>
                            <p className="font-mono text-xs text-muted-foreground truncate">{account.address}</p>
                          </div>
                        </div>
                        {isAlreadyLinked ? (
                          <div className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">{tr('Đã liên kết', 'Linked')}</span>
                          </div>
                        ) : (
                          <button
                            onClick={handleLinkWallet}
                            disabled={linking}
                            className="w-full py-2.5 rounded-xl bg-[#f0b90b] text-black text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
                          >
                            {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {linking ? tr('Đang liên kết...', 'Linking...') : tr('+ Liên kết ví này', '+ Link this wallet')}
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
                    <Shield className="w-4 h-4 text-[#f0b90b]" /> {tr('Ví đã liên kết', 'Linked wallets')} ({wallets.length})
                  </h2>
                  <button onClick={fetchData} className="text-muted-foreground hover:text-foreground p-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {wallets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">{tr('Chưa có ví nào', 'No wallets yet')}</p>
                    <p className="text-xs mt-1">{tr('Kết nối và liên kết ví bên trên', 'Connect and link a wallet above')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wallets.map(w => (
                      <div
                        key={w.wallet_db_id}
                        onClick={() => { setSelectedQRWallet(w); setActiveTab('qr' as const); }}
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
                            <p className="font-mono text-xs text-foreground">{shortAddr(w.address)}</p>
                            <div className="mt-1">
                              <WalletBalanceDisplay address={w.address} />
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {!w.is_primary && (
                              <button onClick={e => { e.stopPropagation(); handleSetPrimary(w.wallet_db_id); }} title={tr('Đặt làm ví chính', 'Set as primary wallet')} className="p-1.5 text-muted-foreground hover:text-[#f0b90b]">
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); copyText(w.address, tr('Đã sao chép địa chỉ ví', 'Wallet address copied')); }} className="p-1.5 text-muted-foreground hover:text-foreground">
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
                  { key: 'qr', icon: QrCode, label: tr('QR Nạp tiền', 'Deposit QR') },
                  { key: 'escrow', icon: ShieldCheck, label: tr('Trạng thái Escrow', 'Escrow status') },
                  { key: 'history', icon: Clock, label: tr('Lịch sử', 'History') },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as 'qr' | 'history' | 'escrow')}
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

                    {/* QR Card */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                      {qrWallet ? (
                        <div className="flex flex-col items-center">
                          {/* QR */}
                          <div className="p-4 bg-white rounded-2xl shadow-xl mb-5 ring-4 ring-[#f0b90b]/10">
                            <QRCodeSVG value={qrWallet.address} size={200} bgColor="#ffffff" fgColor="#000000" level="M" />
                          </div>

                          {/* Scan hint */}
                          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5" /> {tr('Quét bằng ví crypto để gửi tiền', 'Scan with a crypto wallet to send funds')}
                          </p>

                          {/* Address box */}
                          <div className="w-full p-4 bg-background border border-border rounded-xl mb-3">
                            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">{tr('Địa chỉ ví', 'Wallet address')}</p>
                            <div className="flex items-start gap-2">
                              <p className="font-mono text-sm flex-1 break-all leading-relaxed">{qrWallet.address}</p>
                              <button
                                onClick={() => copyText(qrWallet.address, tr('Đã sao chép địa chỉ ví', 'Wallet address copied'))}
                                className="flex-shrink-0 p-2 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] rounded-lg transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Warning */}
                          <div className="w-full flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-400/90">
                              ⚠️ {tr('Chỉ gửi đúng token và đúng mạng. Gửi sai mạng sẽ', 'Only send the correct token on the correct network. Sending on the wrong network will')} <strong>{tr('mất tiền vĩnh viễn', 'permanently lose your funds')}</strong>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-14 text-muted-foreground">
                          <QrCode className="w-14 h-14 mx-auto mb-4 opacity-15" />
                          <p className="font-semibold">{tr('Chưa có ví nào', 'No wallets yet')}</p>
                          <p className="text-sm mt-1">{tr('Liên kết ví để tạo QR nạp tiền', 'Link a wallet to generate a deposit QR')}</p>
                        </div>
                      )}
                    </div>

                    {/* Network info accordion */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                        <ArrowDownToLine className="w-4 h-4 text-[#f0b90b]" /> {tr('Thông tin mạng nạp tiền', 'Deposit network info')}
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
                                        <p className="text-muted-foreground mb-0.5">{tr('Ký hiệu', 'Symbol')}</p>
                                        <p className="font-bold">{net.symbol}</p>
                                      </div>
                                    </div>

                                    {/* RPC URL */}
                                    <div className="p-2.5 bg-background border border-border rounded-lg">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs text-muted-foreground">RPC URL</p>
                                        <button onClick={() => copyText(net.rpcUrl, tr('Đã sao chép RPC URL', 'RPC URL copied'))} className="text-muted-foreground hover:text-foreground">
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <p className="font-mono text-xs break-all">{net.rpcUrl}</p>
                                    </div>

                                    {/* Tokens list */}
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1.5">{tr('Tokens hỗ trợ', 'Supported tokens')}</p>
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
                                        {tr(`Lấy ${net.symbol} miễn phí tại faucet →`, `Get free ${net.symbol} from the faucet →`)}
                                      </a>
                                    )}

                                    {/* Add to MetaMask */}
                                    <button
                                      onClick={() => addNetworkToMetaMask(net)}
                                      className="w-full py-2 text-xs font-semibold bg-muted hover:bg-muted/70 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> {tr('Thêm mạng này vào MetaMask', 'Add this network to MetaMask')}
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
                                        {tr('Nhận 10 ETH test (Hardhat Faucet)', 'Get 10 test ETH (Hardhat Faucet)')}
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
                          {tr('Trên tất cả mạng EVM (Ethereum, Polygon, BNB...), địa chỉ ví của bạn là', 'On every EVM network (Ethereum, Polygon, BNB...), your wallet address is the')} <strong>{tr('giống nhau', 'same')}</strong>.
                          {tr('Chỉ cần chọn đúng mạng khi gửi.', 'Just pick the right network when sending.')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Escrow Status Tab */}
                {activeTab === 'escrow' && (
                  <motion.div key="escrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#f0b90b]" /> {tr('Đơn hàng dùng Escrow on-chain', 'Orders using on-chain Escrow')}
                        </h3>
                        <button onClick={fetchCryptoOrders} className="text-muted-foreground hover:text-foreground p-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl mb-4">
                        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-400/90">
                          {tr('Mỗi đơn dưới đây có 1 mục trong hợp đồng', 'Each order below has an entry in the')} <strong>EscrowCore</strong> {tr('trên chain tương ứng. Mở đơn để xem dữ liệu blockchain real-time song song với database — phát hiện mọi sai lệch.', 'contract on the matching chain. Open an order to see live blockchain data side-by-side with the database — surface any drift.')}
                        </p>
                      </div>

                      {cryptoOrdersLoading ? (
                        <div className="flex items-center justify-center py-10 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {tr('Đang tải đơn hàng…', 'Loading orders…')}
                        </div>
                      ) : cryptoOrders.length === 0 ? (
                        <div className="text-center py-14 text-muted-foreground">
                          <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-15" />
                          <p className="font-semibold">{tr('Chưa có đơn nào dùng Escrow', 'No Escrow orders yet')}</p>
                          <p className="text-sm mt-1">{tr('Đơn thanh toán bằng crypto sẽ hiện ở đây sau khi tạo', 'Crypto-paid orders will appear here once created')}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {cryptoOrders.map(o => {
                            const chainName = o.chain_id ? CHAIN_META[o.chain_id]?.name || `Chain ${o.chain_id}` : '—';
                            return (
                              <Link
                                key={o.order_id}
                                href={`/orders/${o.order_id}`}
                                className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover:border-[#f0b90b]/40 transition-colors"
                              >
                                <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm truncate">{o.product_name}</p>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap mt-0.5">
                                    <span className="px-1.5 py-0.5 bg-muted rounded">{chainName}</span>
                                    <span>{o.token_symbol || '—'}</span>
                                    {o.amount_token && (
                                      <span className="font-mono">{Number(o.amount_token).toString()}</span>
                                    )}
                                  </div>
                                  <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                                    {o.internal_order_id}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0 flex items-center gap-2">
                                  <div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-border bg-muted">
                                      {o.status}
                                    </span>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {new Date(o.created_at).toLocaleDateString('vi-VN')}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#f0b90b]" /> {tr('Lịch sử nạp tiền', 'Deposit history')}
                        </h3>
                        <button onClick={fetchData} className="text-muted-foreground hover:text-foreground p-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {deposits.length === 0 ? (
                        <div className="text-center py-14 text-muted-foreground">
                          <ArrowDownToLine className="w-12 h-12 mx-auto mb-4 opacity-15" />
                          <p className="font-semibold">{tr('Chưa có giao dịch', 'No transactions yet')}</p>
                          <p className="text-sm mt-1">{tr('Các lần nạp tiền sẽ hiện ở đây sau khi xác nhận trên blockchain', 'Deposits will appear here once confirmed on-chain')}</p>
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
                                  {d.status === 'confirmed' ? tr('✓ Thành công', '✓ Success') : d.status === 'failed' ? tr('✗ Thất bại', '✗ Failed') : tr('⏳ Đang xử lý', '⏳ Pending')}
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

          {/* ── Seller payout wallet (Phase 4) ──────────────────────── */}
          <div className="mt-8">
            <SellerPayoutWalletSection />
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
