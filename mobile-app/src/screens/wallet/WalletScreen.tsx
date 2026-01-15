import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store/store';
import { fetchBalancesAsync } from '../../store/thunks/walletThunks';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const WalletScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { balances, loading } = useSelector((state: RootState) => state.wallet);
  const { user } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchBalancesAsync(user.id));
    }
  }, [user?.id, dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await dispatch(fetchBalancesAsync(user.id));
    }
    setRefreshing(false);
  };

  const totalUSD = balances.reduce((sum, balance) => sum + balance.usdValue, 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Total Balance */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Balance</Text>
        <Text style={styles.totalValue}>${totalUSD.toFixed(2)}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Deposit' as never)}
        >
          <Text style={styles.actionButtonText}>Deposit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.withdrawButton]}
          onPress={() => navigation.navigate('Withdraw' as never)}
        >
          <Text style={[styles.actionButtonText, styles.withdrawButtonText]}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Balances List */}
      <View style={styles.balancesContainer}>
        <Text style={styles.sectionTitle}>Coin Balances</Text>
        {loading && balances.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          balances.map((balance) => (
            <View key={balance.coinId} style={styles.balanceCard}>
              <View style={styles.balanceInfo}>
                <Text style={styles.coinSymbol}>{balance.symbol}</Text>
                <Text style={styles.coinName}>{balance.name}</Text>
              </View>
              <View style={styles.balanceAmounts}>
                <Text style={styles.balanceValue}>{balance.balance.toFixed(6)}</Text>
                <Text style={styles.balanceUSD}>${balance.usdValue.toFixed(2)}</Text>
              </View>
            </View>
          ))
        )}
        {balances.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No balances found</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  totalContainer: {
    backgroundColor: colors.primary,
    padding: spacing.xl,
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.body,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: spacing.sm,
  },
  totalValue: {
    ...typography.h1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  withdrawButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  withdrawButtonText: {
    color: colors.primary,
  },
  balancesContainer: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.light.text,
    marginBottom: spacing.lg,
    fontWeight: '700',
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  balanceInfo: {
    flex: 1,
  },
  coinSymbol: {
    ...typography.h3,
    color: colors.light.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  coinName: {
    ...typography.bodySmall,
    color: colors.light.textSecondary,
  },
  balanceAmounts: {
    alignItems: 'flex-end',
  },
  balanceValue: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  balanceUSD: {
    ...typography.bodySmall,
    color: colors.light.textSecondary,
  },
  loadingContainer: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.light.textSecondary,
  },
});

export default WalletScreen;


