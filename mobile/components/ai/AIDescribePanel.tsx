/**
 * AIDescribePanel — image-to-description panel for product creation.
 *
 * Seller picks an image → AI returns name suggestion, description, tags.
 * User can apply any field with one tap.
 */
import { View, Text, Pressable, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Sparkles, Camera, CheckCircle, X, RefreshCw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAIDescription } from '../../lib/hooks/useAI';

interface AIDescribePanelProps {
  /** Called when user applies AI-suggested values */
  onApply: (values: { name?: string; description?: string; category?: string }) => void;
  currentCategory?: string;
}

const TAG_COLORS = ['#f0b90b', '#10b981', '#3b82f6', '#8b5cf6', '#f97316'];

export function AIDescribePanel({ onApply, currentCategory }: AIDescribePanelProps) {
  const { result, generating, error, generate, reset } = useAIDescription();

  const pickAndGenerate = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled) {
      generate(res.assets[0].uri, { category: currentCategory });
    }
  };

  return (
    <View style={{
      backgroundColor: '#131722', borderRadius: 16, borderWidth: 1,
      borderColor: result ? '#f0b90b30' : '#1e2130', overflow: 'hidden',
    }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color="#a78bfa" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Mô tả bằng AI</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }}>Upload ảnh → AI tự viết tên & mô tả</Text>
        </View>
        {result && (
          <Pressable onPress={reset} style={{ padding: 6 }}>
            <X size={16} color="#6b7280" />
          </Pressable>
        )}
      </View>

      {/* Trigger */}
      {!result && !generating && (
        <Pressable
          onPress={pickAndGenerate}
          style={{
            marginHorizontal: 14, marginBottom: 14,
            borderRadius: 12, borderWidth: 2, borderColor: '#1e2130', borderStyle: 'dashed',
            paddingVertical: 20, alignItems: 'center', gap: 8,
          }}
        >
          <Camera size={28} color="#a78bfa" />
          <Text style={{ color: '#9ca3af', fontSize: 13, fontWeight: '600' }}>Chọn ảnh để AI phân tích</Text>
          <Text style={{ color: '#4b5563', fontSize: 11 }}>Hỗ trợ JPG, PNG · AI tự tạo tên, mô tả, tags</Text>
        </Pressable>
      )}

      {/* Generating */}
      {generating && (
        <View style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={{ color: '#9ca3af', fontSize: 13 }}>AI đang phân tích hình ảnh...</Text>
          <Text style={{ color: '#4b5563', fontSize: 11 }}>Thường mất 3–8 giây</Text>
        </View>
      )}

      {/* Error */}
      {error && !generating && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
          <Text style={{ color: '#ef4444', fontSize: 12 }}>⚠️ {error}</Text>
          <Pressable onPress={pickAndGenerate} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <RefreshCw size={13} color="#6b7280" />
            <Text style={{ color: '#6b7280', fontSize: 12 }}>Thử lại</Text>
          </Pressable>
        </View>
      )}

      {/* Result */}
      {result && !generating && (
        <View style={{ borderTopWidth: 1, borderTopColor: '#1e2130' }}>
          {/* Confidence */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, gap: 6 }}>
            <CheckCircle size={14} color="#10b981" />
            <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>
              Độ tin cậy: {Math.round(result.confidence * 100)}%
            </Text>
          </View>

          <View style={{ padding: 14, gap: 12 }}>
            {/* Suggested name */}
            <View style={{ backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12 }}>
              <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 }}>TÊN GỢI Ý</Text>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, lineHeight: 22, marginBottom: 8 }}>
                {result.name_suggestion}
              </Text>
              <Pressable
                onPress={() => onApply({ name: result.name_suggestion })}
                style={{ alignSelf: 'flex-start', backgroundColor: '#f0b90b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: 'black', fontWeight: '800', fontSize: 11 }}>Dùng tên này</Text>
              </Pressable>
            </View>

            {/* Suggested description */}
            <View style={{ backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12 }}>
              <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 }}>MÔ TẢ GỢI Ý</Text>
              <Text style={{ color: '#d1d5db', fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                {result.description}
              </Text>
              <Pressable
                onPress={() => onApply({ description: result.description })}
                style={{ alignSelf: 'flex-start', backgroundColor: '#f0b90b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: 'black', fontWeight: '800', fontSize: 11 }}>Dùng mô tả này</Text>
              </Pressable>
            </View>

            {/* Tags */}
            {result.tags.length > 0 && (
              <View>
                <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>TAGS ({result.tags.length})</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {result.tags.map((tag, i) => (
                    <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: `${TAG_COLORS[i % TAG_COLORS.length]}18`, borderWidth: 1, borderColor: `${TAG_COLORS[i % TAG_COLORS.length]}40` }}>
                      <Text style={{ color: TAG_COLORS[i % TAG_COLORS.length], fontSize: 11, fontWeight: '600' }}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Apply all */}
            <Pressable
              onPress={() => onApply({ name: result.name_suggestion, description: result.description, category: result.suggested_category })}
              style={{ backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)', paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#a78bfa', fontWeight: '800', fontSize: 14 }}>✨ Áp dụng tất cả</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
