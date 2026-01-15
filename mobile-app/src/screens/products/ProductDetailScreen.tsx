import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import ImageView from 'react-native-image-viewing';
import { RootState, AppDispatch } from '../../store/store';
import { fetchProductById, toggleLikeProduct } from '../../store/thunks/productThunks';
import { addToCartAsync } from '../../store/thunks/cartThunks';
import Button from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const { width } = Dimensions.get('window');

const ProductDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch<AppDispatch>();
  const { currentProduct, loading } = useSelector((state: RootState) => state.product);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const productId = (route.params as any)?.productId;
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (productId) {
      dispatch(fetchProductById(productId));
    }
  }, [productId, dispatch]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      // Navigate to login
      return;
    }

    if (!currentProduct) return;

    setAddingToCart(true);
    try {
      await dispatch(
        addToCartAsync({
          productId: currentProduct._id,
          productTitle: currentProduct.title,
          productImage: currentProduct.images[0] || '',
          sellerId: currentProduct.sellerId,
          sellerName: currentProduct.sellerName,
          quantity,
          priceInCoins: currentProduct.priceInCoins,
          priceInUSD: currentProduct.priceInUSD,
        })
      ).unwrap();
      // Show success message
    } catch (error: any) {
      // Show error message
    } finally {
      setAddingToCart(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated || !currentProduct) return;
    await dispatch(toggleLikeProduct(currentProduct._id));
  };

  if (loading && !currentProduct) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!currentProduct) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const images = currentProduct.images.length > 0
    ? currentProduct.images.map((uri) => ({ uri }))
    : [{ uri: 'https://via.placeholder.com/400' }];

  return (
    <ScrollView style={styles.container}>
      {/* Image Gallery */}
      <View style={styles.imageContainer}>
        <TouchableOpacity onPress={() => setImageViewerVisible(true)}>
          <FastImage
            source={{ uri: currentProduct.images[selectedImageIndex] || images[0].uri }}
            style={styles.mainImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        </TouchableOpacity>
        {currentProduct.images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
            {currentProduct.images.map((image, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedImageIndex(index)}
                style={[
                  styles.thumbnail,
                  index === selectedImageIndex && styles.thumbnailActive,
                ]}
              >
                <FastImage
                  source={{ uri: image }}
                  style={styles.thumbnailImage}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{currentProduct.title}</Text>
          <TouchableOpacity onPress={handleLike}>
            <Text style={styles.likeButton}>
              {currentProduct.likes?.includes('current-user-id') ? '❤️' : '🤍'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.priceUSD}>${currentProduct.priceInUSD.toFixed(2)}</Text>
          <Text style={styles.priceCoin}>
            {currentProduct.priceInCoins.toFixed(6)} {currentProduct.coinSymbol}
          </Text>
        </View>

        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Condition:</Text>
            <Text style={styles.metaValue}>{currentProduct.condition}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Location:</Text>
            <Text style={styles.metaValue}>{currentProduct.location}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rating:</Text>
            <Text style={styles.metaValue}>
              ⭐ {currentProduct.rating?.toFixed(1) || '4.5'} ({currentProduct.reviews || 0} reviews)
            </Text>
          </View>
        </View>

        {/* Seller Info */}
        <View style={styles.sellerContainer}>
          <FastImage
            source={{ uri: currentProduct.sellerAvatar || 'https://via.placeholder.com/50' }}
            style={styles.sellerAvatar}
            resizeMode={FastImage.resizeMode.cover}
          />
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>{currentProduct.sellerName}</Text>
            <Text style={styles.sellerLabel}>Seller</Text>
          </View>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => {
              // Navigate to chat
            }}
          >
            <Text style={styles.chatButtonText}>Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>Description</Text>
          <Text style={styles.description}>{currentProduct.description}</Text>
        </View>

        {/* Quantity Selector */}
        <View style={styles.quantityContainer}>
          <Text style={styles.quantityLabel}>Quantity:</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.min(currentProduct.quantity, quantity + 1))}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.stockText}>
            {currentProduct.quantity} available
          </Text>
        </View>

        {/* Add to Cart Button */}
        <Button
          title={addingToCart ? 'Adding to Cart...' : 'Add to Cart'}
          onPress={handleAddToCart}
          loading={addingToCart}
          disabled={addingToCart || currentProduct.quantity === 0}
          style={styles.addToCartButton}
        />
      </View>

      {/* Image Viewer */}
      <ImageView
        images={images}
        imageIndex={selectedImageIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
      />
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
  imageContainer: {
    backgroundColor: colors.light.surface,
  },
  mainImage: {
    width,
    height: width,
  },
  thumbnailContainer: {
    padding: spacing.md,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.light.text,
    flex: 1,
    marginRight: spacing.md,
  },
  likeButton: {
    fontSize: 24,
  },
  priceContainer: {
    marginBottom: spacing.lg,
  },
  priceUSD: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
  },
  priceCoin: {
    ...typography.body,
    color: colors.light.textSecondary,
    marginTop: spacing.xs,
  },
  metaContainer: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  metaItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.light.textSecondary,
    width: 100,
  },
  metaValue: {
    ...typography.bodySmall,
    color: colors.light.text,
    fontWeight: '600',
  },
  sellerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: spacing.md,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
  },
  sellerLabel: {
    ...typography.caption,
    color: colors.light.textSecondary,
  },
  chatButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  chatButtonText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  descriptionContainer: {
    marginBottom: spacing.lg,
  },
  descriptionTitle: {
    ...typography.h3,
    color: colors.light.text,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.light.textSecondary,
    lineHeight: 24,
  },
  quantityContainer: {
    marginBottom: spacing.lg,
  },
  quantityLabel: {
    ...typography.body,
    color: colors.light.text,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  quantityButtonText: {
    ...typography.h3,
    color: colors.light.text,
  },
  quantityValue: {
    ...typography.h3,
    color: colors.light.text,
    marginHorizontal: spacing.lg,
    minWidth: 40,
    textAlign: 'center',
  },
  stockText: {
    ...typography.caption,
    color: colors.light.textSecondary,
  },
  addToCartButton: {
    marginTop: spacing.md,
  },
});

export default ProductDetailScreen;


