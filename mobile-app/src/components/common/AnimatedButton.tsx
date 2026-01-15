import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Button from './Button';
import { ButtonProps } from './Button';

const AnimatedButton: React.FC<ButtonProps> = (props) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={props.disabled || props.loading}
      >
        <Button {...props} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default AnimatedButton;


