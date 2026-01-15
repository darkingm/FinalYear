import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store/store';
import { fetchFeaturedProducts } from '../../store/thunks/productThunks';
import { fetchTop10Coins } from '../../store/thunks/coinThunks';
import BannerCarousel from '../../components/home/BannerCarousel';
import CoinPriceTicker from '../../components/home/CoinPriceTicker';
import ProductCard from '../../components/product/ProductCard';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const CATEGORIES = [
  { id: 'Electronics', name: 'Electronics', icon: '📱' },
  { id: 'Fashion', name: 'Fashion', icon: '👕' },
  { id: 'Home', name: 'Home', icon: '🏠' },
  { id: 'Sports', name: 'Sports', icon: '⚽' },
  { id: 'Books', name: 'Books', icon: '📚' },
  { id: 'Toys', name: 'Toys', icon: '🧸' },
];

const BANNER_IMAGES = [
  'https://via.placeholder.com/400x200/FF6B35/FFFFFF?text=Banner+1',
  'https://via.placeholder.com/400x200/4ECDC4/FFFFFF?text=Banner+2',
  'https://via.placeholder.com/400x200/10B981/FFFFFF?text=Banner+3',
];

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { featuredProducts, loading } = useSelector((state: RootState) => state.product);
  const { coins } = useSelector((state: RootState) => state.wallet);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchFeaturedProducts());
    dispatch(fetchTop10Coins());
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchFeaturedProducts()),
      dispatch(fetchTop10Coins()),
    ]);
    setRefreshing(false);
  };

  const handleCategoryPress = (categoryId: string) => {
    navigation.navigate('ProductList' as never, { category: categoryId } as never);
  };

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetail' as never, { productId } as never);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={colors.light.textSecondary}
          onFocus={() => navigation.navigate('ProductList' as never)}
        />
      </View>

      {/* Coin Price Ticker */}
      {coins.length > 0 && <CoinPriceTicker coins={coins.slice(0, 5)} />}

      {/* Banner Carousel */}
      <BannerCarousel images={BANNER_IMAGES} />

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryItem}
              onPress={() => handleCategoryPress(category.id)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={styles.categoryName}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Flash Sale */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Flash Sale</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ProductList' as never)}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredProducts.slice(0, 5).map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onPress={() => handleProductPress(product._id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Featured Products */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ProductList' as never)}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onPress={() => handleProductPress(product._id)}
            />
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  searchContainer: {
    padding: spacing.lg,
    backgroundColor: colors.light.surface,
  },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.light.background,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    color: colors.light.text,
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.light.text,
    fontWeight: '700',
  },
  seeAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    minWidth: 80,
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  categoryName: {
    ...typography.caption,
    color: colors.light.text,
    fontWeight: '600',
  },
});

export default HomeScreen;


