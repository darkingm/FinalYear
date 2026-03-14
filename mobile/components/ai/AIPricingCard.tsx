/**
 * AI Pricing Suggestion Card — reusable component for product creation
 * and seller dashboard. Shows dynamic price range + trend + reasoning.
 */
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { TrendingUp, TrendingDown, Minus, Sparkles, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useDynamicPricing } from '../../lib/hooks/useAI';
import { formatPrice } from '../../lib/utils/format';

interface AIPricingCardProps {
  category: string;
  productName: string;
  condition?: 'new' | 'used' | 'refurbished';
  onApply?: (price: number) => void;
}

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
} as const;

const TREND_COLOR = {
  up: '#10b981',
  down: '#ef4444',
  stable: '#f0b90b',
} as const;

const TREND_LABEL = {
  up: 'Thị trường đang tăng 📈',
  down: 'Thị trường đang giảm 📉',
  stable: 'Thị trường ổn định ➡️',
} as const;

export function AIPricingCard({ category, productName, condition = 'new', onApply }: AIPricingCardProps) {
  const { suggestion, loading, error, suggest } = useDynamicPricing();
  const [expanded, setExpanded] = useState(false);

  const handleSuggest = () => {
    if (!category || !productName.trim()) return;
    suggest({ category, name: productName, condition });
  };

  const TrendIcon = suggestion ? TREND_ICON[suggestion.market_trend] : null;
  const trendColor = suggestion ? TREND_COLOR[suggestion.market_trend] : '#6b7280';

  return (
    <View style={{
      backgroundColor: '#131722', borderRadius: 16, borderWidth: 1,
      borderColor: suggestion ? '#f0b90b30' : '#1e2130', overflow: 'hidden',
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(240,185,11,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color="#f0b90b" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Gợi ý giá AI</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }}>Phân tích thị trường realtime</Text>
        </View>
        {!suggestion && (
          <Pressable
            onPress={handleSuggest}
            disabled={loading || !category || !productName.trim()}
            style={{
              backgroundColor: (!category || !productName.trim()) ? '#1e2130' : '#f0b90b',
              borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            {loading
              ? <ActivityIndicator size="small" color="black" />
              : <Text style={{ color: (!category || !productName.trim()) ? '#4b5563' : 'black', fontWeight: '800', fontSize: 12 }}>Phân tích</Text>
            }
          </Pressable>
        )}
      </View>

      {/* Error */}
      {error && !loading && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Text style={{ color: '#ef4444', fontSize: 11 }}>⚠️ {error}</Text>
        </View>
      )}

      {/* Result */}
      {suggestion && (
        <View style={{ borderTopWidth: 1, borderTopColor: '#1e2130' }}>
          {/* Price range bar */}
          <View style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {TrendIcon && <TrendIcon size={14} color={trendColor} />}
              <Text style={{ color: trendColor, fontSize: 12, fontWeight: '600' }}>
                {TREND_LABEL[suggestion.market_trend]}
              </Text>
            </View>

            {/* Suggested price */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ color: '#f0b90b', fontWeight: '900', fontSize: 28 }}>
                {formatPrice(suggestion.suggested_price_usd)}
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>đề xuất</Text>
            </View>

            {/* Range */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: '#1e2130', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontSize: 10, marginBottom: 2 }}>Thấp nhất</Text>
                <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 13 }}>{formatPrice(suggestion.min_price_usd)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#1e2130', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontSize: 10, marginBottom: 2 }}>Cao nhất</Text>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>{formatPrice(suggestion.max_price_usd)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#1e2130', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontSize: 10, marginBottom: 2 }}>Độ tin cậy</Text>
                <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 13 }}>{Math.round(suggestion.confidence * 100)}%</Text>
              </View>
            </View>

            {/* Expand/collapse reasoning */}
            <Pressable
              onPress={() => setExpanded(e => !e)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
            >
              <Text style={{ color: '#6b7280', fontSize: 11, flex: 1 }}>Xem phân tích chi tiết</Text>
              {expanded ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
            </Pressable>

            {expanded && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: '#9ca3af', fontSize: 12, lineHeight: 18 }}>{suggestion.reasoning}</Text>
                {suggestion.comparable_products.length > 0 && (
                  <View>
                    <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 }}>SẢN PHẨM TƯƠNG TỰ</Text>
                    {suggestion.comparable_products.slice(0, 3).map((p, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 11, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                        <Text style={{ color: '#f0b90b', fontSize: 11, fontWeight: '600' }}>{formatPrice(p.price_usd)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Apply button */}
            {onApply && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Pressable
                  onPress={() => onApply(suggestion.suggested_price_usd)}
                  style={{ flex: 1, backgroundColor: '#f0b90b', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: 'black', fontWeight: '800', fontSize: 13 }}>Dùng giá đề xuất</Text>
                </Pressable>
                <Pressable
                  onPress={() => suggest({ category, name: productName, condition })}
                  style={{ backgroundColor: '#1e2130', borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#9ca3af', fontSize: 11 }}>↻ Làm mới</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
