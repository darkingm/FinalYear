'use client';

import { useFiatPrice } from '@/lib/hooks/useFiatPrice';
import { RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LivePriceEstimate({ 
  tokenAmount, 
  tokenSymbol, 
  className = "text-xs text-muted-foreground",
  showIcon = false
}: { 
  tokenAmount: number; 
  tokenSymbol: string;
  className?: string;
  showIcon?: boolean;
}) {
  const price = useFiatPrice(tokenSymbol);
  const [pulse, setPulse] = useState(false);
  const [lastPrice, setLastPrice] = useState(price);

  useEffect(() => {
    if (price && price !== lastPrice) {
      setPulse(true);
      setLastPrice(price);
      const to = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(to);
    }
  }, [price, lastPrice]);

  if (!price || !tokenAmount) return <span className={className}>≈ $... USDT</span>;
  
  const usdValue = tokenAmount * price;

  return (
    <span className={`${className} inline-flex items-center gap-1 transition-colors duration-500 ${pulse ? 'text-emerald-500 font-medium' : ''}`}>
      {showIcon && <RefreshCcw className={`w-3 h-3 ${pulse ? 'animate-spin' : ''}`} />}
      ≈ ${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
    </span>
  );
}
