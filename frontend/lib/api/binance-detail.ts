// Full Binance API integration for detailed coin data

export interface BinanceTicker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface BinanceOrderBook {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][];
}

export interface BinanceRecentTrade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}

export interface CoinDetailData {
  ticker24hr: BinanceTicker24hr;
  orderBook: BinanceOrderBook;
  recentTrades: BinanceRecentTrade[];
}

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

export async function getCoinDetail(symbol: string): Promise<CoinDetailData> {
  try {
    const [ticker24hrRes, orderBookRes, recentTradesRes] = await Promise.all([
      fetch(`${BINANCE_API_BASE}/ticker/24hr?symbol=${symbol}`),
      fetch(`${BINANCE_API_BASE}/depth?symbol=${symbol}&limit=20`),
      fetch(`${BINANCE_API_BASE}/trades?symbol=${symbol}&limit=50`),
    ]);

    const [ticker24hr, orderBook, recentTrades] = await Promise.all([
      ticker24hrRes.json(),
      orderBookRes.json(),
      recentTradesRes.json(),
    ]);

    return {
      ticker24hr,
      orderBook,
      recentTrades,
    };
  } catch (error) {
    console.error('Error fetching coin detail:', error);
    throw error;
  }
}

export async function getCoinKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 24
): Promise<any[]> {
  try {
    const response = await fetch(
      `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching klines:', error);
    throw error;
  }
}
