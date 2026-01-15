import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { COIN_MARKET_WS_URL } from '../constants/config';

export const useRealtimePrices = (coinIds: string[] = []) => {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(COIN_MARKET_WS_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current.on('connect', () => {
        console.log('Connected to Coin Market WebSocket');
        if (coinIds.length > 0) {
          socketRef.current?.emit('price:subscribe', coinIds);
        }
      });

      socketRef.current.on('disconnect', () => {
        console.log('Disconnected from Coin Market WebSocket');
      });

      socketRef.current.on('price:update', (data: any) => {
        setPrices((prev) => ({
          ...prev,
          [data.coinId]: data,
        }));
      });
    }

    if (coinIds.length > 0 && socketRef.current.connected) {
      socketRef.current.emit('price:subscribe', coinIds);
    }

    return () => {
      if (socketRef.current && coinIds.length > 0) {
        socketRef.current.emit('price:unsubscribe', coinIds);
      }
    };
  }, [coinIds]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return prices;
};


