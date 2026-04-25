'use client';

/**
 * CheckoutSwapWidget — Inline token swap for checkout page.
 * Uses PancakeSwap V2 (BNB Testnet 97) and QuickSwap V2 (Polygon Amoy 80002).
 * Only renders on chains that have a DEX router configured.
 *
 * Cross-chain bridge is shown as a separate panel with external bridge links
 * (true cross-chain bridges on testnets are extremely limited).
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ArrowDownUp, ExternalLink, Loader2, AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatUnits } from 'viem';
import { CoinImage } from '@/components/ui/CoinImage';
import {
  type SwapToken,
  getSwapTokensForChain,
  getDexRouter,
} from '@/lib/web3/swap';
import {
  useTokenBalances,
  useSwapQuote,
  useSwapExecute,
} from '@/lib/web3/useSwap';

/* ─── Bridge links for cross-chain ─────────────────────────────────── */
const BRIDGE_LINKS: { name: string; url: string; chains: string; icon: string }[] = [
  {
    name: 'BNB Testnet Bridge',
    url: 'https://testnet.bnbchain.org/faucet-smart',
    chains: 'BNB Testnet Faucet',
    icon: '🟡',
  },
  {
    name: 'Chainlink CCIP',
    url: 'https://ccip.chain.link/',
    chains: 'Sepolia ↔ Amoy ↔ BNB',
    icon: '🔗',
  },
  {
    name: 'LayerZero Testnet',
    url: 'https://testnetbridge.com/',
    chains: 'Multi-chain Bridge',
    icon: '🌐',
  },
  {
    name: 'Polygon Bridge',
    url: 'https://portal.polygon.technology/bridge',
    chains: 'Ethereum ↔ Polygon',
    icon: '🟣',
  },
];

/* ─── Props ─────────────────────────────────────────────────── */
interface CheckoutSwapWidgetProps {
  chainId: number | undefined;
  /** Called after successful swap to refresh balances */
  onSwapComplete?: () => void;
}

export function CheckoutSwapWidget({ chainId, onSwapComplete }: CheckoutSwapWidgetProps) {
  const { isConnected } = useAccount();
  const [expanded, setExpanded] = useState(false);
  const [showBridge, setShowBridge] = useState(false);

  const hasDex = chainId ? !!getDexRouter(chainId) : false;
  const dex = chainId ? getDexRouter(chainId) : null;

  // Don't render anything if wallet not connected
  if (!isConnected) return null;

  return (
    <div className="mt-3 rounded-xl border border-border/50 overflow-hidden">
      {/* ── Toggle header ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ArrowDownUp className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-muted-foreground">
            Swap & Bridge Token
          </span>
          {hasDex && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
              {dex?.name}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Tab selector */}
          <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg">
            <button
              onClick={() => setShowBridge(false)}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${!showBridge ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              🔄 Swap (cùng chain)
            </button>
            <button
              onClick={() => setShowBridge(true)}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${showBridge ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              🌉 Bridge (cross-chain)
            </button>
          </div>

          {!showBridge ? (
            <SwapPanel chainId={chainId} onSwapComplete={onSwapComplete} />
          ) : (
            <BridgePanel chainId={chainId} />
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SWAP PANEL — on-chain DEX swap within the same chain
   ════════════════════════════════════════════════════════════════════════ */

function SwapPanel({ chainId, onSwapComplete }: { chainId: number | undefined; onSwapComplete?: () => void }) {
  const { executeSwap, executing } = useSwapExecute();
  const { tokens: balances, loading: balLoading, refetch } = useTokenBalances(chainId);
  const dex = chainId ? getDexRouter(chainId) : null;
  const swapTokens = chainId ? getSwapTokensForChain(chainId) : [];

  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(swapTokens.length > 1 ? 1 : 0);
  const [amount, setAmount] = useState('');

  // Reset indices when chain changes
  useEffect(() => {
    setFromIdx(0);
    setToIdx(swapTokens.length > 1 ? 1 : 0);
    setAmount('');
  }, [chainId, swapTokens.length]);

  const fromToken = swapTokens[fromIdx] || null;
  const toToken = swapTokens[toIdx] || null;

  const { quote, loading: quoteLoading, error: quoteError } = useSwapQuote(
    chainId, fromToken, toToken, amount, 50
  );

  const fromBalance = balances.find(b => b.symbol === fromToken?.symbol);

  if (!dex) {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <p className="text-xs text-amber-400">
          Mạng này chưa có DEX Router. Swap chỉ hỗ trợ trên <b>BNB Testnet</b> (PancakeSwap) và <b>Polygon Amoy</b> (QuickSwap).
        </p>
      </div>
    );
  }

  const handleFlip = () => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
    setAmount('');
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !quote || !chainId) return;
    try {
      await executeSwap(chainId, fromToken, toToken, quote);
      toast.success('Swap thành công!');
      setAmount('');
      refetch();
      onSwapComplete?.();
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Swap thất bại');
    }
  };

  const handleSetMax = () => {
    if (fromBalance) {
      // Leave some gas for native token
      const val = parseFloat(fromBalance.formattedBalance);
      const maxVal = fromToken?.isNative ? Math.max(0, val - 0.005) : val;
      setAmount(maxVal > 0 ? maxVal.toString() : '0');
    }
  };

  return (
    <div className="space-y-2">
      {/* From token */}
      <div className="bg-white/5 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bán</span>
          {fromBalance && (
            <button onClick={handleSetMax} className="text-[10px] text-emerald-400 hover:underline">
              Số dư: {fromBalance.formattedBalance} {fromToken?.symbol}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fromIdx}
            onChange={e => { setFromIdx(Number(e.target.value)); setAmount(''); }}
            className="bg-transparent text-sm font-bold border-none outline-none cursor-pointer min-w-[80px]"
          >
            {swapTokens.map((t, i) => (
              <option key={t.symbol} value={i} className="bg-gray-900">{t.symbol}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 bg-transparent text-right text-sm font-mono outline-none"
          />
        </div>
      </div>

      {/* Flip button */}
      <div className="flex justify-center -my-1">
        <button
          onClick={handleFlip}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowDownUp className="w-3 h-3" />
        </button>
      </div>

      {/* To token */}
      <div className="bg-white/5 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Mua</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={toIdx}
            onChange={e => setToIdx(Number(e.target.value))}
            className="bg-transparent text-sm font-bold border-none outline-none cursor-pointer min-w-[80px]"
          >
            {swapTokens.map((t, i) => (
              <option key={t.symbol} value={i} className="bg-gray-900">{t.symbol}</option>
            ))}
          </select>
          <div className="flex-1 text-right text-sm font-mono text-muted-foreground">
            {quoteLoading ? (
              <Loader2 className="w-3 h-3 animate-spin inline" />
            ) : quote ? (
              <span className="text-foreground">{parseFloat(quote.amountOutFormatted).toFixed(6)}</span>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Quote details */}
      {quote && (
        <div className="text-[10px] text-muted-foreground space-y-0.5 px-1">
          <div className="flex justify-between">
            <span>Tối thiểu nhận:</span>
            <span>{parseFloat(quote.minimumReceivedFormatted).toFixed(6)} {toToken?.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span>Slippage:</span>
            <span>0.5%</span>
          </div>
          <div className="flex justify-between">
            <span>DEX:</span>
            <span className="text-emerald-400">{dex.name}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {quoteError && (
        <div className="flex items-start gap-1.5 p-2 bg-red-500/10 rounded-lg">
          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-400">{quoteError}</p>
        </div>
      )}

      {/* Swap button */}
      <button
        onClick={handleSwap}
        disabled={!quote || executing || !amount || parseFloat(amount) <= 0}
        className="w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 text-white"
      >
        {executing ? (
          <><Loader2 className="w-3 h-3 animate-spin inline mr-1" />Đang swap...</>
        ) : (
          `Swap ${fromToken?.symbol || ''} → ${toToken?.symbol || ''}`
        )}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   BRIDGE PANEL — cross-chain bridge links + info
   ════════════════════════════════════════════════════════════════════════ */

function BridgePanel({ chainId }: { chainId: number | undefined }) {
  return (
    <div className="space-y-3">
      {/* Info box */}
      <div className="flex items-start gap-2 p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <Info className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-purple-300 space-y-1">
          <p className="font-medium">Cross-chain Bridge</p>
          <p className="text-purple-400/80">
            Chuyển token giữa các blockchain khác nhau (ví dụ: ETH trên Ethereum → BNB trên BSC).
            Sử dụng các bridge protocol bên dưới để chuyển token sang mạng bạn muốn thanh toán.
          </p>
        </div>
      </div>

      {/* Bridge links */}
      <div className="space-y-1.5">
        {BRIDGE_LINKS.map((bridge) => (
          <a
            key={bridge.name}
            href={bridge.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-border/30 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{bridge.icon}</span>
              <div>
                <p className="text-xs font-semibold">{bridge.name}</p>
                <p className="text-[10px] text-muted-foreground">{bridge.chains}</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>
        ))}
      </div>

      {/* How it works */}
      <div className="text-[10px] text-muted-foreground p-2.5 bg-white/5 rounded-lg space-y-1">
        <p className="font-semibold text-foreground text-xs mb-1">Cách hoạt động:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Mở bridge protocol phù hợp</li>
          <li>Kết nối ví MetaMask</li>
          <li>Chọn chain nguồn → chain đích</li>
          <li>Nhập số token cần chuyển</li>
          <li>Confirm giao dịch bridge</li>
          <li>Đợi 2-15 phút để token xuất hiện trên chain đích</li>
          <li>Quay lại trang thanh toán và tiếp tục</li>
        </ol>
      </div>
    </div>
  );
}

export default CheckoutSwapWidget;
