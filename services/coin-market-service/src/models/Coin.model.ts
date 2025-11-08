import mongoose, { Document, Schema } from 'mongoose';

export interface ICoin extends Document {
  coinId: string;
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

const CoinSchema = new Schema<ICoin>(
  {
    coinId: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    marketCap: { type: Number, required: true },
    marketCapRank: { type: Number, required: true },
    fullyDilutedValuation: { type: Number },
    totalVolume: { type: Number, required: true },
    high24h: { type: Number, required: true },
    low24h: { type: Number, required: true },
    priceChange24h: { type: Number, required: true },
    priceChangePercentage24h: { type: Number, required: true },
    marketCapChange24h: { type: Number, required: true },
    marketCapChangePercentage24h: { type: Number, required: true },
    circulatingSupply: { type: Number, required: true },
    totalSupply: { type: Number },
    maxSupply: { type: Number },
    ath: { type: Number, required: true },
    athChangePercentage: { type: Number, required: true },
    athDate: { type: Date, required: true },
    atl: { type: Number, required: true },
    atlChangePercentage: { type: Number, required: true },
    atlDate: { type: Date, required: true },
    lastUpdated: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

CoinSchema.index({ marketCapRank: 1 });
CoinSchema.index({ symbol: 1 });
CoinSchema.index({ lastUpdated: -1 });

export default mongoose.model<ICoin>('Coin', CoinSchema);

