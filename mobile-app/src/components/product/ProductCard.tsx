import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { Product } from '../../api/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <FastImage
        source={{ uri: product.images[0] || 'https://via.placeholder.com/200' }}
        style={styles.image}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={styles.priceUSD}>${product.priceInUSD.toFixed(2)}</Text>
          <Text style={styles.priceCoin}>
            {product.priceInCoins.toFixed(6)} {product.coinSymbol}
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>⭐ {product.rating?.toFixed(1) || '4.5'}</Text>
            <Text style={styles.reviews}>({product.reviews || 0})</Text>
          </View>
          <Text style={styles.location}>{product.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 180,
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 180,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.bodySmall,
    color: colors.light.text,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  priceContainer: {
    marginBottom: spacing.sm,
  },
  priceUSD: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  priceCoin: {
    ...typography.caption,
    color: colors.light.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    ...typography.caption,
    color: colors.light.text,
  },
  reviews: {
    ...typography.caption,
    color: colors.light.textSecondary,
    marginLeft: 4,
  },
  location: {
    ...typography.caption,
    color: colors.light.textSecondary,
  },
});

export default ProductCard;


