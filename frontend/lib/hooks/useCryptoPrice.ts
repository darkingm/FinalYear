'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(
        process.env.NEXT_PUBLIC_BINANCE_WS || 'wss://stream.binance.com:9443/ws'
      );

      ws.onopen = () => {
        console.log('Binance WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Subscribe to ticker streams for all symbols
        const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join('/');
        ws.send(
          JSON.stringify({
            method: 'SUBSCRIBE',
            params: symbols.map((s) => `${s.toLowerCase()}@ticker`),
            id: 1,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

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
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('Binance WebSocket closed');
        setIsConnected(false);

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to price feed');
    }
  }, [symbols]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
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
