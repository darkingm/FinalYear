import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, Image, RefreshControl,
  ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Zap, ExternalLink, Shield, Package, CheckCircle } from 'lucide-react-native';
import { useAuthStore } from '../../lib/store/auth-store';
import { useNFTPortfolio } from '../../lib/hooks/useNFTPortfolio';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { shortenAddress, getTxUrl, formatDate } from '../../lib/utils/format';
import type { NFTItem } from '../../lib/types';

function NFTCard({ item }: { item: NFTItem }) {
  const imgUri = item.metadata?.imageUrl ?? item.primary_image;
  return (
    <Link href={`/nft/${item.token_id}` as any} asChild style={{ flex: 1 }}>
      <Pressable style={{ backgroundColor: '#131722', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1e2130', flex: 1 }}>
        {/* Image */}
        <View style={{ height: 160, backgroundColor: '#1a1f2e', position: 'relative' }}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Package size={40} color="#374151" />
            </View>
          )}
          {/* NFT badge */}
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(139,92,246,0.9)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Zap size={10} color="white" />
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>NFT #{item.token_id}</Text>
          </View>
          {/* Verified badge */}
          {item.nfc_verified && (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(16,185,129,0.9)', borderRadius: 99, padding: 4 }}>
              <CheckCircle size={12} color="white" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ padding: 12, gap: 4 }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }} numberOfLines={2}>
            {item.product_name}
          </Text>
          <Text style={{ color: '#6b7280', fontSize: 10 }}>
            Mint: {formatDate(item.minted_at)}
          </Text>
          <Pressable
            onPress={e => { e.stopPropagation(); if (item.mint_tx_hash) Linking.openURL(getTxUrl(item.mint_tx_hash)); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
          >
            <Text style={{ color: '#8b5cf6', fontSize: 10 }} numberOfLines={1}>
              {shortenAddress(item.mint_tx_hash)}
            </Text>
            <ExternalLink size={9} color="#8b5cf6" />
          </Pressable>
        </View>
      </Pressable>
    </Link>
  );
}

export default function WalletScreen() {
  const { user, isAuthenticated } = useAuthStore();
  const walletAddress = (user as any)?.wallet_address ?? null;
  const { nfts, loading, refreshing, error, refresh } = useNFTPortfolio(walletAddress);

  if (!isAuthenticated) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <EmptyState
        icon={<Shield size={36} color="#6b7280" />}
        title="NFT Portfolio"
        subtitle="Đăng nhập để xem các NFT sản phẩm thực bạn đang sở hữu."
        action={{ label: 'Đăng nhập', onPress: () => {} }}
      />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>NFT Wallet</Text>
        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
          {walletAddress ? shortenAddress(walletAddress) : 'Chưa kết nối ví'}
        </Text>
      </View>

      {/* Summary Card */}
      <View style={{ margin: 16, backgroundColor: '#131722', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e2130', flexDirection: 'row' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>TỔNG NFT</Text>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '900' }}>{nfts.length}</Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#1e2130' }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>ĐÃ XÁC THỰC</Text>
          <Text style={{ color: '#10b981', fontSize: 28, fontWeight: '900' }}>
            {nfts.filter(n => n.nfc_verified).length}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#1e2130' }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>CHƯA XÁC THỰC</Text>
          <Text style={{ color: '#f97316', fontSize: 28, fontWeight: '900' }}>
            {nfts.filter(n => !n.nfc_verified).length}
          </Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1, minWidth: '45%' }}><SkeletonCard /></View>)}
          </View>
        </ScrollView>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : nfts.length === 0 ? (
        <EmptyState
          icon={<Zap size={36} color="#6b7280" />}
          title="Chưa có NFT nào"
          subtitle="Mua sản phẩm có tích hợp NFT để bắt đầu bộ sưu tập của bạn."
          action={{ label: 'Khám phá sản phẩm', onPress: () => {} }}
        />
      ) : (
        <FlatList
          data={nfts}
          keyExtractor={n => n.token_id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, gap: 12 }}
          contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#8b5cf6" />}
          renderItem={({ item }) => <NFTCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}
