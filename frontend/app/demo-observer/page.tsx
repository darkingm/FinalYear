'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Eye, Wallet, RefreshCw, Loader2, Search,
  ArrowRight, Shield, AlertTriangle, Copy, Check,
} from 'lucide-react';
import { createPublicClient, http, formatEther, type Address } from 'viem';
import { hardhat } from 'viem/chains';
import { ESCROW_CONTRACTS, DEFAULT_CHAIN_ID } from '@/lib/web3/config';
import { getRecommendedCheckoutChainMetas } from '@/lib/web3/testnet-lite';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface WalletSnapshot {
  label: string;
  address: string;
  balance: string;
  color: string;
}

/* ─── Viem public client for on-chain reads ───────────────────────────────── */
function getPublicClient(chainId: number) {
  const meta = getRecommendedCheckoutChainMetas().find(m => m.chainId === chainId);
  const rpcUrl = meta?.rpcUrl || 'http://103.20.96.79:8545';
  return createPublicClient({
    chain: { ...hardhat, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  });
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function DemoObserverPage() {
  const chainId = DEFAULT_CHAIN_ID;
  const escrowAddress = ESCROW_CONTRACTS[chainId];

  const [wallets, setWallets] = useState<WalletSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [customAddr, setCustomAddr] = useState('');
  const [customWallets, setCustomWallets] = useState<WalletSnapshot[]>([]);
  const [copied, setCopied] = useState('');

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // Hardhat Account #0 (deployer/faucet) — public knowledge
  const HARDHAT_DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const client = getPublicClient(chainId);

      const addresses: { label: string; address: string; color: string }[] = [
        { label: 'Escrow Contract', address: escrowAddress || '', color: '#f0b90b' },
        { label: 'Deployer / Faucet (Account #0)', address: HARDHAT_DEPLOYER, color: '#627eea' },
      ];

      // Fetch all balances in parallel
      const results = await Promise.all(
        addresses
          .filter(a => a.address && a.address !== '0x0000000000000000000000000000000000000000')
          .map(async (a) => {
            try {
              const balance = await client.getBalance({ address: a.address as Address });
              return {
                label: a.label,
                address: a.address,
                balance: formatEther(balance),
                color: a.color,
              };
            } catch {
              return { label: a.label, address: a.address, balance: 'Error', color: a.color };
            }
          })
      );

      setWallets(results);
      toast.success('Balances refreshed');
    } catch (e: any) {
      toast.error('Failed to fetch balances: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  }, [chainId, escrowAddress]);

  const addCustomWallet = async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(customAddr)) {
      toast.error('Invalid address format (0x...)');
      return;
    }
    // Check not already added
    if (customWallets.some(w => w.address.toLowerCase() === customAddr.toLowerCase())) {
      toast.info('Address already tracked');
      return;
    }
    try {
      const client = getPublicClient(chainId);
      const balance = await client.getBalance({ address: customAddr as Address });
      setCustomWallets(prev => [...prev, {
        label: `Custom ${prev.length + 1}`,
        address: customAddr,
        balance: formatEther(balance),
        color: '#8247e5',
      }]);
      setCustomAddr('');
      toast.success('Wallet added');
    } catch {
      toast.error('Failed to fetch balance');
    }
  };

  const refreshAll = async () => {
    await fetchBalances();
    // Refresh custom wallets too
    if (customWallets.length > 0) {
      const client = getPublicClient(chainId);
      const updated = await Promise.all(customWallets.map(async w => {
        try {
          const balance = await client.getBalance({ address: w.address as Address });
          return { ...w, balance: formatEther(balance) };
        } catch {
          return { ...w, balance: 'Error' };
        }
      }));
      setCustomWallets(updated);
    }
  };

  const allWallets = [...wallets, ...customWallets];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[10%] w-[400px] h-[400px] bg-[#f0b90b]/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[15%] w-[300px] h-[300px] bg-[#627eea]/5 rounded-full blur-[100px]" />
          </div>
          <div className="container mx-auto px-4 py-10 max-w-5xl relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-[#f0b90b]" />
                  </div>
                  <h1 className="text-2xl font-black text-foreground">Demo Observer</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                  Live on-chain balance viewer for demo presentations. Chain {chainId} (Hardhat VPS).
                </p>
              </div>
              <button
                onClick={refreshAll}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#f0b90b] text-black font-bold rounded-xl text-sm hover:bg-[#e6a800] transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {wallets.length === 0 ? 'Load Balances' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
          {/* Add custom wallet */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-[#f0b90b]" />
              Track any wallet address
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={customAddr}
                onChange={(e) => setCustomAddr(e.target.value)}
                placeholder="0x... (buyer, seller, or any address)"
                className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-xl text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#f0b90b]/30"
              />
              <button
                onClick={addCustomWallet}
                className="px-5 py-2.5 bg-[#8247e5] text-white font-bold rounded-xl text-sm hover:bg-[#6f3dcc] transition-colors flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Track
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Paste any MetaMask address to see its live ETH balance on chain {chainId}. Useful for verifying buyer/seller payouts during demo.
            </p>
          </div>

          {/* Balance cards */}
          {allWallets.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Live Balances — Chain {chainId}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allWallets.map((w, i) => {
                  const balanceNum = parseFloat(w.balance);
                  const isLow = !isNaN(balanceNum) && balanceNum < 0.01;
                  return (
                    <motion.div
                      key={w.address + i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border border-border rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: w.color }}
                          />
                          <span className="text-sm font-bold">{w.label}</span>
                        </div>
                        {isLow && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <AlertTriangle className="w-3 h-3" /> Low
                          </span>
                        )}
                      </div>

                      {/* Balance */}
                      <div className="text-3xl font-black" style={{ color: w.color }}>
                        {isNaN(balanceNum) ? w.balance : balanceNum.toFixed(4)}
                        <span className="text-base font-medium text-muted-foreground ml-2">ETH</span>
                      </div>

                      {/* Address */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border">
                        <code className="text-xs font-mono text-muted-foreground flex-1 truncate">{w.address}</code>
                        <button
                          onClick={() => copyText(w.address, `obs-${i}`)}
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copied === `obs-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {allWallets.length === 0 && (
            <div className="text-center py-20">
              <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">Click <strong>Load Balances</strong> to fetch on-chain data</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Or paste a wallet address above to track it</p>
            </div>
          )}

          {/* How to use */}
          <div className="bg-muted/50 border border-border rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[#f0b90b]" />
              Demo workflow
            </h3>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Click <strong>Load Balances</strong> to see Escrow + Deployer balances</li>
              <li>Paste <strong>buyer MetaMask address</strong> and click Track</li>
              <li>Paste <strong>seller MetaMask address</strong> and click Track</li>
              <li>Complete a purchase on another tab — buyer pays into Escrow</li>
              <li>Click <strong>Refresh</strong> to see Escrow balance increase</li>
              <li>Confirm delivery — Refresh again to see funds move to seller wallet</li>
            </ol>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
