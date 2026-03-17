'use client';

import { create } from 'zustand';
import type { PriceData } from '@/types';

/**
 * price-store.ts — Live prices via Binance REST API (polling).
 *
 * WHY NOT WEBSOCKET?
 * Binance wss://stream.binance.com:9443 is blocked in many browsers
 * from localhost/non-whitelisted origins (CORS policy + firewall).
 * REST polling is far more reliable across environments.
 * We poll every 1.5s to simulate "live" feel.
 */

const BINANCE_REST = 'https://api.binance.com/api/v3';

// Cache previous prices to compute direction (up/down flash)
const priceCache: Record<string, number> = {};

interface PriceState {
  prices: Record<string, PriceData>;
  isConnected: boolean;
  ws: null; // kept for API compatibility

  setPrice: (symbol: string, data: PriceData) => void;
  setConnected: (connected: boolean) => void;
  connect: (symbols: string[]) => void;
  disconnect: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollSymbols: string[] = [];

export const usePriceStore = create<PriceState>()((set, get) => ({
  prices: {},
  isConnected: false,
  ws: null,

  setPrice: (symbol, data) =>
    set((state) => ({ prices: { ...state.prices, [symbol]: data } })),

  setConnected: (connected) => set({ isConnected: connected }),

  connect: (symbols) => {
    // Deduplicate — if same symbols already polling, skip
    if (
      pollTimer &&
      symbols.length === pollSymbols.length &&
      symbols.every((s) => pollSymbols.includes(s))
    ) return;

    pollSymbols = symbols;

    // Clear any existing poll
    if (pollTimer) clearInterval(pollTimer);

    const fetchAll = async () => {
      try {
        // Batch fetch all 24hr tickers
        const symbolParam = encodeURIComponent(JSON.stringify(symbols));
        const res = await fetch(`${BINANCE_REST}/ticker/24hr?symbols=${symbolParam}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data: any[] = await res.json();

        const updates: Record<string, PriceData> = {};
        for (const d of data) {
          const prev = priceCache[d.symbol];
          const curr = parseFloat(d.lastPrice);
          priceCache[d.symbol] = curr;
          updates[d.symbol] = {
            symbol: d.symbol,
            price: curr,
            change24h: parseFloat(d.priceChangePercent),
            high24h: parseFloat(d.highPrice),
            low24h: parseFloat(d.lowPrice),
            volume24h: parseFloat(d.volume),
            // Extra: direction for flash animation
            direction: prev !== undefined ? (curr > prev ? 'up' : curr < prev ? 'down' : 'same') : 'same',
          } as any;
        }

        set((state) => ({
          prices: { ...state.prices, ...updates },
          isConnected: true,
        }));
      } catch {
        set({ isConnected: false });
      }
    };

    // Fetch immediately then every 1.5s
    fetchAll();
    pollTimer = setInterval(fetchAll, 1500);
    set({ isConnected: true });
  },

  disconnect: () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    set({ isConnected: false });
  },
}));
