import { useState, useEffect, useRef } from 'react';

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

const priceCache = new Map<string, { data: PriceData; timestamp: number }>();
const CACHE_DURATION = 2000; // 2 seconds

export function useCryptoPriceOptimized(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Load from cache immediately
    const cached: Record<string, PriceData> = {};
    symbols.forEach(symbol => {
      const cache = priceCache.get(symbol);
      if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
        cached[symbol] = cache.data;
      }
    });
    if (Object.keys(cached).length > 0) {
      setPrices(cached);
    }

    // Connect WebSocket
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.data) {
        const data = message.data;
        const priceData: PriceData = {
          symbol: data.s,
          price: parseFloat(data.c),
          change24h: parseFloat(data.P),
          high24h: parseFloat(data.h),
          low24h: parseFloat(data.l),
          volume24h: parseFloat(data.v),
        };

        // Update cache
        priceCache.set(data.s, { data: priceData, timestamp: Date.now() });

        setPrices(prev => ({
          ...prev,
          [data.s]: priceData,
        }));
      }
    };

    return () => {
      ws.close();
    };
  }, [symbols.join(',')]);

  return { prices, isConnected };
}
