/**
 * ensure-chain.ts
 * -----------------------------------------------------------------
 * Ensures MetaMask (or any EIP-3085 wallet) has the correct RPC URL
 * for each chain we support.  When users added chain 31337 long ago
 * with "http://127.0.0.1:8545", that stale value is cached forever
 * unless the dApp explicitly pushes an update via
 * wallet_addEthereumChain.
 *
 * Call `ensureCorrectChainRpc(chainId)` **before** any transaction
 * to silently fix a stale RPC without asking the user to manually
 * edit MetaMask settings.
 * -----------------------------------------------------------------
 */

import { getTestnetLiteChainMeta } from './testnet-lite';

/* ── authoritative RPC URLs per chain ────────────────────────── */
const HARDHAT_RPC = process.env.NEXT_PUBLIC_HARDHAT_RPC_URL || 'http://103.20.96.79:8545';

interface ChainSpec {
  chainId: string;          // hex, e.g. "0x7a69"
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
}

const CHAIN_SPECS: Record<number, ChainSpec> = {
  31337: {
    chainId: '0x7a69',
    chainName: 'Hardhat VPS',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [HARDHAT_RPC],
    blockExplorerUrls: [],
  },
  84532: {
    chainId: '0x14a34',
    chainName: 'Base Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  },
  80002: {
    chainId: '0x13882',
    chainName: 'Polygon Amoy',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
  },
  97: {
    chainId: '0x61',
    chainName: 'BNB Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  },
  421614: {
    chainId: '0x66eee',
    chainName: 'Arbitrum Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  },
};

/**
 * Call wallet_addEthereumChain to push correct RPC to MetaMask.
 * If chain already exists, modern MetaMask updates its RPC.
 * If chain is unknown, MetaMask prompts to add it.
 */
export async function ensureCorrectChainRpc(chainId: number): Promise<boolean> {
  const spec = CHAIN_SPECS[chainId];
  if (!spec) return false; // unknown chain, skip

  const provider = typeof window !== 'undefined'
    ? (window as any).ethereum
    : null;
  if (!provider?.request) return false;

  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [spec],
    });
    return true;
  } catch (e: any) {
    // Code 4001 = user rejected the prompt — not a real error
    if (e.code === 4001) return false;
    console.warn('[ensureCorrectChainRpc] failed for chain', chainId, e.message);
    return false;
  }
}

/**
 * Test if MetaMask can actually reach the RPC for a given chain
 * by calling eth_chainId. Returns { ok, latencyMs, error }.
 */
export async function probeChainRpc(chainId: number): Promise<{
  ok: boolean;
  latencyMs: number | null;
  rpcUrl: string | null;
  error: string | null;
}> {
  const spec = CHAIN_SPECS[chainId];
  const meta = getTestnetLiteChainMeta(chainId);
  const rpcUrl = spec?.rpcUrls?.[0] || meta?.rpcUrl || null;

  if (!rpcUrl) return { ok: false, latencyMs: null, rpcUrl: null, error: 'No RPC URL configured' };

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    const latencyMs = Math.round(performance.now() - start);

    if (data.result) {
      const returnedChainId = parseInt(data.result, 16);
      if (returnedChainId !== chainId) {
        return { ok: false, latencyMs, rpcUrl, error: `Chain ID mismatch: expected ${chainId}, got ${returnedChainId}` };
      }
      return { ok: true, latencyMs, rpcUrl, error: null };
    }

    return { ok: false, latencyMs, rpcUrl, error: data.error?.message || 'Invalid RPC response' };
  } catch (e: any) {
    const latencyMs = Math.round(performance.now() - start);
    if (e.name === 'AbortError') {
      return { ok: false, latencyMs, rpcUrl, error: 'Timeout (5s)' };
    }
    return { ok: false, latencyMs, rpcUrl, error: e.message || 'Connection failed' };
  }
}

/** Get all supported chain specs for diagnostics UI */
export function getAllChainSpecs() {
  return Object.entries(CHAIN_SPECS).map(([id, spec]) => ({
    chainId: Number(id),
    name: spec.chainName,
    rpcUrl: spec.rpcUrls[0],
    explorerUrl: spec.blockExplorerUrls?.[0] || null,
    nativeSymbol: spec.nativeCurrency.symbol,
  }));
}
