export enum AnalysisType {
  MARKET_OVERVIEW = 'MARKET_OVERVIEW',
  COIN_ANALYSIS = 'COIN_ANALYSIS',
  PRICE_PREDICTION = 'PRICE_PREDICTION',
  PORTFOLIO_ANALYSIS = 'PORTFOLIO_ANALYSIS',
  TRADING_SIGNAL = 'TRADING_SIGNAL',
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface IAIAnalysis {
  id: string;
  type: AnalysisType;
  userId?: string;
  coinId?: string;
  coinSymbol?: string;
  input: Record<string, any>;
  result: IAIAnalysisResult;
  status: AnalysisStatus;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface IAIAnalysisResult {
  summary: string;
  details: string;
  metrics?: Record<string, any>;
  recommendations?: string[];
  sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidenceScore?: number;
  charts?: Array<{
    type: string;
    data: any[];
    labels?: string[];
  }>;
}

export interface IMarketReport {
  id: string;
  title: string;
  summary: string;
  content: string;
  topMovers: Array<{
    coinId: string;
    symbol: string;
    name: string;
    priceChange: number;
    reason: string;
  }>;
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  totalMarketCap: number;
  totalVolume: number;
  btcDominance: number;
  recommendations: string[];
  generatedAt: Date;
  scheduledFor: Date;
}

export interface IAISearchRequest {
  query: string;
  context?: string;
  includeMarketData?: boolean;
}

export interface IAISearchResponse {
  answer: string;
  sources: Array<{
    type: 'COIN' | 'ARTICLE' | 'PRODUCT' | 'USER';
    id: string;
    title: string;
    url?: string;
    relevance: number;
  }>;
  relatedQuestions?: string[];
  confidence: number;
}

export interface ICoinAnalysisRequest {
  coinId: string;
  timeframe?: '24h' | '7d' | '30d' | '90d' | '1y';
  includeOnChainData?: boolean;
  includeSocialSentiment?: boolean;
}

export interface IAutomatedReportSchedule {
  id: string;
  userId: string;
  type: AnalysisType;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  time: string;
  enabled: boolean;
  lastSentAt?: Date;
  nextScheduledAt: Date;
}

