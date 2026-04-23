'use client';

import { useState, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import {
  Wifi, WifiOff, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Zap, Globe, Settings, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getAllChainSpecs, probeChainRpc, ensureCorrectChainRpc } from '@/lib/web3/ensure-chain';
import { getTestnetLiteChainMeta } from '@/lib/web3/testnet-lite';

interface ChainHealthResult {
  chainId: number;
  name: string;
  rpcUrl: string | null;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
  checking: boolean;
}

export function NetworkDiagnostics() {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const [results, setResults] = useState<ChainHealthResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [fixingChain, setFixingChain] = useState<number | null>(null);

  const runDiagnostics = useCallback(async () => {
    setChecking(true);
    const specs = getAllChainSpecs();

    // Initialize all as checking
    const initial: ChainHealthResult[] = specs.map(s => ({
      chainId: s.chainId,
      name: s.name,
      rpcUrl: s.rpcUrl,
      ok: false,
      latencyMs: null,
      error: null,
      checking: true,
    }));
    setResults(initial);

    // Probe each chain in parallel
    const probes = specs.map(async (spec) => {
      const result = await probeChainRpc(spec.chainId);
      return {
        chainId: spec.chainId,
        name: spec.name,
        rpcUrl: result.rpcUrl || spec.rpcUrl,
        ok: result.ok,
        latencyMs: result.latencyMs,
        error: result.error,
        checking: false,
      } as ChainHealthResult;
    });

    const settled = await Promise.all(probes);
    setResults(settled);
    setChecking(false);

    const okCount = settled.filter(r => r.ok).length;
    const failCount = settled.filter(r => !r.ok).length;
    if (failCount === 0) {
      toast.success(`Tất cả ${okCount} mạng đều hoạt động tốt!`);
    } else {
      toast.warning(`${okCount}/${settled.length} mạng OK, ${failCount} mạng có vấn đề`);
    }
  }, []);

  const handleFixChain = useCallback(async (chainId: number) => {
    if (!isConnected) {
      toast.error('Kết nối ví trước để sửa cấu hình mạng');
      return;
    }
    setFixingChain(chainId);
    try {
      const ok = await ensureCorrectChainRpc(chainId);
      if (ok) {
        toast.success(`Đã cập nhật RPC cho ${getTestnetLiteChainMeta(chainId)?.name || `Chain ${chainId}`}`);
        // Re-probe this chain
        const result = await probeChainRpc(chainId);
        setResults(prev => prev.map(r =>
          r.chainId === chainId
            ? { ...r, ok: result.ok, latencyMs: result.latencyMs, error: result.error, rpcUrl: result.rpcUrl || r.rpcUrl }
            : r
        ));
      } else {
        toast.info('Đã gửi yêu cầu — kiểm tra MetaMask nếu có popup');
      }
    } catch (e: any) {
      toast.error(e.message || 'Không thể cập nhật cấu hình mạng');
    } finally {
      setFixingChain(null);
    }
  }, [isConnected]);

  const handleFixAll = useCallback(async () => {
    if (!isConnected) {
      toast.error('Kết nối ví trước');
      return;
    }
    const failedChains = results.filter(r => !r.ok);
    for (const chain of failedChains) {
      await handleFixChain(chain.chainId);
    }
  }, [isConnected, results, handleFixChain]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8247e5]/10 border border-[#8247e5]/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#8247e5]" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Kiểm tra mạng Blockchain</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kiểm tra kết nối RPC và tự động sửa cấu hình MetaMask
            </p>
          </div>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8247e5] hover:bg-[#723bc9] text-white text-xs font-bold transition-all disabled:opacity-50"
        >
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {checking ? 'Đang kiểm tra...' : 'Kiểm tra tất cả'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="divide-y divide-border">
          <AnimatePresence>
            {results.map((r) => {
              const meta = getTestnetLiteChainMeta(r.chainId);
              const isActive = currentChainId === r.chainId;

              return (
                <motion.div
                  key={r.chainId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${isActive ? 'bg-[#8247e5]/5' : 'hover:bg-muted/50'}`}
                >
                  {/* Icon + Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0">{meta?.icon || '⛓️'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{r.name}</span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#8247e5]/15 border border-[#8247e5]/30 font-bold text-[#8247e5]">
                            ĐANG DÙNG
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground">
                          #{r.chainId}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">
                        {r.rpcUrl || 'Chưa cấu hình'}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {r.checking ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang kiểm tra</span>
                      </div>
                    ) : r.ok ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-bold">OK</span>
                        </div>
                        {r.latencyMs !== null && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            r.latencyMs < 200
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : r.latencyMs < 1000
                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                            {r.latencyMs}ms
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs font-bold truncate max-w-[120px]" title={r.error || undefined}>
                            {r.error || 'Lỗi'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleFixChain(r.chainId)}
                          disabled={fixingChain === r.chainId || !isConnected}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-all disabled:opacity-50"
                        >
                          {fixingChain === r.chainId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Settings className="w-3 h-3" />
                          )}
                          Sửa RPC
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="p-8 text-center">
          <Wifi className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Chưa kiểm tra</p>
          <p className="text-xs text-muted-foreground/70">
            Nhấn "Kiểm tra tất cả" để xác minh kết nối RPC tới các blockchain
          </p>
        </div>
      )}

      {/* Fix All banner */}
      {results.length > 0 && results.some(r => !r.ok && !r.checking) && (
        <div className="p-4 bg-amber-500/5 border-t border-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-semibold">
              {results.filter(r => !r.ok).length} mạng cần sửa cấu hình
            </span>
          </div>
          <button
            onClick={handleFixAll}
            disabled={!isConnected || fixingChain !== null}
            className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-all disabled:opacity-50"
          >
            Sửa tất cả
          </button>
        </div>
      )}

      {/* Info footer */}
      <div className="p-4 border-t border-border bg-muted/30">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          💡 <strong>Mẹo:</strong> Nếu nút "Sửa RPC" không hoạt động, mở MetaMask → Settings → Networks → chọn mạng lỗi → sửa URL RPC thành URL hiển thị ở trên.
          Đối với chain <strong>Hardhat VPS (#31337)</strong>, RPC phải là <code className="bg-muted px-1 py-0.5 rounded text-[10px]">http://103.20.96.79:8545</code>
        </p>
      </div>
    </div>
  );
}
