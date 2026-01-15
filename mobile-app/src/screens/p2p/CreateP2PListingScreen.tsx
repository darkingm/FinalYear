import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store/store';
import { createP2PTradeAsync } from '../../store/thunks/p2pThunks';
import { fetchTop10Coins } from '../../store/thunks/coinThunks';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const CreateP2PListingScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { coins } = useSelector((state: RootState) => state.wallet);

  const [coinType, setCoinType] = useState('USDT');
  const [coinAmount, setCoinAmount] = useState('');
  const [pricePerCoin, setPricePerCoin] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  React.useEffect(() => {
    dispatch(fetchTop10Coins());
  }, [dispatch]);

  const handleCreate = async () => {
    if (!coinAmount || !pricePerCoin || !bankName || !bankAccountNumber || !bankAccountName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const coinAmountNum = parseFloat(coinAmount);
    const pricePerCoinNum = parseFloat(pricePerCoin);
    const fiatAmount = coinAmountNum * pricePerCoinNum;
    const exchangeRate = pricePerCoinNum;

    try {
      const result = await dispatch(
        createP2PTradeAsync({
          tradeType: 'SELL',
          coinAmount: coinAmountNum,
          coinType,
          fiatAmount,
          fiatCurrency: 'VND',
          exchangeRate,
          bankName,
          bankAccountNumber,
          bankAccountName,
        })
      ).unwrap();

      Alert.alert('Success', 'Listing created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to create listing');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Coin Type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {coins.map((coin) => (
              <TouchableOpacity
                key={coin.coinId}
                style={[
                  styles.coinOption,
                  coinType === coin.symbol && styles.coinOptionActive,
                ]}
                onPress={() => setCoinType(coin.symbol)}
              >
                <Text
                  style={[
                    styles.coinOptionText,
                    coinType === coin.symbol && styles.coinOptionTextActive,
                  ]}
                >
                  {coin.symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Coin Amount *</Text>
          <TextInput
            style={styles.input}
            value={coinAmount}
            onChangeText={setCoinAmount}
            placeholder="Enter amount"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Price per Coin (VND) *</Text>
          <TextInput
            style={styles.input}
            value={pricePerCoin}
            onChangeText={setPricePerCoin}
            placeholder="Enter price per coin"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.calculationBox}>
          <Text style={styles.calculationLabel}>Total Amount:</Text>
          <Text style={styles.calculationValue}>
            {coinAmount && pricePerCoin
              ? (parseFloat(coinAmount) * parseFloat(pricePerCoin)).toLocaleString()
              : '0'}{' '}
            VND
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bank Name *</Text>
          <TextInput
            style={styles.input}
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g., Vietcombank"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Account Number *</Text>
          <TextInput
            style={styles.input}
            value={bankAccountNumber}
            onChangeText={setBankAccountNumber}
            placeholder="Enter account number"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Account Name *</Text>
          <TextInput
            style={styles.input}
            value={bankAccountName}
            onChangeText={setBankAccountName}
            placeholder="Enter account holder name"
          />
        </View>

        <Button title="Create Listing" onPress={handleCreate} style={styles.createButton} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  form: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body,
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
  coinOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginRight: spacing.md,
    backgroundColor: colors.light.surface,
  },
  coinOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  coinOptionText: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
  },
  coinOptionTextActive: {
    color: '#FFFFFF',
  },
  calculationBox: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculationLabel: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
  },
  calculationValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  createButton: {
    marginTop: spacing.md,
  },
});

export default CreateP2PListingScreen;

