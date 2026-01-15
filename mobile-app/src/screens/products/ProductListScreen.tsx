import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store/store';
import { fetchProducts } from '../../store/thunks/productThunks';
import ProductCard from '../../components/product/ProductCard';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const ProductListScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch<AppDispatch>();
  const { products, loading, pagination } = useSelector((state: RootState) => state.product);

  const initialCategory = (route.params as any)?.category;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || '');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const categories = ['Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Toys'];

  useEffect(() => {
    loadProducts(1);
  }, [selectedCategory, sortBy, sortOrder, searchQuery]);

  const loadProducts = useCallback(
    async (pageNum: number) => {
      await dispatch(
        fetchProducts({
          page: pageNum,
          limit: 20,
          category: selectedCategory || undefined,
          search: searchQuery || undefined,
          sortBy,
          sortOrder,
        })
      );
    },
    [dispatch, selectedCategory, searchQuery, sortBy, sortOrder]
  );

  const handleLoadMore = () => {
    if (!loading && pagination.hasMore && page < pagination.totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadProducts(nextPage);
    }
  };

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetail' as never, { productId } as never);
  };

  const renderProduct = ({ item }: { item: any }) => (
    <View style={styles.productWrapper}>
      <ProductCard product={item} onPress={() => handleProductPress(item._id)} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={colors.light.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory('')}
          >
            <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            <Text style={styles.sortText}>
              {sortBy === 'priceInUSD' ? 'Price' : 'Newest'} ({sortOrder === 'desc' ? '↓' : '↑'})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Products List */}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && page > 1 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      )}
    </View>
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
  filtersContainer: {
    paddingVertical: spacing.md,
    backgroundColor: colors.light.surface,
  },
  categoriesScroll: {
    paddingHorizontal: spacing.lg,
  },
  categoryChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.light.background,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.light.text,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  sortContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sortButton: {
    alignSelf: 'flex-end',
  },
  sortText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  productWrapper: {
    flex: 1,
    margin: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    padding: spacing.lg,
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
  },
});

export default ProductListScreen;

