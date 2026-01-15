import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import { RootState, AppDispatch } from '../../store/store';
import { fetchOrderByIdAsync, cancelOrderAsync } from '../../store/thunks/orderThunks';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const OrderDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch<AppDispatch>();
  const { currentOrder, loading } = useSelector((state: RootState) => state.order);

  const orderId = (route.params as any)?.orderId;

  useEffect(() => {
    if (orderId) {
      dispatch(fetchOrderByIdAsync(orderId));
    }
  }, [orderId, dispatch]);

  const handleCancelOrder = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatch(cancelOrderAsync({ id: orderId, reason: 'User requested cancellation' })).unwrap();
            Alert.alert('Success', 'Order cancelled successfully');
          } catch (error: any) {
            Alert.alert('Error', error || 'Failed to cancel order');
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return colors.warning;
      case 'PROCESSING':
        return colors.info;
      case 'SHIPPED':
        return colors.secondary;
      case 'DELIVERED':
        return colors.success;
      case 'CANCELLED':
        return colors.error;
      default:
        return colors.light.textSecondary;
    }
  };

  if (loading && !currentOrder) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!currentOrder) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Order Header */}
      <View style={styles.header}>
        <Text style={styles.orderNumber}>{currentOrder.orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentOrder.orderStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(currentOrder.orderStatus) }]}>
            {currentOrder.orderStatus}
          </Text>
        </View>
      </View>

      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        {/* Note: Order items would come from order.items if available */}
        <Text style={styles.sectionText}>{currentOrder.totalItems} items</Text>
      </View>

      {/* Shipping Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shipping Address</Text>
        <Text style={styles.sectionText}>{currentOrder.shippingName}</Text>
        <Text style={styles.sectionText}>{currentOrder.shippingPhone}</Text>
        <Text style={styles.sectionText}>{currentOrder.shippingEmail}</Text>
        <Text style={styles.sectionText}>
          {currentOrder.shippingAddress}, {currentOrder.shippingCity}, {currentOrder.shippingCountry}{' '}
          {currentOrder.shippingPostalCode}
        </Text>
      </View>

      {/* Payment Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payment Method:</Text>
          <Text style={styles.infoValue}>{currentOrder.paymentMethod}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payment Status:</Text>
          <Text style={[styles.infoValue, { color: getStatusColor(currentOrder.paymentStatus) }]}>
            {currentOrder.paymentStatus}
          </Text>
        </View>
      </View>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal:</Text>
          <Text style={styles.summaryValue}>${currentOrder.subtotalInUSD.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping:</Text>
          <Text style={styles.summaryValue}>${currentOrder.shippingFeeInUSD.toFixed(2)}</Text>
        </View>
        {currentOrder.voucherDiscountAmount && currentOrder.voucherDiscountAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -${currentOrder.voucherDiscountAmount.toFixed(2)}
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>${currentOrder.totalInUSD.toFixed(2)}</Text>
        </View>
      </View>

      {/* Actions */}
      {currentOrder.orderStatus === 'PENDING' && (
        <View style={styles.actionsContainer}>
          <Button
            title="Cancel Order"
            onPress={handleCancelOrder}
            variant="outline"
            style={styles.cancelButton}
          />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  orderNumber: {
    ...typography.h3,
    color: colors.light.text,
    fontWeight: '700',
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
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.light.text,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  sectionText: {
    ...typography.body,
    color: colors.light.textSecondary,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: colors.light.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.light.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
  },
  discountValue: {
    color: colors.success,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  totalLabel: {
    ...typography.h3,
    color: colors.light.text,
    fontWeight: '700',
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  actionsContainer: {
    padding: spacing.lg,
  },
  cancelButton: {
    width: '100%',
  },
});

export default OrderDetailScreen;


