import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import FastImage from 'react-native-fast-image';
import { RootState, AppDispatch } from '../../store/store';
import { fetchCartAsync, updateCartItemAsync, removeFromCartAsync } from '../../store/thunks/cartThunks';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const CartScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, totalPrice, totalItems } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCartAsync());
    }
  }, [isAuthenticated, dispatch]);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    await dispatch(updateCartItemAsync({ id: itemId, quantity: newQuantity }));
  };

  const handleRemoveItem = async (itemId: string) => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => dispatch(removeFromCartAsync(itemId)),
      },
    ]);
  };

  const renderRightActions = (itemId: string) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => handleRemoveItem(itemId)}
    >
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to cart');
      return;
    }
    navigation.navigate('Checkout' as never);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Please login to view your cart</Text>
        <Button
          title="Sign In"
          onPress={() => navigation.navigate('Auth' as never)}
          style={styles.loginButton}
        />
      </View>
    );
  }

  if (loading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <Button
              title="Continue Shopping"
              onPress={() => navigation.navigate('Home' as never)}
              variant="outline"
            />
          </View>
        ) : (
          <>
            {items.map((item) => (
              <Swipeable
                key={item.id}
                renderRightActions={() => renderRightActions(item.id)}
              >
                <View style={styles.cartItem}>
                  <FastImage
                    source={{ uri: item.productImage }}
                    style={styles.itemImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.productTitle}
                    </Text>
                    <Text style={styles.itemPrice}>${item.priceInUSD.toFixed(2)}</Text>
                    <Text style={styles.itemPriceCoin}>
                      {item.priceInCoins.toFixed(6)} {item.coinSymbol || 'COIN'}
                    </Text>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
                      >
                        <Text style={styles.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.itemTotal}>
                    <Text style={styles.itemTotalText}>
                      ${(item.priceInUSD * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </Swipeable>
            ))}

            {/* Voucher Input */}
            <View style={styles.voucherContainer}>
              <Text style={styles.voucherLabel}>Voucher Code</Text>
              <View style={styles.voucherInputContainer}>
                <TextInput
                  style={styles.voucherInput}
                  placeholder="Enter voucher code"
                  placeholderTextColor={colors.light.textSecondary}
                  value={voucherCode}
                  onChangeText={setVoucherCode}
                />
                <TouchableOpacity style={styles.voucherButton}>
                  <Text style={styles.voucherButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
              {voucherDiscount > 0 && (
                <Text style={styles.voucherDiscount}>
                  Discount: -${voucherDiscount.toFixed(2)}
                </Text>
              )}
            </View>

            {/* Summary */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={styles.summaryValue}>$0.00</Text>
              </View>
              {voucherDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountValue]}>
                    -${voucherDiscount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  ${(totalPrice - voucherDiscount).toFixed(2)}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {items.length > 0 && (
        <View style={styles.checkoutContainer}>
          <Button
            title={`Checkout (${totalItems} items)`}
            onPress={handleCheckout}
            style={styles.checkoutButton}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
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
    marginBottom: spacing.xl,
  },
  loginButton: {
    minWidth: 200,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemPrice: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemPriceCoin: {
    ...typography.caption,
    color: colors.light.textSecondary,
    marginBottom: spacing.sm,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  quantityButtonText: {
    ...typography.body,
    color: colors.light.text,
  },
  quantityValue: {
    ...typography.body,
    color: colors.light.text,
    marginHorizontal: spacing.md,
    minWidth: 30,
    textAlign: 'center',
  },
  itemTotal: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  itemTotalText: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginLeft: spacing.md,
  },
  deleteActionText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  voucherContainer: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  voucherLabel: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  voucherInputContainer: {
    flexDirection: 'row',
  },
  voucherInput: {
    flex: 1,
    ...typography.body,
    backgroundColor: colors.light.background,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    color: colors.light.text,
    marginRight: spacing.md,
  },
  voucherButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
  },
  voucherButtonText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  voucherDiscount: {
    ...typography.bodySmall,
    color: colors.success,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  summaryContainer: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.xl,
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
  checkoutContainer: {
    padding: spacing.lg,
    backgroundColor: colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  checkoutButton: {
    width: '100%',
  },
});

export default CartScreen;

