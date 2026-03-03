'use client';

import { create } from 'zustand';
import type { PriceData } from '@/types';

interface PriceState {
  prices: Record<string, PriceData>;
  isConnected: boolean;
  ws: WebSocket | null;

  setPrice: (symbol: string, data: PriceData) => void;
  setConnected: (connected: boolean) => void;
  connect: (symbols: string[]) => void;
  disconnect: () => void;
}

export const usePriceStore = create<PriceState>()((set, get) => ({
  prices: {},
  isConnected: false,
  ws: null,

  setPrice: (symbol, data) =>
    set((state) => ({
      prices: { ...state.prices, [symbol]: data },
    })),

  setConnected: (connected) => set({ isConnected: connected }),

  connect: (symbols) => {
    const existing = get().ws;
    if (existing && existing.readyState === WebSocket.OPEN) return;

    const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/stream?streams=${streams}`
    );

    ws.onopen = () => set({ isConnected: true });
    ws.onclose = () => {
      set({ isConnected: false, ws: null });
      // Auto-reconnect after 5s
      setTimeout(() => get().connect(symbols), 5000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.data) {
          const d = message.data;
          const priceData: PriceData = {
            symbol: d.s,
            price: parseFloat(d.c),
            change24h: parseFloat(d.P),
            high24h: parseFloat(d.h),
            low24h: parseFloat(d.l),
            volume24h: parseFloat(d.v),
          };
          set((state) => ({
            prices: { ...state.prices, [d.s]: priceData },
          }));
        }
      } catch {
        // ignore parse errors
      }
    };

    set({ ws });
  },

  disconnect: () => {
    const ws = get().ws;
    if (ws) ws.close();
    set({ ws: null, isConnected: false });
  },
}));
