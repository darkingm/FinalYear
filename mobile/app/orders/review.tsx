import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Star, Camera, X, CheckCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../lib/api/client';

const QUICK_TAGS = [
  '📦 Đóng gói tốt', '🚀 Giao hàng nhanh', '✨ Sản phẩm chính hãng',
  '💬 Seller nhiệt tình', '🎯 Đúng mô tả', '💰 Giá tốt',
  '🏆 Sẽ mua lại', '❤️ Rất hài lòng',
];

export default function WriteReviewScreen() {
  const { orderId, productId, productName } = useLocalSearchParams<{
    orderId: string; productId: string; productName: string;
  }>();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const STAR_LABELS = ['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Tuyệt vời!'];
  const activeRating = hoveredStar || rating;

  const pickImage = async () => {
    if (images.length >= 4) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const toggleTag = (tag: string) => {
    Haptics.selectionAsync();
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Chưa chọn sao', 'Vui lòng chọn số sao đánh giá');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(`/api/orders/${orderId}/review`, {
        product_id: productId,
        rating,
        comment: [selectedTags.join(' '), comment].filter(Boolean).join('\n'),
        image_urls: images,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Lỗi', e.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success State ───────────────────────────────────────────────────────────
  if (submitted) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CheckCircle size={48} color="#10b981" />
        </View>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>Cảm ơn bạn! 🎉</Text>
        <Text style={{ color: '#9ca3af', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
          Đánh giá của bạn giúp cộng đồng mua sắm an toàn hơn. Seller cũng sẽ nhận được phản hồi từ bạn.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 28, backgroundColor: '#f0b90b', borderRadius: 16, paddingHorizontal: 36, paddingVertical: 14 }}
        >
          <Text style={{ color: 'black', fontWeight: '900', fontSize: 16 }}>Quay lại đơn hàng</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <ArrowLeft size={18} color="#9ca3af" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Đánh giá sản phẩm</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }} numberOfLines={1}>{productName || 'Sản phẩm'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Star Rating ── */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>Bạn cảm thấy thế nào về sản phẩm này?</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <Pressable
                key={s}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRating(s); }}
                onPressIn={() => setHoveredStar(s)}
                onPressOut={() => setHoveredStar(0)}
                style={{ padding: 4 }}
              >
                <Star
                  size={44}
                  color={s <= activeRating ? '#f0b90b' : '#1e2130'}
                  fill={s <= activeRating ? '#f0b90b' : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
          {activeRating > 0 && (
            <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 18, marginTop: 12 }}>
              {STAR_LABELS[activeRating]}
            </Text>
          )}
        </View>

        {/* ── Quick Tags ── */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>ĐÁNH GIÁ NHANH</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_TAGS.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag} onPress={() => toggleTag(tag)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
                    backgroundColor: active ? 'rgba(240,185,11,0.15)' : '#131722',
                    borderWidth: 1, borderColor: active ? '#f0b90b' : '#1e2130',
                  }}
                >
                  <Text style={{ color: active ? '#f0b90b' : '#6b7280', fontWeight: '600', fontSize: 12 }}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Comment ── */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>NHẬN XÉT CHI TIẾT</Text>
          <TextInput
            style={{
              backgroundColor: '#131722', borderRadius: 16, borderWidth: 1,
              borderColor: comment ? '#f0b90b40' : '#1e2130',
              color: 'white', padding: 16, minHeight: 120,
              fontSize: 14, lineHeight: 22, textAlignVertical: 'top',
            }}
            placeholder="Chia sẻ trải nghiệm của bạn để giúp người mua sau..."
            placeholderTextColor="#374151"
            multiline
            value={comment}
            onChangeText={setComment}
          />
          <Text style={{ color: '#4b5563', fontSize: 11, marginTop: 6, textAlign: 'right' }}>{comment.length}/500</Text>
        </View>

        {/* ── Image Upload ── */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
            ẢNH THỰC TẾ ({images.length}/4)
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {images.map((uri, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
                <Pressable
                  onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 99, padding: 2 }}
                >
                  <X size={12} color="white" />
                </Pressable>
              </View>
            ))}
            {images.length < 4 && (
              <Pressable
                onPress={pickImage}
                style={{
                  width: 80, height: 80, borderRadius: 12, backgroundColor: '#131722',
                  borderWidth: 2, borderColor: '#1e2130', borderStyle: 'dashed',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Camera size={24} color="#4b5563" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Submit ── */}
        <Pressable onPress={handleSubmit} disabled={submitting} style={{ borderRadius: 16, overflow: 'hidden' }}>
          <LinearGradient
            colors={rating > 0 ? ['#f0b90b', '#e6a800'] : ['#1e2130', '#1e2130']}
            style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
          >
            {submitting ? (
              <ActivityIndicator color={rating > 0 ? 'black' : '#4b5563'} />
            ) : (
              <>
                <Star size={18} color={rating > 0 ? 'black' : '#4b5563'} fill={rating > 0 ? 'black' : 'transparent'} />
                <Text style={{ color: rating > 0 ? 'black' : '#4b5563', fontWeight: '900', fontSize: 16 }}>
                  Gửi đánh giá
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={{ color: '#374151', fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 18 }}>
          Đánh giá trung thực giúp xây dựng cộng đồng Web3 tin cậy.{'\n'}
          Seller nhận +3 Credit Score từ mỗi đánh giá 5 sao.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
