import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useRealtimePrices } from '../../hooks/useRealtimePrices';
import { Coin } from '../../api/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface CoinPriceTickerProps {
  coins: Coin[];
}

const CoinPriceTicker: React.FC<CoinPriceTickerProps> = ({ coins }) => {
  const coinIds = coins.map((coin) => coin.coinId);
  const realtimePrices = useRealtimePrices(coinIds);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {coins.map((coin) => {
          const priceData = realtimePrices[coin.coinId];
          const currentPrice = priceData?.priceUSD || coin.currentPrice;
          const priceChange = priceData?.priceChange24h || coin.priceChangePercentage24h;
          const isPositive = priceChange >= 0;

          return (
            <View key={coin.coinId} style={styles.coinItem}>
              <FastImage
                source={{ uri: coin.image }}
                style={styles.coinImage}
                resizeMode={FastImage.resizeMode.contain}
              />
              <View style={styles.coinInfo}>
                <Text style={styles.coinSymbol}>{coin.symbol.toUpperCase()}</Text>
                <Text style={styles.coinPrice}>${currentPrice.toFixed(2)}</Text>
                <Text style={[styles.coinChange, isPositive ? styles.positive : styles.negative]}>
                  {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.light.surface,
    paddingVertical: spacing.md,
  },
  coinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginRight: spacing.md,
    backgroundColor: colors.light.background,
    borderRadius: 12,
    paddingVertical: spacing.md,
  },
  coinImage: {
    width: 32,
    height: 32,
    marginRight: spacing.md,
  },
  coinInfo: {
    alignItems: 'flex-start',
  },
  coinSymbol: {
    ...typography.caption,
    color: colors.light.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  coinPrice: {
    ...typography.bodySmall,
    color: colors.light.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  coinChange: {
    ...typography.caption,
    fontWeight: '600',
  },
  positive: {
    color: colors.success,
  },
  negative: {
    color: colors.error,
  },
});

export default CoinPriceTicker;


