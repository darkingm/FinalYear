import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  title: string;
  
  // Market overview
  marketOverview: {
    totalMarketCap: number;
    totalVolume: number;
    btcDominance: number;
    averageChange24h: number;
    topGainers: Array<{ coinId: string; name: string; change: number }>;
    topLosers: Array<{ coinId: string; name: string; change: number }>;
  };
  
  // Trend analysis
  trendAnalysis: {
    overallTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    sentiment: string;
    volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    keyEvents: string[];
  };
  
  // Predictions
  predictions: {
    nextDayOutlook: string;
    nextWeekOutlook: string;
    riskAssessment: string;
  };
  
  // Featured analysis
  featuredCoins: Array<{
    coinId: string;
    name: string;
    analysis: string;
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  }>;
  
  // Full report content
  content: string;
  summary: string;
  
  // Metadata
  reportDate: Date;
  generatedBy: 'AI' | 'MANUAL';
  isPublished: boolean;
  viewCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reportType: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    
    marketOverview: {
      totalMarketCap: { type: Number, required: true },
      totalVolume: { type: Number, required: true },
      btcDominance: { type: Number, required: true },
      averageChange24h: { type: Number, required: true },
      topGainers: [
        {
          coinId: String,
          name: String,
          change: Number,
        },
      ],
      topLosers: [
        {
          coinId: String,
          name: String,
          change: Number,
        },
      ],
    },
    
    trendAnalysis: {
      overallTrend: {
        type: String,
        enum: ['BULLISH', 'BEARISH', 'NEUTRAL'],
        required: true,
      },
      sentiment: String,
      volatilityLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        required: true,
      },
      keyEvents: [String],
    },
    
    predictions: {
      nextDayOutlook: String,
      nextWeekOutlook: String,
      riskAssessment: String,
    },
    
    featuredCoins: [
      {
        coinId: String,
        name: String,
        analysis: String,
        recommendation: {
          type: String,
          enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
        },
      },
    ],
    
    content: { type: String, required: true },
    summary: { type: String, required: true },
    
    reportDate: { type: Date, required: true, index: true },
    generatedBy: {
      type: String,
      enum: ['AI', 'MANUAL'],
      default: 'AI',
    },
    isPublished: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReportSchema.index({ reportType: 1, reportDate: -1 });
ReportSchema.index({ isPublished: 1 });

export default mongoose.model<IReport>('Report', ReportSchema);

