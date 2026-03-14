import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Animated, Platform,
  KeyboardAvoidingView, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../lib/api/client';
import { useAuthStore } from '../../lib/store/auth-store';
import {
  ArrowLeft, Camera, Plus, X, ChevronDown, DollarSign,
  Coins, Package, FileText, Tag, CheckCircle2, AlertCircle,
  Upload, Layers, Sparkles,
} from 'lucide-react-native';
import { AIDescribePanel } from '../../components/ai/AIDescribePanel';
import { AIPricingCard } from '../../components/ai/AIPricingCard';

const { width: W } = Dimensions.get('window');

const CATEGORIES = [
  { value: 'electronics', label: '💻 Điện tử', emoji: '💻' },
  { value: 'fashion',     label: '👗 Thời trang', emoji: '👗' },
  { value: 'accessories', label: '💍 Phụ kiện', emoji: '💍' },
  { value: 'gaming',      label: '🎮 Gaming', emoji: '🎮' },
  { value: 'home',        label: '🏠 Nhà & Đời sống', emoji: '🏠' },
  { value: 'books',       label: '📚 Sách', emoji: '📚' },
  { value: 'toys',        label: '🧸 Đồ chơi', emoji: '🧸' },
  { value: 'other',       label: '📦 Khác', emoji: '📦' },
];

const PRICE_MODES = [
  { id: 'usd', label: 'USD ($)', icon: DollarSign, desc: 'Giá cố định theo USD' },
  { id: 'token', label: 'Coin', icon: Coins, desc: 'Giá bán bằng crypto' },
];

interface FormField {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  type?: string;
  icon: any;
  required?: boolean;
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ flex: i === step ? 2 : 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? '#f0b90b' : '#1e2130' }} />
      ))}
      <Text style={{ color: '#6b7280', fontSize: 11, marginLeft: 4 }}>{step + 1}/{total}</Text>
    </View>
  );
}

export default function CreateProductScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const [step, setStep] = useState(0); // 0=Basic, 1=Pricing, 2=Images
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('1');
  const [priceMode, setPriceMode] = useState<'usd' | 'token'>('usd');
  const [priceUsd, setPriceUsd] = useState('');
  const [priceToken, setPriceToken] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('MATIC');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const TOKEN_OPTIONS = ['MATIC', 'ETH', 'USDT', 'USDC', 'WBTC'];

  const animate = (to: number) => {
    Animated.timing(slideAnim, { toValue: to, duration: 300, useNativeDriver: true }).start();
  };

  const goNext = () => {
    if (step === 0) {
      if (!name.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm'); return; }
      if (!category) { Alert.alert('Thiếu thông tin', 'Vui lòng chọn danh mục'); return; }
    }
    if (step === 1) {
      if (priceMode === 'usd' && !priceUsd) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập giá USD'); return; }
      if (priceMode === 'token' && (!priceToken || !priceUsd)) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ giá coin và giá USD tham chiếu'); return; }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s + 1);
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s - 1);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép truy cập thư viện ảnh'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages(imgs => [...imgs, ...result.assets.map(a => a.uri)].slice(0, 5));
    }
  };

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }),
      Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    setLoading(true);
    try {
      // Get token_id from backend if token mode
      let token_id: number | null = null;
      if (priceMode === 'token') {
        const tokRes = await apiClient.get('/api/products/tokens');
        const tokens: any[] = tokRes.data.data ?? [];
        const found = tokens.find((t: any) => t.symbol === tokenSymbol);
        token_id = found?.token_id ?? null;
      }

      const formData = {
        name: name.trim(),
        description: description.trim(),
        category,
        stock: parseInt(stock) || 1,
        base_price_usd: parseFloat(priceUsd) || 0,
        price_in_token: priceMode === 'token' ? parseFloat(priceToken) : null,
        token_id: priceMode === 'token' ? token_id : null,
      };

      await apiClient.post('/api/products', formData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Success animation
      Animated.spring(successAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
      setTimeout(() => router.push('/products'), 1800);
    } catch (e: any) {
      Alert.alert('Lỗi', e.response?.data?.message ?? 'Không thể tạo sản phẩm. Vui lòng thử lại.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setLoading(false);
  };

  if (!isAuthenticated) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Package size={48} color="#6b7280" />
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>Cần đăng nhập để đăng bán</Text>
      <Pressable onPress={() => router.push('/auth/login')} style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden' }}>
        <LinearGradient colors={['#f0b90b', '#e6a800']} style={{ paddingHorizontal: 32, paddingVertical: 12 }}>
          <Text style={{ color: 'black', fontWeight: '800', fontSize: 14 }}>Đăng nhập</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  // Success overlay
  const successScale = successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const successOpacity = successAnim;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Success Overlay */}
      <Animated.View style={{
        position: 'absolute', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(12,14,20,0.97)',
        alignItems: 'center', justifyContent: 'center',
        opacity: successOpacity,
      }}>
        <Animated.View style={{ transform: [{ scale: successScale }], alignItems: 'center' }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <CheckCircle2 size={44} color="#10b981" />
          </View>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Đăng bán thành công! 🎉</Text>
          <Text style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Sản phẩm đang chờ duyệt từ admin</Text>
        </Animated.View>
      </Animated.View>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <Pressable onPress={() => step > 0 ? goBack() : router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <ArrowLeft size={18} color="#9ca3af" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Đăng bán sản phẩm</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }}>
            {step === 0 ? 'Thông tin cơ bản' : step === 1 ? 'Định giá' : 'Hình ảnh'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <StepIndicator step={step} total={3} />

          {/* ── STEP 0: Basic Info ── */}
          {step === 0 && (
            <Animated.View>
              {/* Name */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Tên sản phẩm <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#131722', borderRadius: 14, borderWidth: 1, borderColor: name ? '#f0b90b40' : '#1e2130', paddingHorizontal: 14, paddingVertical: 2 }}>
                  <Package size={16} color="#6b7280" style={{ marginTop: 14 }} />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 12, color: 'white', fontSize: 14, marginLeft: 10 }}
                    placeholder="Tên sản phẩm rõ ràng, hấp dẫn"
                    placeholderTextColor="#4b5563"
                    value={name}
                    onChangeText={setName}
                    maxLength={100}
                  />
                  <Text style={{ color: '#4b5563', fontSize: 10, alignSelf: 'flex-end', paddingBottom: 12 }}>{name.length}/100</Text>
                </View>
              </View>

              {/* AI Description Panel */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>✨ AI MÔ TẢ TỰ ĐỘNG</Text>
                <AIDescribePanel
                  currentCategory={category}
                  onApply={(vals) => {
                    if (vals.name) setName(vals.name);
                    if (vals.description) setDescription(vals.description);
                    if (vals.category) setCategory(vals.category);
                  }}
                />
              </View>

              {/* Description */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Mô tả sản phẩm</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#131722', borderRadius: 14, borderWidth: 1, borderColor: '#1e2130', paddingHorizontal: 14, paddingTop: 12 }}>
                  <FileText size={16} color="#6b7280" style={{ marginTop: 2 }} />
                  <TextInput
                    style={{ flex: 1, color: 'white', fontSize: 14, marginLeft: 10, minHeight: 90, textAlignVertical: 'top' }}
                    placeholder="Mô tả chi tiết về sản phẩm, tình trạng, thông số..."
                    placeholderTextColor="#4b5563"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    maxLength={1000}
                  />
                </View>
              </View>

              {/* Category */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Danh mục <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <Pressable
                  onPress={() => setShowCategories(!showCategories)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#131722', borderRadius: 14, borderWidth: 1, borderColor: category ? '#f0b90b40' : '#1e2130', paddingHorizontal: 14, paddingVertical: 14 }}
                >
                  <Tag size={16} color="#6b7280" />
                  <Text style={{ flex: 1, color: category ? 'white' : '#4b5563', fontSize: 14, marginLeft: 10 }}>
                    {category ? CATEGORIES.find(c => c.value === category)?.label : 'Chọn danh mục'}
                  </Text>
                  <ChevronDown size={18} color="#6b7280" style={{ transform: [{ rotate: showCategories ? '180deg' : '0deg' }] }} />
                </Pressable>
                {showCategories && (
                  <View style={{ backgroundColor: '#131722', borderRadius: 14, marginTop: 6, borderWidth: 1, borderColor: '#1e2130', overflow: 'hidden' }}>
                    {CATEGORIES.map((cat, i) => (
                      <Pressable
                        key={cat.value}
                        onPress={() => { setCategory(cat.value); setShowCategories(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: i < CATEGORIES.length - 1 ? 1 : 0, borderBottomColor: '#1e2130', backgroundColor: category === cat.value ? 'rgba(240,185,11,0.08)' : 'transparent' }}
                      >
                        <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                        <Text style={{ color: category === cat.value ? '#f0b90b' : 'white', fontWeight: category === cat.value ? '700' : '400', fontSize: 14 }}>{cat.label}</Text>
                        {category === cat.value && <CheckCircle2 size={14} color="#f0b90b" style={{ marginLeft: 'auto' }} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Stock */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Số lượng tồn kho</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={() => setStock(s => String(Math.max(1, parseInt(s) - 1)))}
                    style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#131722', borderWidth: 1, borderColor: '#1e2130', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: '300' }}>−</Text>
                  </Pressable>
                  <View style={{ flex: 1, backgroundColor: '#131722', borderRadius: 12, borderWidth: 1, borderColor: '#1e2130', paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' }}>
                    <TextInput
                      style={{ color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center', width: '100%' }}
                      value={stock}
                      onChangeText={v => setStock(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                    />
                  </View>
                  <Pressable onPress={() => setStock(s => String(parseInt(s) + 1))}
                    style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#131722', borderWidth: 1, borderColor: '#1e2130', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: '300' }}>+</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── STEP 1: Pricing ── */}
          {step === 1 && (
            <View>
              <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Phương thức định giá</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                {PRICE_MODES.map(m => (
                  <Pressable
                    key={m.id}
                    onPress={() => { setPriceMode(m.id as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={{ flex: 1, borderRadius: 14, borderWidth: 2, borderColor: priceMode === m.id ? '#f0b90b' : '#1e2130', backgroundColor: priceMode === m.id ? 'rgba(240,185,11,0.08)' : '#131722', padding: 14, alignItems: 'center', gap: 6 }}
                  >
                    <m.icon size={24} color={priceMode === m.id ? '#f0b90b' : '#6b7280'} />
                    <Text style={{ color: priceMode === m.id ? '#f0b90b' : 'white', fontWeight: '700', fontSize: 13 }}>{m.label}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 10, textAlign: 'center' }}>{m.desc}</Text>
                  </Pressable>
                ))}
              </View>

              {priceMode === 'usd' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Giá (USD) <Text style={{ color: '#ef4444' }}>*</Text></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#131722', borderRadius: 14, borderWidth: 1, borderColor: priceUsd ? '#f0b90b40' : '#1e2130', paddingHorizontal: 14 }}>
                    <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 18, marginRight: 8 }}>$</Text>
                    <TextInput
                      style={{ flex: 1, paddingVertical: 14, color: 'white', fontSize: 20, fontWeight: '700', fontFamily: 'monospace' }}
                      placeholder="0.00"
                      placeholderTextColor="#4b5563"
                      value={priceUsd}
                      onChangeText={setPriceUsd}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              )}

              {/* AI Pricing Suggestion — shows when name+category are filled */}
              {name.trim() && category && (
                <View style={{ marginBottom: 16 }}>
                  <AIPricingCard
                    category={category}
                    productName={name}
                    onApply={(price) => setPriceUsd(String(price.toFixed(2)))}
                  />
                </View>
              )}


              {priceMode === 'token' && (
                <View>
                  {/* Token selector */}
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Loại coin</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {TOKEN_OPTIONS.map(tok => (
                      <Pressable
                        key={tok}
                        onPress={() => { setTokenSymbol(tok); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={{ marginRight: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: tokenSymbol === tok ? '#f0b90b' : '#1e2130', backgroundColor: tokenSymbol === tok ? 'rgba(240,185,11,0.1)' : '#131722' }}
                      >
                        <Text style={{ color: tokenSymbol === tok ? '#f0b90b' : '#9ca3af', fontWeight: '700', fontSize: 13 }}>{tok}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Token price */}
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Giá bán ({tokenSymbol}) <Text style={{ color: '#ef4444' }}>*</Text></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#131722', borderRadius: 14, borderWidth: 1, borderColor: priceToken ? '#f0b90b40' : '#1e2130', paddingHorizontal: 14, marginBottom: 12 }}>
                    <Coins size={18} color="#f0b90b" style={{ marginRight: 8 }} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 14, color: 'white', fontSize: 18, fontWeight: '700', fontFamily: 'monospace' }}
                      placeholder={tokenSymbol === 'ETH' ? '0.000001' : '0.0000'}
                      placeholderTextColor="#4b5563"
                      value={priceToken}
                      onChangeText={setPriceToken}
                      keyboardType="decimal-pad"
                    />
                    <Text style={{ color: '#6b7280', fontWeight: '600' }}>{tokenSymbol}</Text>
                  </View>

                  {/* USD reference */}
                  <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Giá tham chiếu (USD) <Text style={{ color: '#ef4444' }}>*</Text></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#131722', borderRadius: 14, borderWidth: 1, borderColor: priceUsd ? '#f0b90b40' : '#1e2130', paddingHorizontal: 14, marginBottom: 8 }}>
                    <DollarSign size={18} color="#6b7280" style={{ marginRight: 8 }} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 14, color: 'white', fontSize: 18, fontWeight: '700', fontFamily: 'monospace' }}
                      placeholder="0.00"
                      placeholderTextColor="#4b5563"
                      value={priceUsd}
                      onChangeText={setPriceUsd}
                      keyboardType="decimal-pad"
                    />
                    <Text style={{ color: '#6b7280', fontWeight: '600' }}>USD</Text>
                  </View>
                  <Text style={{ color: '#4b5563', fontSize: 11, lineHeight: 16 }}>💡 Giá USD dùng để ước tính giá trị khi crypto tăng/giảm</Text>
                </View>
              )}
            </View>
          )}

          {/* ── STEP 2: Images ── */}
          {step === 2 && (
            <View>
              <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Hình ảnh sản phẩm <Text style={{ color: '#6b7280', fontWeight: '400' }}>({images.length}/5)</Text>
              </Text>

              {/* Image grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {images.map((img, i) => (
                  <View key={i} style={{ width: (W - 52) / 3, aspectRatio: 1, borderRadius: 12, overflow: 'hidden' }}>
                    <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <Pressable
                      onPress={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.9)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={12} color="white" />
                    </Pressable>
                    {i === 0 && (
                      <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(240,185,11,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ color: 'black', fontSize: 9, fontWeight: '700' }}>Chính</Text>
                      </View>
                    )}
                  </View>
                ))}

                {images.length < 5 && (
                  <Pressable
                    onPress={pickImage}
                    style={{ width: (W - 52) / 3, aspectRatio: 1, borderRadius: 12, borderWidth: 2, borderColor: '#1e2130', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#131722', gap: 4 }}
                  >
                    <Plus size={24} color="#6b7280" />
                    <Text style={{ color: '#6b7280', fontSize: 10 }}>Thêm ảnh</Text>
                  </Pressable>
                )}
              </View>

              {/* Upload button */}
              <Pressable onPress={pickImage} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#131722', borderRadius: 14, borderWidth: 1, borderColor: '#1e2130', paddingVertical: 14, marginBottom: 16 }}>
                <Upload size={18} color="#f0b90b" />
                <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 14 }}>Chọn từ thư viện</Text>
              </Pressable>

              {/* Summary card */}
              <View style={{ backgroundColor: '#131722', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0b90b30' }}>
                <Text style={{ color: '#f0b90b', fontSize: 12, fontWeight: '700', marginBottom: 10 }}>📋 Tóm tắt sản phẩm</Text>
                <View style={{ gap: 6 }}>
                  {[
                    { label: 'Tên', value: name || '—' },
                    { label: 'Danh mục', value: CATEGORIES.find(c => c.value === category)?.label || '—' },
                    { label: 'Tồn kho', value: `${stock} sản phẩm` },
                    { label: 'Giá',
                      value: priceMode === 'token'
                        ? `${priceToken} ${tokenSymbol} (≈$${priceUsd})`
                        : `$${priceUsd}` },
                  ].map(item => (
                    <View key={item.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#6b7280', fontSize: 12 }}>{item.label}</Text>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }} numberOfLines={1}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom CTA */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 34, paddingTop: 12, backgroundColor: 'rgba(12,14,20,0.97)', borderTopWidth: 1, borderTopColor: '#1e2130', gap: 10 }}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Pressable
            onPress={step < 2 ? goNext : handleSubmit}
            disabled={loading}
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={loading ? ['#374151', '#374151'] : ['#f0b90b', '#e6a800']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {loading
                ? <ActivityIndicator color="black" />
                : step < 2
                  ? <><Text style={{ color: 'black', fontWeight: '800', fontSize: 16 }}>Tiếp theo →</Text></>
                  : <><Layers size={18} color="black" /><Text style={{ color: 'black', fontWeight: '800', fontSize: 16 }}>Đăng bán ngay</Text></>
              }
            </LinearGradient>
          </Pressable>
        </Animated.View>
        {step > 0 && (
          <Pressable onPress={goBack} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>← Quay lại</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
