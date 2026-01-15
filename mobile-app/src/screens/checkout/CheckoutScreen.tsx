import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store/store';
import { fetchCartAsync } from '../../store/thunks/cartThunks';
import { createOrderAsync } from '../../store/thunks/orderThunks';
import { validateVoucherAsync } from '../../store/thunks/voucherThunks';
import { useRealtimePrices } from '../../hooks/useRealtimePrices';
import { fetchTop10Coins } from '../../store/thunks/coinThunks';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type CheckoutStep = 'address' | 'payment' | 'review';

const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { items, totalPrice } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const { coins } = useSelector((state: RootState) => state.wallet);

  const [step, setStep] = useState<CheckoutStep>('address');
  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    fullName: user?.fullName || '',
    phone: '',
    email: user?.email || '',
    address: '',
    city: '',
    country: 'Vietnam',
    postalCode: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'COIN' | 'VNPAY' | 'P2P'>('COIN');
  const [selectedCoin, setSelectedCoin] = useState('USDT');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);

  useEffect(() => {
    dispatch(fetchTop10Coins());
  }, [dispatch]);

  const selectedCoinData = coins.find((c) => c.symbol === selectedCoin) || coins[0];
  const coinIds = selectedCoinData ? [selectedCoinData.coinId] : [];
  const realtimePrices = useRealtimePrices(coinIds);
  const currentCoinPrice = realtimePrices[selectedCoinData?.coinId || '']?.priceUSD || selectedCoinData?.currentPrice || 1;

  const shippingFee = 0;
  const tax = totalPrice * 0.1;
  const subtotal = totalPrice;
  const totalBeforeDiscount = subtotal + shippingFee + tax;
  const finalTotal = totalBeforeDiscount - voucherDiscount;
  const totalInCoins = finalTotal / currentCoinPrice;

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      Alert.alert('Error', 'Please enter a voucher code');
      return;
    }

    try {
      const productIds = items.map((item) => item.productId);
      const result = await dispatch(
        validateVoucherAsync({
          code: voucherCode,
          totalAmount: totalBeforeDiscount,
          productIds,
          categories: [],
        })
      ).unwrap();

      if (result.success) {
        setVoucherDiscount(result.data.discountAmount);
        setAppliedVoucher(result.data);
        Alert.alert('Success', 'Voucher applied successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', error || 'Invalid voucher code');
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateAddress()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        shippingName: shippingAddress.fullName,
        shippingEmail: shippingAddress.email,
        shippingPhone: shippingAddress.phone,
        shippingAddress: shippingAddress.address,
        shippingCity: shippingAddress.city,
        shippingCountry: shippingAddress.country,
        shippingPostalCode: shippingAddress.postalCode,
        paymentMethod,
        coinId: paymentMethod === 'COIN' ? selectedCoinData?.coinId : undefined,
        coinSymbol: paymentMethod === 'COIN' ? selectedCoin : undefined,
        voucherCode: appliedVoucher?.code,
      };

      const result = await dispatch(createOrderAsync(orderData)).unwrap();

      if (result.success) {
        // Handle payment based on method
        if (paymentMethod === 'COIN') {
          // Process coin payment
          navigation.navigate('Orders' as never);
        } else if (paymentMethod === 'VNPAY') {
          // Navigate to VNPay payment
          navigation.navigate('VNPayPayment' as never, { orderId: result.data.id, amount: finalTotal } as never);
        } else if (paymentMethod === 'P2P') {
          // Navigate to P2P payment
          navigation.navigate('P2PPayment' as never, { orderId: result.data.id } as never);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const validateAddress = () => {
    return (
      shippingAddress.fullName.trim() !== '' &&
      shippingAddress.phone.trim() !== '' &&
      shippingAddress.email.trim() !== '' &&
      shippingAddress.address.trim() !== '' &&
      shippingAddress.city.trim() !== '' &&
      shippingAddress.country.trim() !== ''
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        {['address', 'payment', 'review'].map((s, index) => (
          <View key={s} style={styles.progressStep}>
            <View
              style={[
                styles.progressCircle,
                step === s || (index === 2 && step === 'review') ? styles.progressCircleActive : null,
              ]}
            >
              <Text style={styles.progressNumber}>{index + 1}</Text>
            </View>
            {index < 2 && <View style={styles.progressLine} />}
          </View>
        ))}
      </View>

      {step === 'address' && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Shipping Address</Text>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={shippingAddress.fullName}
                onChangeText={(text) => setShippingAddress({ ...shippingAddress, fullName: text })}
                placeholder="Enter full name"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={shippingAddress.email}
                onChangeText={(text) => setShippingAddress({ ...shippingAddress, email: text })}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={shippingAddress.phone}
                onChangeText={(text) => setShippingAddress({ ...shippingAddress, phone: text })}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={styles.input}
                value={shippingAddress.address}
                onChangeText={(text) => setShippingAddress({ ...shippingAddress, address: text })}
                placeholder="Enter address"
                multiline
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={shippingAddress.city}
                  onChangeText={(text) => setShippingAddress({ ...shippingAddress, city: text })}
                  placeholder="Enter city"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Postal Code</Text>
                <TextInput
                  style={styles.input}
                  value={shippingAddress.postalCode}
                  onChangeText={(text) => setShippingAddress({ ...shippingAddress, postalCode: text })}
                  placeholder="Enter postal code"
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Country *</Text>
              <TextInput
                style={styles.input}
                value={shippingAddress.country}
                onChangeText={(text) => setShippingAddress({ ...shippingAddress, country: text })}
                placeholder="Enter country"
              />
            </View>
            <Button
              title="Continue to Payment"
              onPress={() => {
                if (validateAddress()) setStep('payment');
              }}
              style={styles.nextButton}
            />
          </View>
        </View>
      )}

      {step === 'payment' && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Payment Method</Text>
          <View style={styles.form}>
            {/* Payment Method Selection */}
            <View style={styles.paymentMethods}>
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'COIN' && styles.paymentMethodActive]}
                onPress={() => setPaymentMethod('COIN')}
              >
                <Text style={styles.paymentMethodText}>Cryptocurrency</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'VNPAY' && styles.paymentMethodActive]}
                onPress={() => setPaymentMethod('VNPAY')}
              >
                <Text style={styles.paymentMethodText}>VNPay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'P2P' && styles.paymentMethodActive]}
                onPress={() => setPaymentMethod('P2P')}
              >
                <Text style={styles.paymentMethodText}>P2P Transfer</Text>
              </TouchableOpacity>
            </View>

            {/* Coin Selection */}
            {paymentMethod === 'COIN' && (
              <View style={styles.coinSelection}>
                <Text style={styles.label}>Select Coin</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {coins.map((coin) => (
                    <TouchableOpacity
                      key={coin.coinId}
                      style={[
                        styles.coinOption,
                        selectedCoin === coin.symbol && styles.coinOptionActive,
                      ]}
                      onPress={() => setSelectedCoin(coin.symbol)}
                    >
                      <Text style={styles.coinSymbol}>{coin.symbol}</Text>
                      <Text style={styles.coinPrice}>
                        ${(realtimePrices[coin.coinId]?.priceUSD || coin.currentPrice).toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {selectedCoinData && (
                  <View style={styles.coinTotal}>
                    <Text style={styles.coinTotalLabel}>Total in {selectedCoin}:</Text>
                    <Text style={styles.coinTotalValue}>{totalInCoins.toFixed(6)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Voucher Input */}
            <View style={styles.voucherContainer}>
              <Text style={styles.label}>Voucher Code</Text>
              <View style={styles.voucherInputRow}>
                <TextInput
                  style={styles.voucherInput}
                  value={voucherCode}
                  onChangeText={setVoucherCode}
                  placeholder="Enter voucher code"
                  placeholderTextColor={colors.light.textSecondary}
                />
                <TouchableOpacity style={styles.voucherButton} onPress={handleApplyVoucher}>
                  <Text style={styles.voucherButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
              {voucherDiscount > 0 && (
                <Text style={styles.voucherDiscount}>
                  Discount: -${voucherDiscount.toFixed(2)}
                </Text>
              )}
            </View>

            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={styles.summaryValue}>${shippingFee.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
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
                <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Button
                title="Back"
                onPress={() => setStep('address')}
                variant="outline"
                style={styles.backButton}
              />
              <Button
                title="Review Order"
                onPress={() => setStep('review')}
                style={styles.nextButton}
              />
            </View>
          </View>
        </View>
      )}

      {step === 'review' && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Review Order</Text>
          <View style={styles.form}>
            {/* Order Items */}
            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Items</Text>
              {items.map((item) => (
                <View key={item.id} style={styles.reviewItem}>
                  <Text style={styles.reviewItemText}>
                    {item.productTitle} x {item.quantity}
                  </Text>
                  <Text style={styles.reviewItemPrice}>
                    ${(item.priceInUSD * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Shipping Address */}
            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Shipping To</Text>
              <Text style={styles.reviewText}>{shippingAddress.fullName}</Text>
              <Text style={styles.reviewText}>{shippingAddress.phone}</Text>
              <Text style={styles.reviewText}>{shippingAddress.email}</Text>
              <Text style={styles.reviewText}>
                {shippingAddress.address}, {shippingAddress.city}, {shippingAddress.country}{' '}
                {shippingAddress.postalCode}
              </Text>
            </View>

            {/* Payment Method */}
            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Payment Method</Text>
              <Text style={styles.reviewText}>{paymentMethod}</Text>
              {paymentMethod === 'COIN' && (
                <Text style={styles.reviewText}>
                  {totalInCoins.toFixed(6)} {selectedCoin}
                </Text>
              )}
            </View>

            <View style={styles.summaryBox}>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Button
                title="Back"
                onPress={() => setStep('payment')}
                variant="outline"
                style={styles.backButton}
              />
              <Button
                title={loading ? 'Placing Order...' : 'Place Order'}
                onPress={handlePlaceOrder}
                loading={loading}
                style={styles.nextButton}
              />
            </View>
          </View>
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.light.surface,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleActive: {
    backgroundColor: colors.primary,
  },
  progressNumber: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: colors.light.border,
    marginHorizontal: spacing.sm,
  },
  stepContainer: {
    padding: spacing.lg,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.light.text,
    marginBottom: spacing.xl,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    color: colors.light.text,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  input: {
    ...typography.body,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.light.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  paymentMethods: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  paymentMethod: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.light.border,
    alignItems: 'center',
  },
  paymentMethodActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  paymentMethodText: {
    ...typography.bodySmall,
    color: colors.light.text,
    fontWeight: '600',
  },
  coinSelection: {
    marginBottom: spacing.xl,
  },
  coinOption: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginRight: spacing.md,
    minWidth: 100,
    alignItems: 'center',
  },
  coinOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  coinSymbol: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  coinPrice: {
    ...typography.caption,
    color: colors.light.textSecondary,
  },
  coinTotal: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coinTotalLabel: {
    ...typography.body,
    color: colors.light.text,
  },
  coinTotalValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  voucherContainer: {
    marginBottom: spacing.xl,
  },
  voucherInputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  voucherInput: {
    flex: 1,
    ...typography.body,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.light.text,
  },
  voucherButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 12,
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
  summaryBox: {
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
  reviewSection: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  reviewSectionTitle: {
    ...typography.h3,
    color: colors.light.text,
    marginBottom: spacing.md,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reviewItemText: {
    ...typography.body,
    color: colors.light.text,
    flex: 1,
  },
  reviewItemPrice: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  reviewText: {
    ...typography.body,
    color: colors.light.textSecondary,
    marginBottom: spacing.xs,
  },
});

export default CheckoutScreen;

