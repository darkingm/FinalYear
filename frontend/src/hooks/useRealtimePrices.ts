import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface PriceUpdate {
  coinId: string;
  price: number;
  priceUSD: number;
  priceChange24h: number;
  timestamp: string;
}

interface UseRealtimePricesOptions {
  coinIds: string[];
  enabled?: boolean;
  onPriceUpdate?: (update: PriceUpdate) => void;
}

interface CoinPrice {
  coinId: string;
  price: number;
  priceUSD: number;
  priceChange24h: number;
  lastUpdate: string;
}

export const useRealtimePrices = (options: UseRealtimePricesOptions) => {
  const { coinIds, enabled = true, onPriceUpdate } = options;
  const [prices, setPrices] = useState<Record<string, CoinPrice>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || coinIds.length === 0) {
      return;
    }

    // Connect to WebSocket
    const socketUrl = process.env.REACT_APP_COIN_MARKET_WS_URL || 
                     process.env.REACT_APP_API_URL?.replace('http', 'ws') || 
                     'ws://localhost:3004';
    
    const socket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to price WebSocket');
      setConnected(true);
      setError(null);

      // Subscribe to coin prices
      socket.emit('price:subscribe', coinIds);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from price WebSocket');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError('Failed to connect to price service');
      setConnected(false);

      // Retry connection after delay
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        socket.connect();
      }, 5000);
    });

    socket.on('price:update', (update: PriceUpdate) => {
      setPrices((prev) => ({
        ...prev,
        [update.coinId]: {
          coinId: update.coinId,
          price: update.price,
          priceUSD: update.priceUSD,
          priceChange24h: update.priceChange24h,
          lastUpdate: update.timestamp,
        },
      }));

      if (onPriceUpdate) {
        onPriceUpdate(update);
      }
    });

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.emit('price:unsubscribe', coinIds);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [coinIds.join(','), enabled, onPriceUpdate]);

  // Update subscription when coinIds change
  useEffect(() => {
    if (socketRef.current && connected) {
      // Unsubscribe from old coins
      socketRef.current.emit('price:unsubscribe', coinIds);
      // Subscribe to new coins
      socketRef.current.emit('price:subscribe', coinIds);
    }
  }, [coinIds.join(','), connected]);

  return {
    prices,
    connected,
    error,
    getPrice: (coinId: string) => prices[coinId]?.priceUSD || null,
  };
};

