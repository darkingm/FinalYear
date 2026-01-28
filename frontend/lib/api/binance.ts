import axios from 'axios';

export interface BinancePrice {
  symbol: string;
  price: string;
}

export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
}

/**
 * Get current prices for multiple symbols
 */
export async function getBinancePrices(symbols: string[]): Promise<BinancePrice[]> {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: {
        symbols: JSON.stringify(symbols),
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Binance prices:', error);
    throw error;
  }
}

/**
 * Get 24h ticker information for a symbol
 */
export async function getBinanceTicker(symbol: string): Promise<BinanceTicker> {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
      params: { symbol },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Binance ticker:', error);
    throw error;
  }
}

/**
 * Get all tickers (for supported coins)
 */
export async function getAllTickers(): Promise<BinanceTicker[]> {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
    return response.data;
  } catch (error) {
    console.error('Error fetching all tickers:', error);
    throw error;
  }
}

/**
 * Supported trading pairs
 */
export const SUPPORTED_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'USDCUSDT',
  'DAIUSDT',
  'MATICUSDT',
  'ARBUSDT',
  'LINKUSDT',
  'UNIUSDT',
  'AAVEUSDT',
];
