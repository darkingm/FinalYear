import { useState, useEffect, useCallback } from 'react';
import { nftService } from '../services/nft.service';
import type { NFTItem } from '../types';

interface UseNFTPortfolioResult {
  nfts: NFTItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  totalValue: number; // sum of base prices
}

export function useNFTPortfolio(walletAddress: string | null | undefined): UseNFTPortfolioResult {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (silent = false) => {
    if (!walletAddress) { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError(null);

    const { data, error: err } = await nftService.getPortfolio(walletAddress);
    setNfts(data ?? []);
    if (err) setError(err);

    setLoading(false);
    setRefreshing(false);
  }, [walletAddress]);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    // Invalidate cache then re-fetch
    if (walletAddress) {
      nftService.invalidatePortfolio(walletAddress).then(() => fetch(false));
    }
  }, [walletAddress, fetch]);

  const totalValue = nfts.length; // count as proxy (real price would need external data)

  return { nfts, loading, refreshing, error, refresh, totalValue };
}
