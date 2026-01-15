import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store/store';
import { fetchP2PTradesAsync } from '../../store/thunks/p2pThunks';
import { fetchTop10Coins } from '../../store/thunks/coinThunks';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const P2PTradingScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { trades, loading } = useSelector((state: RootState) => state.p2p);
  const { coins } = useSelector((state: RootState) => state.wallet);

  const [activeTab, setActiveTab] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedCoin, setSelectedCoin] = useState('USDT');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchTop10Coins());
  }, [dispatch]);

  useEffect(() => {
    loadTrades();
  }, [activeTab, selectedCoin]);

  const loadTrades = async () => {
    await dispatch(fetchP2PTradesAsync({ tradeType: activeTab, coinType: selectedCoin }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrades();
    setRefreshing(false);
  };

  const handleTradePress = (tradeId: string) => {
    navigation.navigate('P2PTradeDetail' as never, { tradeId } as never);
  };

  const handleCreateListing = () => {
    navigation.navigate('CreateP2PListing' as never);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return colors.warning;
      case 'AWAITING_PAYMENT':
        return colors.info;
      case 'PAYMENT_SUBMITTED':
        return colors.secondary;
      case 'VERIFYING':
        return colors.info;
      case 'COMPLETED':
        return colors.success;
      case 'CANCELLED':
        return colors.error;
      default:
        return colors.light.textSecondary;
    }
  };

  const renderTrade = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.tradeCard}
      onPress={() => handleTradePress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.tradeHeader}>
        <View style={styles.tradeInfo}>
          <Text style={styles.tradeAmount}>
            {item.coinAmount} {item.coinType}
          </Text>
          <Text style={styles.tradePrice}>
            {item.fiatCurrency} {item.fiatAmount.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <View style={styles.tradeFooter}>
        <Text style={styles.tradeRate}>
          Rate: {item.exchangeRate.toLocaleString()} {item.fiatCurrency}/{item.coinType}
        </Text>
        <Text style={styles.tradeBank}>{item.bankName}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'BUY' && styles.tabActive]}
          onPress={() => setActiveTab('BUY')}
        >
          <Text style={[styles.tabText, activeTab === 'BUY' && styles.tabTextActive]}>
            Buy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'SELL' && styles.tabActive]}
          onPress={() => setActiveTab('SELL')}
        >
          <Text style={[styles.tabText, activeTab === 'SELL' && styles.tabTextActive]}>
            Sell
          </Text>
        </TouchableOpacity>
      </View>

      {/* Coin Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={coins.slice(0, 5)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.coinFilter,
                selectedCoin === item.symbol && styles.coinFilterActive,
              ]}
              onPress={() => setSelectedCoin(item.symbol)}
            >
              <Text
                style={[
                  styles.coinFilterText,
                  selectedCoin === item.symbol && styles.coinFilterTextActive,
                ]}
              >
                {item.symbol}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.coinId}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Create Listing Button */}
      {activeTab === 'SELL' && (
        <View style={styles.createButtonContainer}>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateListing}>
            <Text style={styles.createButtonText}>+ Create Listing</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trades List */}
      {loading && trades.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trades}
          renderItem={renderTrade}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab.toLowerCase()} listings available</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.light.surface,
    padding: spacing.sm,
    margin: spacing.lg,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.light.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  filterContainer: {
    backgroundColor: colors.light.surface,
    paddingVertical: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.lg,
  },
  coinFilter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.light.background,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  coinFilterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  coinFilterText: {
    ...typography.caption,
    color: colors.light.text,
    fontWeight: '600',
  },
  coinFilterTextActive: {
    color: '#FFFFFF',
  },
  createButtonContainer: {
    padding: spacing.lg,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  createButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.lg,
  },
  tradeCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tradeInfo: {
    flex: 1,
  },
  tradeAmount: {
    ...typography.h3,
    color: colors.light.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  tradePrice: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  tradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeRate: {
    ...typography.bodySmall,
    color: colors.light.textSecondary,
  },
  tradeBank: {
    ...typography.bodySmall,
    color: colors.light.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.light.textSecondary,
  },
});

export default P2PTradingScreen;


