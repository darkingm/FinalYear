'use client';

import { useState, useEffect } from 'react';

// Global cache and listeners for all app components requesting the same pair
const cache: Record<string, { price: number; timestamp: number }> = {};
const listeners: Record<string, Set<(price: number) => void>> = {};

const PING_INTERVAL = 5000;

export function useFiatPrice(symbol: string, enabled = true) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !symbol) return;
    const pair = symbol.toUpperCase() === 'USDT' ? null : `${symbol.toUpperCase()}USDT`;
    if (!pair) {
      setPrice(1);
      return;
    }
    
    // Check initial cache
    if (cache[pair]) {
      setPrice(cache[pair].price);
    }

    if (!listeners[pair]) listeners[pair] = new Set();
    const handleUpdate = (p: number) => setPrice(p);
    listeners[pair].add(handleUpdate);

    let active = true;

    const fetchPrice = async () => {
      if (!active) return;
      try {
        // Only one fetcher per pair
        if (cache[pair] && Date.now() - cache[pair].timestamp < PING_INTERVAL - 500) {
          return; 
        }
        
        cache[pair] = { price: cache[pair]?.price || 0, timestamp: Date.now() }; // Lock
        
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
        const data = await res.json();
        if (data.price) {
          const num = parseFloat(data.price);
          cache[pair] = { price: num, timestamp: Date.now() };
          listeners[pair].forEach(cb => cb(num));
        }
      } catch (err) { }
    };

    fetchPrice();
    const iv = setInterval(fetchPrice, PING_INTERVAL);

    return () => {
      active = false;
      clearInterval(iv);
      listeners[pair]?.delete(handleUpdate);
      if (listeners[pair]?.size === 0) {
        delete listeners[pair];
      }
    };
  }, [symbol, enabled]);

  return price;
}
