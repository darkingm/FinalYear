import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import apiClient from '../../api/client';
import { paymentEndpoints } from '../../api/endpoints';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const VNPayPaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const orderId = (route.params as any)?.orderId;
  const amount = (route.params as any)?.amount;

  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createPaymentUrl();
  }, []);

  const createPaymentUrl = async () => {
    try {
      const response = await apiClient.post(paymentEndpoints.vnpayCreate, {
        amount,
        orderId,
        orderDescription: `Payment for order ${orderId}`,
        orderType: 'other',
      });

      if (response.data.success) {
        setPaymentUrl(response.data.data.paymentUrl);
        setLoading(false);
      } else {
        throw new Error('Failed to create payment URL');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create payment URL', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;
    
    // Check if URL contains return parameters
    if (url.includes('vnp_ResponseCode') || url.includes('payment/vnpay/return')) {
      // Extract payment ID from URL or use orderId
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const paymentId = urlParams.get('vnp_TxnRef') || orderId;
      
      if (paymentId) {
        checkPaymentStatus(paymentId);
      }
    }
  };

  const checkPaymentStatus = async (paymentId: string) => {
    try {
      const response = await apiClient.get(paymentEndpoints.vnpayStatus(paymentId));
      
      if (response.data.success) {
        const { status } = response.data.data;
        
        if (status === 'COMPLETED' || status === 'PAID') {
          Alert.alert('Success', 'Payment completed successfully!', [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Orders' as never),
            },
          ]);
        } else if (status === 'FAILED') {
          Alert.alert('Payment Failed', 'Your payment could not be processed.', [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]);
        }
      }
    } catch (error: any) {
      console.error('Error checking payment status:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading payment...</Text>
      </View>
    );
  }

  if (!paymentUrl) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load payment page</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: paymentUrl }}
      onNavigationStateChange={handleNavigationStateChange}
      style={styles.webview}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.light.textSecondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.background,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
});

export default VNPayPaymentScreen;


