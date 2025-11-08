import mongoose, { Document, Schema } from 'mongoose';

export interface IMarketAnalysis extends Document {
  coinId: string;
  coinName: string;
  coinSymbol: string;
  
  // Price data
  currentPrice: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  priceChange7d: number;
  priceChangePercentage7d: number;
  
  // Market data
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
  circulatingSupply: number;
  totalSupply?: number;
  
  // Technical indicators
  rsi: number; // Relative Strength Index (0-100)
  macd: { value: number; signal: number; histogram: number };
  movingAverage7d: number;
  movingAverage30d: number;
  volatility: number; // Standard deviation
  
  // Sentiment analysis
  sentiment: 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH';
  sentimentScore: number; // -100 to 100
  
  // AI predictions
  predictedPrice24h: number;
  predictedPrice7d: number;
  predictedTrend: 'UP' | 'DOWN' | 'SIDEWAYS';
  confidence: number; // 0-1
  
  // Analysis summary
  summary: string;
  keyInsights: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  
  // Metadata
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MarketAnalysisSchema = new Schema<IMarketAnalysis>(
  {
    coinId: { type: String, required: true, index: true },
    coinName: { type: String, required: true },
    coinSymbol: { type: String, required: true },
    
    currentPrice: { type: Number, required: true },
    priceChange24h: { type: Number, required: true },
    priceChangePercentage24h: { type: Number, required: true },
    priceChange7d: { type: Number, required: true },
    priceChangePercentage7d: { type: Number, required: true },
    
    marketCap: { type: Number, required: true },
    marketCapRank: { type: Number, required: true },
    totalVolume: { type: Number, required: true },
    circulatingSupply: { type: Number, required: true },
    totalSupply: { type: Number },
    
    rsi: { type: Number, required: true },
    macd: {
      value: { type: Number, required: true },
      signal: { type: Number, required: true },
      histogram: { type: Number, required: true },
    },
    movingAverage7d: { type: Number, required: true },
    movingAverage30d: { type: Number, required: true },
    volatility: { type: Number, required: true },
    
    sentiment: {
      type: String,
      enum: ['VERY_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'VERY_BEARISH'],
      required: true,
    },
    sentimentScore: { type: Number, required: true },
    
    predictedPrice24h: { type: Number, required: true },
    predictedPrice7d: { type: Number, required: true },
    predictedTrend: {
      type: String,
      enum: ['UP', 'DOWN', 'SIDEWAYS'],
      required: true,
    },
    confidence: { type: Number, required: true },
    
    summary: { type: String, required: true },
    keyInsights: [{ type: String }],
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'],
      required: true,
    },
    
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes
MarketAnalysisSchema.index({ coinId: 1, lastUpdated: -1 });
MarketAnalysisSchema.index({ sentiment: 1 });
MarketAnalysisSchema.index({ marketCapRank: 1 });

export default mongoose.model<IMarketAnalysis>('MarketAnalysis', MarketAnalysisSchema);

