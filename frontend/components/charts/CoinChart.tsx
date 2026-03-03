'use client';

import { useEffect, useRef } from 'react';

interface CoinChartProps {
  symbol: string;
  height?: number | string;
}

export function CoinChart({ symbol, height = 500 }: CoinChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    // Create TradingView widget script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== 'undefined') {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}`,
          interval: 'D',
          timezone: 'Asia/Ho_Chi_Minh',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerRef.current?.id || 'tradingview_chart',
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
          ],
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [symbol]);

  return (
    <div
      id="tradingview_chart"
      ref={containerRef}
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%' 
      }}
      className="rounded-lg overflow-hidden"
    />
  );
}
