import { View, Text, Pressable } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  message = 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  if (compact) return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
      <AlertCircle size={16} color="#ef4444" />
      <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry}>
          <RefreshCw size={14} color="#ef4444" />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={36} color="#ef4444" />
      </View>
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
        Không thể tải dữ liệu
      </Text>
      <Text style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
        {message}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#131722', borderRadius: 14, borderWidth: 1,
            borderColor: '#1e2130', paddingHorizontal: 24, paddingVertical: 12,
          }}
        >
          <RefreshCw size={16} color="#f0b90b" />
          <Text style={{ color: '#f0b90b', fontWeight: '700' }}>Thử lại</Text>
        </Pressable>
      )}
    </View>
  );
}
