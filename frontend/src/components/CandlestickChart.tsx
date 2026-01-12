import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';

interface CandlestickChartProps {
  data: any[];
}

const CandlestickChart = ({ data }: CandlestickChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Get theme
    const isDark = document.documentElement.classList.contains('dark');

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: isDark ? '#1F2937' : '#FFFFFF' },
        textColor: isDark ? '#9CA3AF' : '#374151',
      },
      grid: {
        vertLines: { color: isDark ? '#374151' : '#E5E7EB' },
        horzLines: { color: isDark ? '#374151' : '#E5E7EB' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: isDark ? '#374151' : '#E5E7EB',
      },
      rightPriceScale: {
        borderColor: isDark ? '#374151' : '#E5E7EB',
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: isDark ? '#9CA3AF' : '#6B7280',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: isDark ? '#9CA3AF' : '#6B7280',
          style: 3,
        },
      },
    });

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      try {
        // Transform data to candlestick format
        const candlestickData = data.map((item) => {
          // Ensure time is a Unix timestamp (number)
          let timeValue = item.time;
          if (typeof timeValue === 'string') {
            timeValue = Math.floor(new Date(timeValue).getTime() / 1000);
          } else if (timeValue instanceof Date) {
            timeValue = Math.floor(timeValue.getTime() / 1000);
          }
          // Ensure it's a number
          timeValue = Number(timeValue);
          
          // Ensure all values are valid numbers
          const open = parseFloat(item.open?.toString() || item.close?.toString() || '0');
          const close = parseFloat(item.close?.toString() || item.open?.toString() || '0');
          const high = parseFloat(item.high?.toString() || Math.max(open, close).toString());
          const low = parseFloat(item.low?.toString() || Math.min(open, close).toString());
          
          return {
            time: timeValue as any, // lightweight-charts expects timestamp
            open: isNaN(open) ? 0 : open,
            high: isNaN(high) ? Math.max(open, close) : high,
            low: isNaN(low) ? Math.min(open, close) : low,
            close: isNaN(close) ? 0 : close,
          };
        }).filter(item => 
          item.time && 
          !isNaN(item.time) && 
          !isNaN(item.open) && 
          !isNaN(item.high) && 
          !isNaN(item.low) && 
          !isNaN(item.close) &&
          item.open > 0 &&
          item.close > 0
        );

        if (candlestickData.length > 0) {
          seriesRef.current.setData(candlestickData);

          // Fit content
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } else if (seriesRef.current) {
          // Clear chart if no valid data
          seriesRef.current.setData([]);
        }
      } catch (error) {
        console.error('Error setting chart data:', error);
        // Clear chart on error
        if (seriesRef.current) {
          seriesRef.current.setData([]);
        }
      }
    } else if (seriesRef.current) {
      // Clear chart if no data
      seriesRef.current.setData([]);
    }
  }, [data]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full h-full rounded-lg"
      style={{ position: 'relative', minHeight: '500px' }}
    />
  );
};

export default CandlestickChart;

