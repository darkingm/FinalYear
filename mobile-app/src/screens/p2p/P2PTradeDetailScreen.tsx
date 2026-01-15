import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootState, AppDispatch } from '../../store/store';
import { fetchP2PTradeByIdAsync, submitPaymentProofAsync } from '../../store/thunks/p2pThunks';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const P2PTradeDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch<AppDispatch>();
  const { currentTrade, loading } = useSelector((state: RootState) => state.p2p);
  const { user } = useSelector((state: RootState) => state.auth);

  const tradeId = (route.params as any)?.tradeId;
  const [paymentProofImage, setPaymentProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (tradeId) {
      dispatch(fetchP2PTradeByIdAsync(tradeId));
    }
  }, [tradeId, dispatch]);

  const handleSelectImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          // In production, upload image to server first, then use URL
          setPaymentProofImage(response.assets[0].uri || null);
        }
      }
    );
  };

  const handleSubmitProof = async () => {
    if (!paymentProofImage) {
      Alert.alert('Error', 'Please select a payment proof image');
      return;
    }

    setUploading(true);
    try {
      // TODO: Upload image to server first, get URL
      const imageUrl = paymentProofImage; // Placeholder
      
      await dispatch(submitPaymentProofAsync({ id: tradeId, paymentProofImage: imageUrl })).unwrap();
      Alert.alert('Success', 'Payment proof submitted successfully');
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to submit payment proof');
    } finally {
      setUploading(false);
    }
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

  if (loading && !currentTrade) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!currentTrade) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Trade not found</Text>
      </View>
    );
  }

  const isBuyer = currentTrade.tradeType === 'BUY';
  const canSubmitProof = isBuyer && currentTrade.status === 'AWAITING_PAYMENT';

  return (
    <ScrollView style={styles.container}>
      {/* Trade Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.tradeType}>
            {currentTrade.tradeType} {currentTrade.coinType}
          </Text>
          <Text style={styles.tradeAmount}>
            {currentTrade.coinAmount} {currentTrade.coinType}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentTrade.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(currentTrade.status) }]}>
            {currentTrade.status}
          </Text>
        </View>
      </View>

      {/* Trade Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trade Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount:</Text>
          <Text style={styles.detailValue}>
            {currentTrade.coinAmount} {currentTrade.coinType}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price:</Text>
          <Text style={styles.detailValue}>
            {currentTrade.fiatCurrency} {currentTrade.fiatAmount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Exchange Rate:</Text>
          <Text style={styles.detailValue}>
            {currentTrade.exchangeRate.toLocaleString()} {currentTrade.fiatCurrency}/{currentTrade.coinType}
          </Text>
        </View>
      </View>

      {/* Bank Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bank Account Details</Text>
        <View style={styles.bankCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bank:</Text>
            <Text style={styles.detailValue}>{currentTrade.bankName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Number:</Text>
            <Text style={styles.detailValue}>{currentTrade.bankAccountNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Name:</Text>
            <Text style={styles.detailValue}>{currentTrade.bankAccountName}</Text>
          </View>
        </View>
      </View>

      {/* Payment Proof Upload (for buyers) */}
      {canSubmitProof && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Proof</Text>
          {paymentProofImage ? (
            <View style={styles.proofContainer}>
              <Image source={{ uri: paymentProofImage }} style={styles.proofImage} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={handleSelectImage}
              >
                <Text style={styles.changeImageText}>Change Image</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={handleSelectImage}>
              <Text style={styles.uploadButtonText}>Select Payment Proof Image</Text>
            </TouchableOpacity>
          )}
          {paymentProofImage && (
            <Button
              title={uploading ? 'Submitting...' : 'Submit Proof'}
              onPress={handleSubmitProof}
              loading={uploading}
              style={styles.submitButton}
            />
          )}
        </View>
      )}

      {/* Payment Proof Display (if submitted) */}
      {currentTrade.paymentProofImage && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Proof</Text>
          <Image
            source={{ uri: currentTrade.paymentProofImage }}
            style={styles.proofImage}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.timeline}>
          <View style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Trade Created</Text>
              <Text style={styles.timelineDate}>
                {new Date(currentTrade.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>
          {currentTrade.paymentSubmittedAt && (
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Payment Proof Submitted</Text>
                <Text style={styles.timelineDate}>
                  {new Date(currentTrade.paymentSubmittedAt).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
          {currentTrade.completedAt && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotActive]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Trade Completed</Text>
                <Text style={styles.timelineDate}>
                  {new Date(currentTrade.completedAt).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
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
    alignItems: 'flex-start',
    padding: spacing.lg,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerInfo: {
    flex: 1,
  },
  tradeType: {
    ...typography.body,
    color: colors.light.textSecondary,
    marginBottom: spacing.xs,
  },
  tradeAmount: {
    ...typography.h2,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.body,
    color: colors.light.textSecondary,
  },
  detailValue: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
  },
  bankCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  proofContainer: {
    marginTop: spacing.md,
  },
  proofImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  changeImageButton: {
    padding: spacing.md,
    backgroundColor: colors.light.surface,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeImageText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  uploadButton: {
    padding: spacing.xl,
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.light.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  uploadButtonText: {
    ...typography.body,
    color: colors.light.textSecondary,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  timeline: {
    marginTop: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.light.border,
    marginRight: spacing.md,
    marginTop: spacing.xs,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  timelineDate: {
    ...typography.caption,
    color: colors.light.textSecondary,
  },
});

export default P2PTradeDetailScreen;


