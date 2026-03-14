import { View, Text, Pressable, ViewStyle } from 'react-native';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export function EmptyState({ icon, title, subtitle, action, style }: EmptyStateProps) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }, style]}>
      {icon && (
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          {icon}
        </View>
      )}
      <Text style={{ color: 'white', fontWeight: '800', fontSize: 17, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
          {subtitle}
        </Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          style={{
            marginTop: 8, backgroundColor: '#f0b90b', borderRadius: 14,
            paddingHorizontal: 28, paddingVertical: 12,
          }}
        >
          <Text style={{ color: 'black', fontWeight: '800', fontSize: 14 }}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
