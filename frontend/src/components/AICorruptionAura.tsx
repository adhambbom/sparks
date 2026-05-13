// ============================================================
// AI CORRUPTION AURA — Pulsing red glow halo to wrap around any
// enemy/hazard so the player instinctively reads them as
// "AI-corrupted". Pure CSS, no sprites, ~40 lines.
// ============================================================
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

type Props = {
  size: number;
  /** Cool = wandering / passive. Hot = chasing / hostile. */
  state?: 'cool' | 'hot';
};

export default function AICorruptionAura({ size, state = 'cool' }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const speed = state === 'hot' ? 600 : 1200;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, state]);

  const color = state === 'hot' ? '255,42,85' : '255,80,40';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.aura,
        {
          width: size,
          height: size,
          left: 0,
          top: 0,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: state === 'hot' ? [0.35, 0.85] : [0.15, 0.45],
          }),
          // Inset glow ring — gives the sprite a halo without bleeding outside the tile.
          boxShadow: `inset 0 0 ${state === 'hot' ? 14 : 8}px rgba(${color},0.95), 0 0 ${state === 'hot' ? 18 : 10}px rgba(${color},0.55)`,
          borderRadius: size / 2,
        } as any,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  aura: {
    position: 'absolute',
  },
});
