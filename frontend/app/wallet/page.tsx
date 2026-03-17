'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Copy, QrCode, Link2, Trash2, Star,
  ChevronDown, ChevronUp, RefreshCw, Clock, CheckCircle,
  AlertCircle, Loader2, Shield, ArrowDownToLine, ExternalLink,
  Plus, Info,
} from 'lucide-react';

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

/* ─── Testnet network definitions ────────────────────────────────────────── */
const TESTNET_NETWORKS = [
  {
    chainId: 31337,
    name: 'Hardhat VPS (Test)',
    symbol: 'ETH',
    icon: '🖥️',
    rpcUrl: 'http://103.20.96.79:8545',
    color: '#22c55e',
    badge: 'MIỄN PHÍ',
    tokens: ['ETH'],
    note: 'Mạng thử nghiệm nội bộ — ETH miễn phí, không cần faucet',
    faucet: null,
  },
  {
    chainId: 80002,
    name: 'Polygon Amoy',
    symbol: 'MATIC',
    icon: '🔷',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    color: '#8247e5',
    badge: 'TESTNET',
    tokens: ['MATIC', 'USDT'],
    note: 'Cần MATIC testnet từ faucet',
    faucet: 'https://faucet.polygon.technology/',
  },
  {
    chainId: 97,
    name: 'BNB Testnet',
    symbol: 'tBNB',
    icon: '🟡',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    color: '#f0b90b',
    badge: 'TESTNET',
    tokens: ['BNB'],
    note: 'Cần tBNB từ faucet',
    faucet: 'https://testnet.bnbchain.org/faucet-smart',
  },
];

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`Đã sao chép ${label}`);
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function WalletPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'history'>('qr');
  const [selectedQRWallet, setSelectedQRWallet] = useState<UserWallet | null>(null);
  const [expandedNetwork, setExpandedNetwork] = useState<number | null>(31337);

  /* ─── Auth guard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/wallet');
    }
  }, [authLoading, isAuthenticated, router]);

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

  /* ─── Link MetaMask wallet ───────────────────────────────────────────── */
  const handleLinkWallet = async () => {
    if (!isConnected || !address) { toast.error('Vui lòng kết nối MetaMask trước'); return; }
    const already = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (already) { toast('Ví này đã được liên kết', { icon: 'ℹ️' }); return; }

    setLinking(true);
    try {
      const ts = Date.now();
      await signMessageAsync({ message: `Link wallet to Crypto Marketplace\nAddress: ${address}\nTimestamp: ${ts}` });
      await apiClient.post('/api/wallets', {
        chain_type: 'evm',
        chain_id: chainId || 1,
        address,
        label: `MetaMask (${shortAddr(address)})`,
        is_primary: wallets.length === 0,
      });
      toast.success('Đã liên kết ví MetaMask!');
      fetchData();
    } catch (err: any) {
      if (err.code === 4001) toast.error('Người dùng từ chối ký xác nhận');
      else toast.error(err.response?.data?.message || 'Liên kết ví thất bại');
    } finally { setLinking(false); }
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
              <p className="text-sm text-muted-foreground">Liên kết MetaMask · QR nạp tiền · Lịch sử</p>
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
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-emerald-400 font-semibold">Đã kết nối</p>
                            <p className="font-mono text-xs text-muted-foreground truncate">{account.address}</p>
                          </div>
                        </div>
                        <button
                          onClick={handleLinkWallet}
                          disabled={linking}
                          className="w-full py-2.5 rounded-xl bg-[#f0b90b] text-black text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
                        >
                          {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          {linking ? 'Đang liên kết...' : 'Liên kết ví này'}
                        </button>
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
                            <p className="font-mono text-xs text-foreground">{shortAddr(w.address)}</p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
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
                  { key: 'qr', icon: QrCode, label: 'QR Nạp tiền' },
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
                            <QrCode className="w-3.5 h-3.5" /> Quét bằng ví crypto để gửi tiền
                          </p>

                          {/* Address box */}
                          <div className="w-full p-4 bg-background border border-border rounded-xl mb-3">
                            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Địa chỉ ví</p>
                            <div className="flex items-start gap-2">
                              <p className="font-mono text-sm flex-1 break-all leading-relaxed">{qrWallet.address}</p>
                              <button
                                onClick={() => copyText(qrWallet.address, 'địa chỉ ví')}
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
                              ⚠️ Chỉ gửi đúng token và đúng mạng. Gửi sai mạng sẽ <strong>mất tiền vĩnh viễn</strong>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-14 text-muted-foreground">
                          <QrCode className="w-14 h-14 mx-auto mb-4 opacity-15" />
                          <p className="font-semibold">Chưa có ví nào</p>
                          <p className="text-sm mt-1">Liên kết MetaMask để tạo QR nạp tiền</p>
                        </div>
                      )}
                    </div>

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
        </div>
      </main>

      <Footer />
    </div>
  );
}
