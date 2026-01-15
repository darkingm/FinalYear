import { Animated } from 'react-native';

export const fadeIn = (value: Animated.Value, duration: number = 300) => {
  return Animated.timing(value, {
    toValue: 1,
    duration,
    useNativeDriver: true,
  });
};

export const fadeOut = (value: Animated.Value, duration: number = 300) => {
  return Animated.timing(value, {
    toValue: 0,
    duration,
    useNativeDriver: true,
  });
};

export const slideIn = (value: Animated.Value, from: number = -50, duration: number = 300) => {
  return Animated.timing(value, {
    toValue: from,
    duration,
    useNativeDriver: true,
  });
};

export const scaleIn = (value: Animated.Value, duration: number = 300) => {
  return Animated.spring(value, {
    toValue: 1,
    friction: 8,
    tension: 40,
    useNativeDriver: true,
  });
};

export const bounce = (value: Animated.Value) => {
  return Animated.sequence([
    Animated.timing(value, {
      toValue: 1.2,
      duration: 200,
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }),
  ]);
};


