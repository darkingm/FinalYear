'use client';

import { create } from 'zustand';
import type { PriceData } from '@/types';

/**
 * price-store.ts — Live prices via Binance REST API (polling).
 *
 * Strategy:
 * - Fetch real Binance prices every 5s (realistic refresh rate)
 * - Apply ±0.1% micro-jitter every 400ms so prices "breathe" between polls
 *   (looks alive without being erratic / unrealistic)
 */

const BINANCE_REST = 'https://api.binance.com/api/v3';

// Stores the last REAL Binance price for each symbol (used as jitter base)
const realPriceCache: Record<string, number> = {};
// Stores last known PriceData (for direction / 24h data)
const dataCache: Record<string, PriceData> = {};

interface PriceState {
  prices: Record<string, PriceData>;
  displaySnapshotPrices: Record<string, PriceData>;
  isConnected: boolean;
  ws: null;

  setPrice: (symbol: string, data: PriceData) => void;
  setConnected: (connected: boolean) => void;
  connect: (symbols: string[]) => void;
  disconnect: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let jitterTimer: ReturnType<typeof setInterval> | null = null;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let pollSymbols: string[] = [];

/** Tiny noise: ±0.005% around the real price — subtle breathing */
const applyJitter = (real: number): number => {
  const noise = (Math.random() - 0.5) * 2; // [-1, 1]
  return real * (1 + noise * 0.00005);       // ±0.005% — barely noticeable
};

const buildDisplaySnapshot = (): Record<string, PriceData> => {
  const snapshot: Record<string, PriceData> = {};

  for (const sym of pollSymbols) {
    const base = dataCache[sym];
    const real = realPriceCache[sym];
    if (!base) continue;

    snapshot[sym] = {
      ...base,
      price: Number.isFinite(real) && real > 0 ? real : base.price,
    };
  }

  return snapshot;
};

export const usePriceStore = create<PriceState>()((set, get) => ({
  prices: {},
  displaySnapshotPrices: {},
  isConnected: false,
  ws: null,

  setPrice: (symbol, data) =>
    set((state) => ({ prices: { ...state.prices, [symbol]: data } })),

  setConnected: (connected) => set({ isConnected: connected }),

  connect: (symbols) => {
    // MERGE new symbols with existing set — multiple callers are additive
    const merged = [...new Set([...pollSymbols, ...symbols])];
    const isAlreadyPolling =
      pollTimer !== null &&
      merged.length === pollSymbols.length &&
      merged.every((s) => pollSymbols.includes(s));

    if (isAlreadyPolling) return;

    pollSymbols = merged;

    if (pollTimer) clearInterval(pollTimer);
    if (jitterTimer) clearInterval(jitterTimer);
    if (snapshotTimer) clearInterval(snapshotTimer);

    const fetchAll = async () => {
      try {
        const symbolParam = encodeURIComponent(JSON.stringify(pollSymbols));
        const res = await fetch(`${BINANCE_REST}/ticker/24hr?symbols=${symbolParam}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data: any[] = await res.json();

        const updates: Record<string, PriceData> = {};
        for (const d of data) {
          const curr = parseFloat(d.lastPrice);
          const prev = realPriceCache[d.symbol];
          realPriceCache[d.symbol] = curr; // store real price

          const entry: PriceData = {
            symbol: d.symbol,
            price: applyJitter(curr),  // display with tiny jitter
            change24h: parseFloat(d.priceChangePercent),
            high24h: parseFloat(d.highPrice),
            low24h: parseFloat(d.lowPrice),
            volume24h: parseFloat(d.volume),
            direction: prev !== undefined ? (curr > prev ? 'up' : curr < prev ? 'down' : 'same') : 'same',
          } as any;

          updates[d.symbol] = entry;
          dataCache[d.symbol] = entry;
        }

        const currentSnapshot = get().displaySnapshotPrices;
        const seededSnapshot = buildDisplaySnapshot();

        set((state) => ({
          prices: { ...state.prices, ...updates },
          displaySnapshotPrices: {
            ...state.displaySnapshotPrices,
            ...Object.fromEntries(
              Object.entries(seededSnapshot).filter(([symbol]) => !currentSnapshot[symbol])
            ),
          },
          isConnected: true,
        }));
      } catch {
        set({ isConnected: false });
      }
    };

    // Real Binance fetch every 5s (same as Binance web ticker)
    fetchAll();
    pollTimer = setInterval(fetchAll, 5000);

    // Local micro-jitter every 2s — gentle price breathing between polls
    jitterTimer = setInterval(() => {
      const jittered: Record<string, PriceData> = {};
      let hasAny = false;
      for (const sym of pollSymbols) {
        const real = realPriceCache[sym];
        const base = dataCache[sym];
        if (real && base) {
          jittered[sym] = { ...base, price: applyJitter(real) };
          hasAny = true;
        }
      }
      if (hasAny) {
        set((state) => ({ prices: { ...state.prices, ...jittered } }));
      }
    }, 2000);

    snapshotTimer = setInterval(() => {
      const snapshot = buildDisplaySnapshot();
      if (Object.keys(snapshot).length > 0) {
        set((state) => ({
          displaySnapshotPrices: { ...state.displaySnapshotPrices, ...snapshot },
        }));
      }
    }, 30000);

    set({ isConnected: true });
  },

  disconnect: () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (jitterTimer) { clearInterval(jitterTimer); jitterTimer = null; }
    if (snapshotTimer) { clearInterval(snapshotTimer); snapshotTimer = null; }
    set({ isConnected: false });
  },
}));
