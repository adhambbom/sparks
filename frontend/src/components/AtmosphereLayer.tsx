// ============================================================
// ATMOSPHERE LAYER — A code-driven, asset-free overlay that
// makes any tile-based world feel like a "lonely AI-controlled
// ruined city" without adding sprites.
//
// Three subtle effects, all stacked above the world but below
// the HUD/controls. Designed for mobile — uses CSS shadows on
// web, native-compatible Views everywhere else.
//
//   1. VIGNETTE   — radial darkening at viewport edges (focus
//                   the eye on the player).
//   2. SCANLINES  — repeating thin dark horizontal bars; CRT
//                   feel + helps mask square-tile repetition.
//   3. AI SWEEP   — a single thin neon-red line that slides
//                   vertically every ~9 s, like the AI is
//                   scanning the level for the player.
// ============================================================
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';

type Props = {
  width: number;
  height: number;
  /** Subtle = academy/safe zones. Heavy = dungeons/danger zones. */
  intensity?: 'subtle' | 'heavy';
};

export function AtmosphereLayer({ width, height, intensity = 'subtle' }: Props) {
  // ── AI surveillance sweep — single vertical line that slowly slides down.
  const sweepY = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = () => {
      sweepY.setValue(-1);
      Animated.timing(sweepY, {
        toValue: 1,
        duration: 3500,         // slide takes 3.5 s
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        // long pause between sweeps so it feels rare and ominous
        setTimeout(loop, intensity === 'heavy' ? 4500 : 8500);
      });
    };
    const startTimer = setTimeout(loop, 1500);
    return () => clearTimeout(startTimer);
  }, [sweepY, intensity]);

  // ── Ambient flicker (~0.95 → 1.0 opacity blob, very slow).
  const flicker = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker]);

  const heavy = intensity === 'heavy';

  // ── Pre-computed scanline stripe positions (12-row pattern).
  const scanRows = Array.from({ length: Math.ceil(height / 3) });

  return (
    <View pointerEvents="none" style={[styles.root, { width, height }]}>
      {/* 1. VIGNETTE — inset box-shadow draws a soft dark ring around the edges. */}
      <View
        style={[
          styles.vignette,
          {
            // Heavier on dungeon levels, softer on the academy.
            boxShadow: heavy
              ? 'inset 0 0 120px 30px rgba(2,4,12,0.85), inset 0 0 60px 6px rgba(0,0,0,0.55)'
              : 'inset 0 0 90px 18px rgba(2,4,12,0.55), inset 0 0 40px 4px rgba(0,0,0,0.30)',
          } as any,
        ]}
      />

      {/* 2. SCANLINES — 1px dark strips every 3px. Cheap CRT effect. */}
      <View style={styles.scanlines}>
        {scanRows.map((_, i) => (
          <View
            key={i}
            style={{
              height: 1,
              marginTop: 2,
              backgroundColor: heavy ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.10)',
            }}
          />
        ))}
      </View>

      {/* 3. AI SWEEP — single ~5px tall red line that slides down. */}
      <Animated.View
        style={[
          styles.sweep,
          {
            transform: [
              {
                translateY: sweepY.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-20, height + 20],
                }),
              },
            ],
            opacity: heavy ? 0.85 : 0.55,
          },
        ]}
      >
        <View style={styles.sweepInner} />
      </Animated.View>

      {/* 4. AMBIENT FLICKER — barely-there light overlay that breathes. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flicker,
          {
            opacity: flicker.interpolate({
              inputRange: [0, 1],
              outputRange: [0.0, heavy ? 0.07 : 0.04],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  vignette: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  scanlines: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: Platform.OS === 'web' ? 0.55 : 0.40,
  },
  sweep: {
    position: 'absolute',
    left: 0, right: 0,
    height: 5,
  },
  sweepInner: {
    height: 5,
    backgroundColor: '#ff2a55',
    boxShadow: '0 0 14px rgba(255,42,85,0.85), 0 0 24px rgba(255,42,85,0.45)',
  } as any,
  flicker: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1a0014',
  },
});
