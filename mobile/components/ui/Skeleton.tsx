import { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, StyleSheet } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View
      style={[
        { backgroundColor: '#1e2130', borderRadius, height, opacity },
        typeof width === 'number' ? { width } : { width: width as any },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton layouts for common screens */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.card}>
      <Skeleton height={160} borderRadius={12} />
      <View style={{ gap: 8, marginTop: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} height={14} width={i === 0 ? '70%' : '45%'} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { flexDirection: 'row', gap: 12, padding: 14 }]}>
          <Skeleton width={56} height={56} borderRadius={14} />
          <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={11} width="40%" />
            <Skeleton height={20} width="30%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131722', borderRadius: 20,
    padding: 12, borderWidth: 1, borderColor: '#1e2130',
  },
});
