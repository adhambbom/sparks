import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { PixelText } from './PixelText';

/**
 * Floater — animated combat damage/heal number.
 * Spawns just above the target sprite and floats UP while fading out over ~900ms.
 */
type Props = {
  text: string;
  color: string;
  size?: number;
};

export default function Floater({ text, color, size = 18 }: Props) {
  const dy = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(dy,      { toValue: -38, duration: 900, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
    ]).start();
  }, [dy, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        { transform: [{ translateY: dy }], opacity },
      ]}
    >
      <PixelText size={size} color={color} bold glow>
        {text}
      </PixelText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: -8,         // start just above the target's top edge
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
});
