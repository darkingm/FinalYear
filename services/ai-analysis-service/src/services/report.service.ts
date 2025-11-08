import axios from 'axios';
import Report from '../models/Report.model';
import MarketAnalysis from '../models/MarketAnalysis.model';
import logger from '../utils/logger';

export const generateDailyReport = async () => {
  try {
    // Fetch market data
    const globalResponse = await axios.get('https://api.coingecko.com/api/v3/global');
    const globalData = globalResponse.data.data;
    
    // Get all recent analyses
    const analyses = await MarketAnalysis.find()
      .sort({ marketCapRank: 1 })
      .limit(10);
    
    if (analyses.length === 0) {
      logger.warn('No market analysis data available for report');
      return;
    }
    
    // Calculate top gainers and losers
    const sortedByChange = [...analyses].sort((a, b) => 
      b.priceChangePercentage24h - a.priceChangePercentage24h
    );
    
    const topGainers = sortedByChange.slice(0, 3).map(a => ({
      coinId: a.coinId,
      name: a.coinName,
      change: a.priceChangePercentage24h,
    }));
    
    const topLosers = sortedByChange.slice(-3).reverse().map(a => ({
      coinId: a.coinId,
      name: a.coinName,
      change: a.priceChangePercentage24h,
    }));
    
    // Calculate average change
    const averageChange24h = analyses.reduce((sum, a) => 
      sum + a.priceChangePercentage24h, 0
    ) / analyses.length;
    
    // Determine overall trend
    const bullishCount = analyses.filter(a => 
      a.sentiment === 'BULLISH' || a.sentiment === 'VERY_BULLISH'
    ).length;
    const bearishCount = analyses.filter(a => 
      a.sentiment === 'BEARISH' || a.sentiment === 'VERY_BEARISH'
    ).length;
    
    const overallTrend = bullishCount > bearishCount ? 'BULLISH' : 
                        bearishCount > bullishCount ? 'BEARISH' : 'NEUTRAL';
    
    // Calculate volatility
    const avgVolatility = analyses.reduce((sum, a) => sum + a.volatility, 0) / analyses.length;
    const volatilityLevel = avgVolatility > 10 ? 'HIGH' : avgVolatility > 5 ? 'MEDIUM' : 'LOW';
    
    // Featured coins analysis
    const featuredCoins = analyses.slice(0, 5).map(a => ({
      coinId: a.coinId,
      name: a.coinName,
      analysis: a.summary,
      recommendation: getRecommendation(a.sentiment, a.rsi, a.predictedTrend),
    }));
    
    // Generate report content
    const title = `Daily Crypto Market Report - ${new Date().toLocaleDateString()}`;
    const content = generateReportContent(
      globalData,
      analyses,
      topGainers,
      topLosers,
      overallTrend
    );
    const summary = generateReportSummary(overallTrend, averageChange24h, volatilityLevel);
    
    // Create report
    const report = await Report.create({
      reportType: 'DAILY',
      title,
      
      marketOverview: {
        totalMarketCap: globalData.total_market_cap.usd,
        totalVolume: globalData.total_volume.usd,
        btcDominance: globalData.market_cap_percentage.btc,
        averageChange24h,
        topGainers,
        topLosers,
      },
      
      trendAnalysis: {
        overallTrend,
        sentiment: getSentimentText(overallTrend),
        volatilityLevel,
        keyEvents: generateKeyEvents(analyses),
      },
      
      predictions: {
        nextDayOutlook: generateNextDayOutlook(overallTrend, avgVolatility),
        nextWeekOutlook: generateNextWeekOutlook(analyses),
        riskAssessment: generateRiskAssessment(volatilityLevel),
      },
      
      featuredCoins,
      content,
      summary,
      
      reportDate: new Date(),
      generatedBy: 'AI',
      isPublished: true,
      viewCount: 0,
    });
    
    logger.info('Daily report generated:', report.id);
    return report;
  } catch (error) {
    logger.error('Generate daily report error:', error);
  }
};

const getRecommendation = (sentiment: string, rsi: number, trend: string): string => {
  if (sentiment === 'VERY_BULLISH' && rsi < 70 && trend === 'UP') return 'STRONG_BUY';
  if (sentiment === 'BULLISH' && rsi < 60) return 'BUY';
  if (sentiment === 'VERY_BEARISH' && rsi > 30 && trend === 'DOWN') return 'STRONG_SELL';
  if (sentiment === 'BEARISH' && rsi > 40) return 'SELL';
  return 'HOLD';
};

const getSentimentText = (trend: string): string => {
  if (trend === 'BULLISH') return 'Market sentiment is positive with strong buying pressure';
  if (trend === 'BEARISH') return 'Market sentiment is negative with selling pressure';
  return 'Market sentiment is neutral with mixed signals';
};

const generateKeyEvents = (analyses: any[]): string[] => {
  const events: string[] = [];
  
  analyses.forEach(a => {
    if (a.priceChangePercentage24h > 10) {
      events.push(`${a.coinName} surged ${a.priceChangePercentage24h.toFixed(2)}%`);
    } else if (a.priceChangePercentage24h < -10) {
      events.push(`${a.coinName} dropped ${Math.abs(a.priceChangePercentage24h).toFixed(2)}%`);
    }
  });
  
  return events.slice(0, 5);
};

const generateNextDayOutlook = (trend: string, volatility: number): string => {
  if (trend === 'BULLISH') {
    return 'Expect continued upward momentum, though profit-taking may cause short-term pullbacks.';
  } else if (trend === 'BEARISH') {
    return 'Downward pressure likely to continue. Watch for support levels and potential reversals.';
  }
  return `Sideways movement expected. Volatility is ${volatility > 7 ? 'high' : 'moderate'}.`;
};

const generateNextWeekOutlook = (analyses: any[]): string => {
  const avgPredicted7d = analyses.reduce((sum, a) => 
    sum + ((a.predictedPrice7d - a.currentPrice) / a.currentPrice) * 100, 0
  ) / analyses.length;
  
  if (avgPredicted7d > 5) {
    return 'Strong growth expected over the next week based on current momentum.';
  } else if (avgPredicted7d < -5) {
    return 'Market may face challenges. Consider risk management strategies.';
  }
  return 'Moderate price action expected with opportunities in both directions.';
};

const generateRiskAssessment = (volatility: string): string => {
  if (volatility === 'HIGH') {
    return 'HIGH RISK: Extreme volatility detected. Use tight stop-losses and reduce position sizes.';
  } else if (volatility === 'MEDIUM') {
    return 'MODERATE RISK: Normal market volatility. Standard risk management applies.';
  }
  return 'LOW RISK: Stable market conditions. Good environment for strategic positioning.';
};

const generateReportContent = (
  globalData: any,
  analyses: any[],
  topGainers: any[],
  topLosers: any[],
  trend: string
): string => {
  return `
# Crypto Market Daily Report

## Market Overview
- Total Market Cap: $${(globalData.total_market_cap.usd / 1e9).toFixed(2)}B
- 24h Volume: $${(globalData.total_volume.usd / 1e9).toFixed(2)}B
- Bitcoin Dominance: ${globalData.market_cap_percentage.btc.toFixed(2)}%
- Overall Trend: ${trend}

## Top Performers
${topGainers.map(g => `- ${g.name}: +${g.change.toFixed(2)}%`).join('\n')}

## Biggest Decliners
${topLosers.map(l => `- ${l.name}: ${l.change.toFixed(2)}%`).join('\n')}

## Market Analysis
${analyses.slice(0, 5).map(a => `
### ${a.coinName} (${a.coinSymbol})
- Price: $${a.currentPrice.toFixed(2)}
- 24h Change: ${a.priceChangePercentage24h.toFixed(2)}%
- Sentiment: ${a.sentiment}
- Prediction: ${a.predictedTrend}
`).join('\n')}

## Conclusion
${getSentimentText(trend)}. Monitor key support and resistance levels.
  `.trim();
};

const generateReportSummary = (trend: string, avgChange: number, volatility: string): string => {
  return `Market is ${trend.toLowerCase()} with an average 24h change of ${avgChange.toFixed(2)}%. ` +
    `Volatility is ${volatility.toLowerCase()}. ${
      trend === 'BULLISH' ? 'Positive momentum continues.' :
      trend === 'BEARISH' ? 'Caution advised.' :
      'Mixed signals across the market.'
    }`;
};

