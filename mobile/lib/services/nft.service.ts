/**
 * NFT Service — all blockchain/NFT API calls.
 * Uses safeCall wrapper so callers never need try/catch.
 */
import { apiClient } from '../api/client';
import { safeCall } from '../utils/api';
import { cache } from '../utils/cache';
import type { NFTItem, PriceHistoryPoint } from '../types';

const PORTFOLIO_TTL = 2 * 60 * 1000;    // 2 min
const PRICE_HISTORY_TTL = 10 * 60 * 1000; // 10 min

function resolveIpfsUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

export const nftService = {
  /**
   * Fetch all NFTs owned by a wallet address.
   * Returns cached data if available and not expired.
   */
  async getPortfolio(walletAddress: string) {
    return safeCall(
      () => cache.getOrFetch(
        `nft:portfolio:${walletAddress}`,
        async () => {
          const res = await apiClient.get(`/api/nft/portfolio/${walletAddress}`);
          const items: NFTItem[] = (res.data.nfts ?? []).map((n: NFTItem) => ({
            ...n,
            metadata: n.metadata ? {
              ...n.metadata,
              imageUrl: resolveIpfsUrl(n.metadata?.image),
            } : undefined,
          }));
          return items;
        },
        PORTFOLIO_TTL,
      ),
      { tag: 'nftService.getPortfolio', fallback: [] as NFTItem[] },
    );
  },

  /**
   * Fetch single NFT detail with full metadata.
   */
  async getNFTDetail(tokenId: string) {
    return safeCall(
      () => cache.getOrFetch(
        `nft:detail:${tokenId}`,
        async () => {
          const res = await apiClient.get(`/api/nft/${tokenId}`);
          const item: NFTItem = res.data.nft;
          if (item.metadata?.image) {
            item.metadata.imageUrl = resolveIpfsUrl(item.metadata.image) ?? undefined;
          }
          return item;
        },
        PORTFOLIO_TTL,
      ),
      { tag: 'nftService.getNFTDetail', fallback: undefined },
    );
  },

  /**
   * Fetch price history for a product.
   */
  async getPriceHistory(productId: number) {
    return safeCall(
      () => cache.getOrFetch(
        `nft:price-history:${productId}`,
        async () => {
          const res = await apiClient.get(`/api/products/${productId}/price-history`);
          return (res.data.history ?? []) as PriceHistoryPoint[];
        },
        PRICE_HISTORY_TTL,
      ),
      { tag: 'nftService.getPriceHistory', fallback: [] as PriceHistoryPoint[] },
    );
  },

  /**
   * Invalidate portfolio cache after NFT transfer / purchase.
   */
  async invalidatePortfolio(walletAddress: string) {
    await cache.delete(`nft:portfolio:${walletAddress}`);
  },
};
