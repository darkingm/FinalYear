'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import {
  Shield, ExternalLink, Fingerprint, Tag, Search,
  Filter, Grid3X3, List, Zap, RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/lib/hooks/useAuth';
import { CreditScoreBadge } from '@/components/web3/CreditScoreBadge';
import { apiClient } from '@/lib/api/client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface OwnedNFT {
  nft_id: number;
  product_id: number;
  token_id: number | null;
  token_uri: string | null;
  tx_hash: string | null;
  contract_addr: string | null;
  has_nfc: boolean;
  nfc_verified: boolean;
  physical_hash: string | null;
  minted_at: string | null;
  product_name: string;
  product_image: string | null;
  product_price: string;
  product_category: string;
  // from IPFS metadata (loaded lazily)
  meta_image?: string | null;
  meta_name?: string | null;
}

// ─── NFT Grid Card ─────────────────────────────────────────────────────────────
function NFTCard({ nft, onSelect, viewMode }: { nft: OwnedNFT; onSelect: (n: OwnedNFT) => void; viewMode: 'grid' | 'list' }) {
  const chainExplorer = 'https://amoy.polygonscan.com'; // from env/chain detection
  const imgSrc = nft.meta_image || nft.product_image;

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-purple-500/30 transition-all cursor-pointer group"
        onClick={() => onSelect(nft)}
      >
        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          {imgSrc
            ? <Image src={imgSrc} alt={nft.product_name} fill className="object-cover group-hover:scale-110 transition-transform duration-500" unoptimized />
            : <Shield className="w-7 h-7 text-purple-400 m-auto mt-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{nft.meta_name || nft.product_name}</p>
          <p className="text-xs text-muted-foreground">Token #{nft.token_id ?? '–'} · {nft.product_category}</p>
        </div>
        <div className="flex items-center gap-3">
          {nft.has_nfc && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${nft.nfc_verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
              {nft.nfc_verified ? '✓ NFC' : '⏳ NFC'}
            </span>
          )}
          <span className="font-bold text-[#f0b90b] text-sm">${parseFloat(nft.product_price).toFixed(2)}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/5 transition-all cursor-pointer group"
      onClick={() => onSelect(nft)}
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-muted overflow-hidden">
        {imgSrc ? (
          <Image src={imgSrc} alt={nft.product_name} fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield className="w-16 h-16 text-purple-400/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
        {/* Status badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {nft.has_nfc && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${nft.nfc_verified ? 'bg-emerald-500/80 text-white' : 'bg-orange-500/80 text-white'}`}>
              {nft.nfc_verified ? '✓ NFC Verified' : '⏳ NFC Pending'}
            </span>
          )}
          {nft.token_id !== null && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/80 text-white backdrop-blur-sm">
              #{nft.token_id}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="font-bold text-foreground truncate mb-1">{nft.meta_name || nft.product_name}</p>
        <p className="text-xs text-muted-foreground mb-3">{nft.product_category}</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Giá trị</p>
            <p className="font-bold text-[#f0b90b]">${parseFloat(nft.product_price).toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            {nft.tx_hash && (
              <a
                href={`${chainExplorer}/tx/${nft.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                title="View on PolygonScan"
              >
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </a>
            )}
            {nft.physical_hash && (
              <div className="p-1.5 rounded-lg bg-muted" title="Has physical hash">
                <Fingerprint className="w-3.5 h-3.5 text-purple-400" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── NFT Detail Modal ──────────────────────────────────────────────────────────
function NFTDetailModal({ nft, onClose }: { nft: OwnedNFT; onClose: () => void }) {
  const imgSrc = nft.meta_image || nft.product_image;
  const explorer = 'https://amoy.polygonscan.com';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-card border border-border rounded-3xl overflow-hidden max-w-md w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Image header */}
        <div className="relative h-64 bg-gradient-to-br from-purple-900/50 to-blue-900/30">
          {imgSrc && <Image src={imgSrc} alt={nft.product_name} fill className="object-cover" unoptimized />}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            ✕
          </button>
          <div className="absolute bottom-4 left-5">
            <p className="text-purple-300 text-xs font-bold uppercase tracking-widest">Web3Market NFT</p>
            <h2 className="text-xl font-black text-white mt-0.5">{nft.meta_name || nft.product_name}</h2>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-3">
          {[
            { label: 'Token ID', value: nft.token_id !== null ? `#${nft.token_id}` : 'Chưa mint', icon: <Tag className="w-4 h-4" /> },
            { label: 'Contract', value: nft.contract_addr ? `${nft.contract_addr.slice(0, 10)}...${nft.contract_addr.slice(-8)}` : '–', icon: <Zap className="w-4 h-4" /> },
            { label: 'Minted', value: nft.minted_at ? new Date(nft.minted_at).toLocaleDateString('vi-VN') : '–', icon: <Shield className="w-4 h-4" /> },
            { label: 'NFC Tag', value: nft.has_nfc ? (nft.nfc_verified ? '✓ Đã xác thực' : '⏳ Chờ xác thực') : 'Không có', icon: <Fingerprint className="w-4 h-4" /> },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">{item.icon} {item.label}</span>
              <span className="font-bold text-foreground">{item.value}</span>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            {nft.tx_hash && (
              <a href={`${explorer}/tx/${nft.tx_hash}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 text-center text-sm font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" /> PolygonScan
              </a>
            )}
            <Link href={`/products/${nft.product_id}`}
              className="flex-1 py-2.5 text-center text-sm font-bold bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20 rounded-xl hover:bg-[#f0b90b]/20 transition-colors"
            >
              Xem sản phẩm →
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NFTPortfolioPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [nfts, setNFTs] = useState<OwnedNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<OwnedNFT | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  const fetchNFTs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all products that have been ordered and have NFTs
      const res = await apiClient.get('/api/orders?status=COMPLETED&limit=100');
      const orders = res.data?.orders || res.data?.data?.orders || [];

      // For each order, fetch NFT info
      const nftResults = await Promise.allSettled(
        orders.map(async (order: any) => {
          try {
            const nftRes = await apiClient.get(`/api/nft/product/${order.product_id}`);
            const nft = nftRes.data?.data;
            if (!nft) return null;

            // Try to get IPFS image
            let meta_image = null, meta_name = null;
            if (nft.token_uri) {
              try {
                const uri = nft.token_uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
                const meta = await fetch(uri, { signal: AbortSignal.timeout(3000) }).then(r => r.json());
                meta_image = meta?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') ?? null;
                meta_name  = meta?.name ?? null;
              } catch { /* no IPFS */ }
            }

            return {
              ...nft,
              product_name: order.product_name,
              product_image: order.primary_image || order.product_metadata?.images?.[0] || null,
              product_price: String(order.price_usd || order.total_amount || '0'),
              product_category: order.product_metadata?.category || 'Sản phẩm',
              meta_image,
              meta_name,
            } as OwnedNFT;
          } catch { return null; }
        })
      );

      const validNFTs = nftResults
        .filter((r): r is PromiseFulfilledResult<OwnedNFT | null> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value!);

      // Deduplicate by product_id
      const seen = new Set<number>();
      const unique = validNFTs.filter(n => {
        if (seen.has(n.product_id)) return false;
        seen.add(n.product_id);
        return true;
      });

      setNFTs(unique);
    } catch (err: any) {
      toast.error('Không thể tải NFT portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchNFTs();
  }, [isAuthenticated, fetchNFTs]);

  const filteredNFTs = nfts.filter(n => {
    const matchSearch = !search || n.product_name.toLowerCase().includes(search.toLowerCase()) ||
      n.meta_name?.toLowerCase().includes(search.toLowerCase());
    const matchVerified = !filterVerified || n.nfc_verified;
    return matchSearch && matchVerified;
  });

  const totalValue = nfts.reduce((s, n) => s + parseFloat(n.product_price), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed top-0 right-0 w-[40%] h-[40%] bg-purple-500/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[30%] h-[30%] bg-blue-500/3 blur-[120px] rounded-full pointer-events-none" />

      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl relative z-10">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-foreground">NFT Portfolio</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {nfts.length} NFT · Tổng giá trị{' '}
                  <span className="text-[#f0b90b] font-bold">${totalValue.toFixed(2)}</span>
                </p>
              </div>
            </div>
            <button onClick={fetchNFTs} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
          </div>
        </motion.div>

        {/* Layout: NFT list + Credit Score sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main NFT area */}
          <div className="lg:col-span-3">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm NFT theo tên..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/40 transition-colors"
                />
              </div>
              <button
                onClick={() => setFilterVerified(v => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  filterVerified
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                <Fingerprint className="w-4 h-4" /> NFC Đã xác thực
              </button>
              <div className="flex bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* NFT Grid / List */}
            {loading ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-4' : 'space-y-3'}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className={`bg-card border border-border rounded-2xl animate-pulse ${viewMode === 'grid' ? 'h-64' : 'h-20'}`} />
                ))}
              </div>
            ) : filteredNFTs.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-2xl">
                <Shield className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {nfts.length === 0 ? 'Chưa có NFT nào' : 'Không tìm thấy NFT'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {nfts.length === 0
                    ? 'Mua và hoàn thành đơn hàng để nhận NFT chứng nhận sở hữu'
                    : 'Thử tìm kiếm với từ khóa khác'}
                </p>
                {nfts.length === 0 && (
                  <Link href="/products">
                    <button className="mt-5 px-6 py-2.5 bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20 rounded-xl text-sm font-bold hover:bg-[#f0b90b]/20 transition-colors">
                      Khám phá sản phẩm →
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              <motion.div
                layout
                className={viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-3'}
              >
                <AnimatePresence mode="popLayout">
                  {filteredNFTs.map((nft, i) => (
                    <NFTCard
                      key={`${nft.nft_id}-${nft.product_id}`}
                      nft={nft}
                      viewMode={viewMode}
                      onSelect={setSelectedNFT}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Sidebar: Credit Score */}
          <div className="lg:col-span-1">
            <CreditScoreBadge variant="full" />
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedNFT && <NFTDetailModal nft={selectedNFT} onClose={() => setSelectedNFT(null)} />}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
