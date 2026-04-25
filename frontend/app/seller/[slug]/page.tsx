'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Store, Star, TrendingUp, Calendar, Package,
  Copy, Check, AlertCircle, Loader2, Wallet,
  Coins, RefreshCw,
} from 'lucide-react';
import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address } from 'viem';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CoinImage } from '@/components/ui/CoinImage';
import { apiClient } from '@/lib/api/client';
import { publicRequestConfig } from '@/lib/api/request-auth';
import { DEFAULT_CHAIN_ID } from '@/lib/web3/config';
import { getRecommendedCheckoutChainMetas } from '@/lib/web3/testnet-lite';

interface SellerProfile {
  seller_id: number;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  slug: string;
  payout_wallet: string | null;
  rating_avg: string;
  total_sales: number;
  seller_since: string;
  username: string | null;
  avatar_url: string | null;
}

interface SellerProduct {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: string;
  category: string | null;
  rating_avg: string;
  review_count: number;
  primary_image: string | null;
  stock: number;
  accepted_tokens: Array<{
    token_id: number;
    symbol: string;
    price_in_token: string;
    is_primary: boolean;
    chain_id: number;
  }>;
}

interface TokenCatalogItem {
  token_id: number;
  symbol: string;
  token_address: string;
  chain_id: number;
  decimals: number;
}

interface SellerHolding {
  symbol: string;
  amount: string;
  tokenAddress: string | null;
  native: boolean;
}

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const NATIVE_TOKEN_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000001010',
]);

function truncateAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function compactAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  if (amount === 0) return '0';
  if (amount > 0 && amount < 0.000001) return '<0.000001';
  return amount.toLocaleString('en-US', {
    maximumFractionDigits: amount < 1 ? 6 : 4,
  });
}

function getSellerBalanceContext() {
  const chainMeta = getRecommendedCheckoutChainMetas().find((chain) => chain.chainId === DEFAULT_CHAIN_ID);
  const rpcUrl = chainMeta?.rpcUrl || 'https://kienai.id.vn/rpc/hardhat';
  const nativeSymbol = chainMeta?.nativeSymbol || 'ETH';

  return {
    nativeSymbol,
    chainName: chainMeta?.name || `Chain ${DEFAULT_CHAIN_ID}`,
    client: createPublicClient({
      chain: {
        id: DEFAULT_CHAIN_ID,
        name: chainMeta?.name || `Chain ${DEFAULT_CHAIN_ID}`,
        nativeCurrency: { decimals: 18, name: nativeSymbol, symbol: nativeSymbol },
        rpcUrls: { default: { http: [rpcUrl] } },
      },
      transport: http(rpcUrl),
    }),
  };
}

export default function SellerStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [holdings, setHoldings] = useState<SellerHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const [holdingsRefreshKey, setHoldingsRefreshKey] = useState(0);

  useEffect(() => {
    if (!slug) return;
    apiClient.get(`/api/products/seller/${slug}`, publicRequestConfig)
      .then((res) => {
        if (res.data?.success && res.data.data) {
          setSeller(res.data.data.seller);
          setProducts(res.data.data.products || []);
        } else {
          setError('Không tìm thấy cửa hàng');
        }
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Cửa hàng không tồn tại');
        } else {
          setError('Có lỗi xảy ra khi tải thông tin cửa hàng');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleCopyWallet = () => {
    if (!seller?.payout_wallet) return;
    navigator.clipboard.writeText(seller.payout_wallet);
    setCopied(true);
    toast.success('Đã sao chép địa chỉ ví');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const wallet = seller?.payout_wallet;
    if (!wallet || !isAddress(wallet)) {
      setHoldings([]);
      setHoldingsError(null);
      return;
    }

    let cancelled = false;

    const loadHoldings = async () => {
      setHoldingsLoading(true);
      setHoldingsError(null);

      try {
        const { client, nativeSymbol } = getSellerBalanceContext();
        const walletAddress = wallet as Address;

        const [nativeBalance, tokensRes] = await Promise.all([
          client.getBalance({ address: walletAddress }),
          apiClient.get('/api/products/tokens', publicRequestConfig),
        ]);

        const tokenRows = ((tokensRes.data?.data || []) as TokenCatalogItem[])
          .filter((token) => Number(token.chain_id) === DEFAULT_CHAIN_ID)
          .filter((token) => isAddress(token.token_address))
          .filter((token) => !NATIVE_TOKEN_ADDRESSES.has(token.token_address.toLowerCase()));

        const erc20Holdings: Array<SellerHolding | null> = await Promise.all(
          tokenRows.map(async (token) => {
            try {
              const rawBalance = await client.readContract({
                address: token.token_address as Address,
                abi: ERC20_BALANCE_ABI,
                functionName: 'balanceOf',
                args: [walletAddress],
              });

              return {
                symbol: token.symbol,
                amount: formatUnits(rawBalance as bigint, Number(token.decimals || 18)),
                tokenAddress: token.token_address,
                native: false,
              } satisfies SellerHolding;
            } catch {
              return null;
            }
          })
        );
        const resolvedErc20Holdings = erc20Holdings.filter((holding): holding is SellerHolding => holding !== null);

        const nextHoldings: SellerHolding[] = [
          {
            symbol: nativeSymbol,
            amount: formatEther(nativeBalance),
            tokenAddress: null,
            native: true,
          },
          ...resolvedErc20Holdings,
        ].filter((holding) => holding.native || Number(holding.amount) > 0);

        if (!cancelled) setHoldings(nextHoldings);
      } catch {
        if (!cancelled) setHoldingsError('Không đọc được số dư public của ví seller từ RPC.');
      } finally {
        if (!cancelled) setHoldingsLoading(false);
      }
    };

    loadHoldings();

    return () => {
      cancelled = true;
    };
  }, [seller?.payout_wallet, holdingsRefreshKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <AlertCircle className="h-16 w-16 text-red-500" />
          <h2 className="text-xl font-bold text-foreground">{error || 'Cửa hàng không tồn tại'}</h2>
          <Link href="/products" className="text-primary hover:underline">
            ← Xem tất cả sản phẩm
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const holdingsChain = getSellerBalanceContext().chainName;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1">
        {/* ── Hero Banner ─────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-border">
          {/* Background gradient */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-30%] left-[5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />
            <div className="absolute bottom-[-20%] right-[10%] w-[400px] h-[400px] bg-[#f0b90b]/5 rounded-full blur-[120px]" />
          </div>

          <div className="container mx-auto px-4 py-12 max-w-6xl relative z-10">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Avatar */}
              <Avatar className="h-28 w-28 rounded-2xl border-2 border-primary/20 shadow-xl flex-shrink-0">
                <AvatarImage src={seller.avatar_url || seller.logo_url || undefined} />
                <AvatarFallback className="rounded-2xl bg-primary/10 text-4xl font-black text-primary">
                  {seller.display_name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-2">
                  <h1 className="text-3xl font-black">{seller.display_name}</h1>
                  {seller.username && (
                    <span className="text-muted-foreground text-sm">@{seller.username}</span>
                  )}
                </div>

                {seller.description && (
                  <p className="text-muted-foreground text-sm max-w-xl leading-relaxed mb-4">
                    {seller.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm">
                  {Number(seller.rating_avg) > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                      <span className="font-bold">{Number(seller.rating_avg).toFixed(1)}</span>
                      <span className="text-muted-foreground">Rating</span>
                    </div>
                  )}
                  {seller.total_sales > 0 && (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold">{seller.total_sales}</span>
                      <span className="text-muted-foreground">Đã bán</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="font-bold">{products.length}</span>
                    <span className="text-muted-foreground">Sản phẩm</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Tham gia {new Date(seller.seller_since).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Wallet */}
                {seller.payout_wallet && (
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-center md:justify-start">
                      <button
                        onClick={handleCopyWallet}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-xs font-mono text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
                      >
                        <Wallet className="w-3.5 h-3.5 text-primary" />
                        {truncateAddress(seller.payout_wallet)}
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    <div className="max-w-xl rounded-2xl border border-border bg-card/70 p-4 text-left">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <Coins className="h-4 w-4 text-primary" />
                            Public token holdings
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Đọc trực tiếp ví payout trên {holdingsChain}; dùng để demo tiền về seller mà không cần logout.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHoldingsRefreshKey((key) => key + 1)}
                          disabled={holdingsLoading}
                          className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                          aria-label="Refresh seller token holdings"
                        >
                          {holdingsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      </div>

                      {holdingsError ? (
                        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          {holdingsError}
                        </p>
                      ) : holdingsLoading && holdings.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Đang đọc số dư seller...
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {holdings.map((holding) => (
                            <div key={`${holding.symbol}-${holding.tokenAddress || 'native'}`} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <CoinImage symbol={holding.symbol} size={18} />
                                <span className="truncate text-xs font-semibold text-foreground">{holding.symbol}</span>
                              </div>
                              <span className="font-mono text-xs text-muted-foreground">
                                {compactAmount(holding.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Product Grid ─────────────────────────────────────── */}
        <div className="container mx-auto px-4 py-10 max-w-6xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Sản phẩm ({products.length})
          </h2>

          {products.length === 0 ? (
            <div className="text-center py-20 bg-card border border-border rounded-2xl">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Cửa hàng chưa có sản phẩm nào</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map((product) => {
                const token = product.accepted_tokens?.find(t => t.is_primary) || product.accepted_tokens?.[0];
                return (
                  <Link
                    key={product.product_id}
                    href={`/products/${product.product_id}`}
                    className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
                  >
                    {/* Image */}
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {product.primary_image ? (
                        <img
                          src={product.primary_image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground/30" />
                        </div>
                      )}
                      {product.stock <= 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-xs font-bold text-white bg-red-500 px-3 py-1 rounded-full">Hết hàng</span>
                        </div>
                      )}
                      {product.category && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 bg-primary/90 text-white rounded-full">
                          {product.category}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-2">
                      <h3 className="font-bold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>

                      {/* Price */}
                      <div className="space-y-1">
                        {token && (
                          <div className="flex items-center gap-1.5">
                            <CoinImage symbol={token.symbol} size={16} />
                            <span className="font-black text-foreground">
                              {Number(token.price_in_token).toFixed(token.symbol === 'ETH' ? 4 : 2)}
                            </span>
                            <span className="text-xs text-muted-foreground">{token.symbol}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          ${Number(product.base_price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      {/* Rating */}
                      {Number(product.rating_avg) > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>{Number(product.rating_avg).toFixed(1)}</span>
                          <span>({product.review_count})</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
