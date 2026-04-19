'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

export interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export function useCryptoPrice(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, CryptoPrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectEnabledRef = useRef(false);

  const symbolsKey = symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean).join(',');
  const normalizedSymbols = useMemo(
    () => symbolsKey.split(',').filter(Boolean),
    [symbolsKey]
  );

  const connect = useCallback(() => {
    if (normalizedSymbols.length === 0) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const streams = normalizedSymbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join('/');
      const ws = new WebSocket(
        process.env.NEXT_PUBLIC_BINANCE_WS || `wss://stream.binance.com:9443/stream?streams=${streams}`
      );

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const data = payload?.data ?? payload;

          if (data.e === '24hrTicker') {
            setPrices((prev) => ({
              ...prev,
              [data.s]: {
                symbol: data.s,
                price: parseFloat(data.c),
                change24h: parseFloat(data.P),
                high24h: parseFloat(data.h),
                low24h: parseFloat(data.l),
                volume24h: parseFloat(data.v),
              },
            }));
          }
        } catch {
          setError('Failed to parse price feed');
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (!reconnectEnabledRef.current) {
          return;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    } catch {
      setError('Failed to connect to price feed');
    }
  }, [normalizedSymbols]);

  useEffect(() => {
    reconnectEnabledRef.current = true;
    connect();

    return () => {
      reconnectEnabledRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    prices,
    isConnected,
    error,
    reconnect: connect,
  };
}
