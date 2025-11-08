export interface ICoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number;
  fullyDilutedValuation?: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCapChange24h: number;
  marketCapChangePercentage24h: number;
  circulatingSupply: number;
  totalSupply?: number;
  maxSupply?: number;
  ath: number;
  athChangePercentage: number;
  athDate: Date;
  atl: number;
  atlChangePercentage: number;
  atlDate: Date;
  lastUpdated: Date;
}

export interface ICoinPriceHistory {
  coinId: string;
  timestamp: Date;
  price: number;
  volume: number;
  marketCap: number;
}

export interface ITop10Coins {
  coins: ICoinMarketData[];
  lastUpdated: Date;
  source: string;
}

export interface ICoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCapRank: number;
}

