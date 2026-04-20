'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, ExternalLink, Cpu, CheckCircle2, Clock, Fingerprint, Tag,
  Image as ImageIcon, Zap, Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { publicRequestConfig } from '@/lib/api/request-auth';

interface NFTInfo {
  nft_id?: number;
  token_id?: number | null;
  token_uri?: string | null;
  tx_hash?: string | null;
  contract_addr?: string | null;
  physical_hash?: string | null;
  has_nfc?: boolean;
  nfc_verified?: boolean;
  minted_at?: string | null;
  delivered_at?: string | null;
  product_id?: number;
}

interface NFTOwnershipCardProps {
  productId: number;
  productName?: string;
  variant?: 'full' | 'compact';
  className?: string;
}

const CHAIN_EXPLORERS: Record<number, string> = {
  137: 'https://polygonscan.com',
  80002: 'https://amoy.polygonscan.com',
  1: 'https://etherscan.io',
  56: 'https://bscscan.com',
};

function StatusBadge({ verified, hasNFC }: { verified: boolean; hasNFC: boolean }) {
  if (!hasNFC) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" /> NFT Transfer Ready
      </span>
    );
  }
  return verified ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-3.5 h-3.5" /> NFC Đã Xác Thực
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
      <Clock className="w-3.5 h-3.5" /> Chờ Xác Thực NFC
    </span>
  );
}

export function NFTOwnershipCard({ productId, productName, variant = 'full', className = '' }: NFTOwnershipCardProps) {
  const { user } = useAuth() as any;
  const isAdmin = user?.role === 'admin';

  const [nft, setNFT] = useState<NFTInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [nftImage, setNftImage] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [hasNFC, setHasNFC] = useState(false);

  const fetchNFT = async () => {
    try {
      const res = await apiClient.get(`/api/nft/product/${productId}`, publicRequestConfig);
      const data = res.data?.data ?? null;
      setNFT(data);
      if (data?.token_uri) {
        try {
          const uri = data.token_uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
          const meta = await fetch(uri).then(r => r.json());
          if (meta?.image) setNftImage(meta.image.replace('ipfs://', 'https://ipfs.io/ipfs/'));
        } catch { /* no image */ }
      }
    } catch { /* product has no NFT */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNFT(); }, [productId]);

  const handleMint = async () => {
    if (!isAdmin) return;
    setMinting(true);
    try {
      toast.loading('Đang mint NFT lên Polygon...', { id: `mini-${productId}` });
      const res = await apiClient.post(`/api/nft/mint/${productId}`, { hasNFC });
      const { txHash, tokenURI } = res.data?.data || {};
      toast.success(`NFT đã mint! TX: ${txHash?.slice(0, 12)}...`, { id: `mini-${productId}` });
      await fetchNFT();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Mint NFT thất bại', { id: `mini-${productId}` });
    } finally { setMinting(false); }
  };

  if (loading) {
    return (
      <div className={`bg-card border border-border rounded-2xl p-5 animate-pulse ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!nft) {
    // Not yet minted — show admin mint panel or simple "not tokenized" badge
    if (variant === 'compact' && !isAdmin) return null;

    return (
      <div className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Chưa Được Token Hóa</p>
              <p className="text-xs text-muted-foreground">Sản phẩm này chưa được mint NFT trên blockchain</p>
            </div>
          </div>

          {/* Admin mint panel */}
          {isAdmin && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Admin — Mint NFT</p>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setHasNFC(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${hasNFC ? 'bg-purple-500' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasNFC ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-xs font-semibold text-foreground">Sản phẩm có NFC tag</span>
              </label>

              <button
                onClick={handleMint}
                disabled={minting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
              >
                {minting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Đang mint NFT...</>
                  : <><Zap className="w-4 h-4" />Mint NFT lên Polygon</>}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                Metadata sẽ được upload lên IPFS trước khi mint on-chain
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }


  const chainId = 80002; // Polygon Amoy (update from .env)
  const explorer = CHAIN_EXPLORERS[chainId] || 'https://amoy.polygonscan.com';

  if (variant === 'compact') {
    return (
      <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            {nftImage
              ? <img src={nftImage} alt="NFT" className="w-full h-full object-cover rounded-xl" />
              : <Shield className="w-5 h-5 text-purple-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {productName || `Product #${productId}`} NFT
            </p>
            <p className="text-xs text-muted-foreground">
              Token #{nft.token_id ?? '–'} · <StatusBadge verified={!!nft.nfc_verified} hasNFC={!!nft.has_nfc} />
            </p>
          </div>
          {nft.tx_hash && (
            <a
              href={`${explorer}/tx/${nft.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="View on Explorer"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border border-border rounded-3xl overflow-hidden ${className}`}
    >
      {/* Header gradient */}
      <div className="relative h-36 bg-gradient-to-br from-purple-900/50 via-blue-900/30 to-card overflow-hidden">
        {nftImage && (
          <img src={nftImage} alt="NFT Art" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
          <div>
            <span className="text-xs text-purple-300 font-bold uppercase tracking-widest">Web3Market</span>
            <h3 className="text-xl font-black text-white mt-0.5">
              {productName || `Product #${productId}`}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Token ID</p>
            <p className="text-2xl font-black text-white">#{nft.token_id ?? '?'}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <StatusBadge verified={!!nft.nfc_verified} hasNFC={!!nft.has_nfc} />
          {nft.minted_at && (
            <span className="text-xs text-muted-foreground">
              Mint: {new Date(nft.minted_at).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        {/* Info rows */}
        <div className="space-y-2 text-sm">
          {nft.contract_addr && (
            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-xl">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Cpu className="w-4 h-4" /> Contract
              </span>
              <a
                href={`${explorer}/address/${nft.contract_addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                {nft.contract_addr.slice(0, 8)}...{nft.contract_addr.slice(-6)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {nft.physical_hash && (
            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-xl">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Fingerprint className="w-4 h-4" /> Physical Hash
              </span>
              <span className="font-mono text-xs text-foreground">
                {nft.physical_hash.slice(0, 10)}...
              </span>
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-xl">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Tag className="w-4 h-4" /> NFC Tag
            </span>
            <span className={`font-bold text-xs ${nft.has_nfc ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {nft.has_nfc ? '✓ Có NFC' : '✗ Không có'}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {nft.tx_hash && (
            <a
              href={`${explorer}/tx/${nft.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> PolygonScan
            </a>
          )}
          {nft.token_uri && (
            <a
              href={nft.token_uri.replace('ipfs://', 'https://ipfs.io/ipfs/')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-colors"
            >
              <Shield className="w-4 h-4" /> IPFS Metadata
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
