import axios from 'axios';
import MarketAnalysis from '../models/MarketAnalysis.model';
import logger from '../utils/logger';

// Simulated AI analysis (in production, integrate real AI/ML models)
export const updateMarketAnalysis = async () => {
  try {
    // Fetch top coins data from CoinGecko
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 10,
          page: 1,
          sparkline: false,
          price_change_percentage: '24h,7d',
        },
      }
    );

    const coins = response.data;

    for (const coin of coins) {
      const analysis = await generateAnalysis(coin);
      
      await MarketAnalysis.findOneAndUpdate(
        { coinId: coin.id },
        analysis,
        { upsert: true, new: true }
      );
    }

    logger.info('Market analysis updated successfully');
  } catch (error) {
    logger.error('Update market analysis error:', error);
  }
};

const generateAnalysis = async (coin: any) => {
  // Technical indicators (simplified calculations)
  const rsi = calculateRSI(coin.price_change_percentage_24h || 0);
  const macd = calculateMACD(coin.current_price);
  const volatility = Math.abs(coin.price_change_percentage_24h || 0) / 10;
  
  // Moving averages (simulated - in production, use historical data)
  const movingAverage7d = coin.current_price * (1 - (coin.price_change_percentage_7d_in_currency || 0) / 700);
  const movingAverage30d = coin.current_price * 0.95; // Simplified
  
  // Sentiment analysis (based on price changes)
  const sentimentScore = calculateSentiment(
    coin.price_change_percentage_24h || 0,
    coin.price_change_percentage_7d_in_currency || 0
  );
  const sentiment = getSentimentLabel(sentimentScore);
  
  // AI predictions (simplified - in production, use ML models)
  const predictedPrice24h = coin.current_price * (1 + (coin.price_change_percentage_24h || 0) / 200);
  const predictedPrice7d = coin.current_price * (1 + (coin.price_change_percentage_7d_in_currency || 0) / 100);
  const predictedTrend = predictTrend(coin.price_change_percentage_24h || 0);
  const confidence = Math.min(0.85, Math.random() * 0.3 + 0.6); // 0.6-0.9
  
  // Risk assessment
  const riskLevel = assessRisk(volatility, sentimentScore);
  
  // Generate summary and insights
  const summary = generateSummary(coin, sentiment, predictedTrend);
  const keyInsights = generateKeyInsights(coin, rsi, sentiment);
  
  return {
    coinId: coin.id,
    coinName: coin.name,
    coinSymbol: coin.symbol.toUpperCase(),
    
    currentPrice: coin.current_price,
    priceChange24h: coin.price_change_24h || 0,
    priceChangePercentage24h: coin.price_change_percentage_24h || 0,
    priceChange7d: coin.price_change_7d || 0,
    priceChangePercentage7d: coin.price_change_percentage_7d_in_currency || 0,
    
    marketCap: coin.market_cap,
    marketCapRank: coin.market_cap_rank,
    totalVolume: coin.total_volume,
    circulatingSupply: coin.circulating_supply,
    totalSupply: coin.total_supply,
    
    rsi,
    macd,
    movingAverage7d,
    movingAverage30d,
    volatility,
    
    sentiment,
    sentimentScore,
    
    predictedPrice24h,
    predictedPrice7d,
    predictedTrend,
    confidence,
    
    summary,
    keyInsights,
    riskLevel,
    
    lastUpdated: new Date(),
  };
};

// Technical indicator calculations (simplified)
const calculateRSI = (priceChange: number): number => {
  // Simplified RSI based on price change
  const rsi = 50 + priceChange; // -50 to 150, clamped to 0-100
  return Math.max(0, Math.min(100, rsi));
};

const calculateMACD = (currentPrice: number) => {
  // Simplified MACD
  const value = currentPrice * 0.001;
  const signal = value * 0.9;
  const histogram = value - signal;
  return { value, signal, histogram };
};

const calculateSentiment = (change24h: number, change7d: number): number => {
  // Sentiment score from -100 (very bearish) to 100 (very bullish)
  const score = (change24h * 2 + change7d) / 3;
  return Math.max(-100, Math.min(100, score));
};

const getSentimentLabel = (score: number): string => {
  if (score > 10) return 'VERY_BULLISH';
  if (score > 3) return 'BULLISH';
  if (score < -10) return 'VERY_BEARISH';
  if (score < -3) return 'BEARISH';
  return 'NEUTRAL';
};

const predictTrend = (change24h: number): 'UP' | 'DOWN' | 'SIDEWAYS' => {
  if (change24h > 2) return 'UP';
  if (change24h < -2) return 'DOWN';
  return 'SIDEWAYS';
};

const assessRisk = (volatility: number, sentimentScore: number): string => {
  const riskScore = volatility + Math.abs(sentimentScore) / 10;
  if (riskScore > 15) return 'VERY_HIGH';
  if (riskScore > 10) return 'HIGH';
  if (riskScore > 5) return 'MEDIUM';
  return 'LOW';
};

const generateSummary = (coin: any, sentiment: string, trend: string): string => {
  const change24h = coin.price_change_percentage_24h?.toFixed(2) || 0;
  const price = coin.current_price.toFixed(2);
  
  return `${coin.name} (${coin.symbol.toUpperCase()}) is trading at $${price} with a ${change24h}% change in the last 24 hours. ` +
    `Market sentiment is ${sentiment.toLowerCase()} with a ${trend.toLowerCase()} trend expected. ` +
    `Current market cap rank: #${coin.market_cap_rank}.`;
};

const generateKeyInsights = (coin: any, rsi: number, sentiment: string): string[] => {
  const insights: string[] = [];
  
  if (rsi > 70) {
    insights.push('⚠️ RSI indicates overbought conditions - potential correction ahead');
  } else if (rsi < 30) {
    insights.push('💡 RSI shows oversold conditions - possible buying opportunity');
  }
  
  if (coin.price_change_percentage_24h > 5) {
    insights.push('📈 Strong upward momentum in the last 24 hours');
  } else if (coin.price_change_percentage_24h < -5) {
    insights.push('📉 Significant price decline in recent trading');
  }
  
  if (coin.total_volume > coin.market_cap * 0.1) {
    insights.push('🔥 High trading volume indicates strong market interest');
  }
  
  if (sentiment === 'VERY_BULLISH' || sentiment === 'BULLISH') {
    insights.push('✨ Positive market sentiment may support further gains');
  } else if (sentiment === 'VERY_BEARISH' || sentiment === 'BEARISH') {
    insights.push('⚡ Negative sentiment suggests caution for new positions');
  }
  
  return insights;
};

export { generateAnalysis };

