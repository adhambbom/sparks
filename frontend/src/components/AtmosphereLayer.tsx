// ============================================================
// ATMOSPHERE LAYER — A code-driven, asset-free overlay that
// makes any tile-based world feel like a "lonely AI-controlled
// ruined city" without adding sprites.
//
// Effects, stacked above world & below HUD:
//   1. VIGNETTE   — radial darkening at viewport edges.
//   2. SCANLINES  — thin dark CRT bars.
//   3. AI SWEEP   — single neon-red line that slides vertically.
//   4. FLICKER    — barely-there breathing tint overlay.
//   5. FOG        — drifting volumetric haze (two layers, opposite
//                   directions) using purely Animated Views.
//   6. PARTICLES  — slow-rising ambient sparks/dust motes that
//                   sell scale and abandonment.
// ============================================================
import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform, Dimensions } from 'react-native';

type Props = {
  width: number;
  height: number;
  /** Subtle = academy/safe zones. Heavy = dungeons/danger zones. */
  intensity?: 'subtle' | 'heavy';
};

const PARTICLE_COUNT = 14;

export function AtmosphereLayer({ width, height, intensity = 'subtle' }: Props) {
  // ── AI surveillance sweep — single vertical line that slowly slides down.
  const sweepY = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = () => {
      sweepY.setValue(-1);
      Animated.timing(sweepY, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
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

  // ── Fog drift (two layers in opposite directions for parallax depth).
  const fogA = useRef(new Animated.Value(0)).current;
  const fogB = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(fogA, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }),
    );
    const b = Animated.loop(
      Animated.timing(fogB, { toValue: 1, duration: 38000, easing: Easing.linear, useNativeDriver: true }),
    );
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [fogA, fogB]);

  // ── Ambient particles — random rising motes.
  // Each particle has its own staggered loop. We keep them lightweight by
  // capping the count and reusing Animated values for native-driver perf.
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      id: i,
      // start position randomised across the viewport
      startX: Math.random() * width,
      // rise duration 8-16s
      duration: 8000 + Math.random() * 8000,
      // staggered start delay so they don't all rise in sync
      delay: Math.random() * 12000,
      // size 1-3 px
      size: 1 + Math.random() * 2,
      // colour pick — mostly dim white-grey, occasional neon spark
      color:
        Math.random() < 0.15 ? 'rgba(255,80,160,0.85)'
        : Math.random() < 0.30 ? 'rgba(120,220,255,0.55)'
        : 'rgba(200,200,220,0.35)',
      // gentle horizontal sway amplitude (px)
      sway: 10 + Math.random() * 20,
      anim: new Animated.Value(0),
    })),
    [width],
  );

  useEffect(() => {
    const loops = particles.map((p) => {
      const cycle = Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);
      const loop = Animated.loop(Animated.sequence([
        cycle,
        // reset (no-op via timing 0)
        Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [particles]);

  const heavy = intensity === 'heavy';
  const scanRows = Array.from({ length: Math.ceil(height / 3) });

  return (
    <View pointerEvents="none" style={[styles.root, { width, height }]}>
      {/* 5. FOG LAYER A — wide dim haze drifting slowly right→left.
          Lives BEHIND the scanlines/sweep but ABOVE the world so it
          softens distant tiles. Two stacked horizontal gradients give
          a credible volumetric feel without bitmap textures. */}
      <Animated.View
        style={[
          styles.fog,
          {
            opacity: heavy ? 0.32 : 0.18,
            transform: [{
              translateX: fogA.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -width * 0.6],
              }),
            }],
          },
        ]}
      >
        <View
          style={{
            width: width * 2,
            height: height,
            backgroundColor: 'transparent',
            // Faux gradient — multiple stacked translucent bands
            justifyContent: 'space-between',
          }}
        >
          {[0.18, 0.08, 0.14, 0.06, 0.18].map((alpha, i) => (
            <View key={i} style={{
              height: height / 5,
              backgroundColor: `rgba(40,18,60,${alpha})`,
            }} />
          ))}
        </View>
      </Animated.View>

      {/* FOG LAYER B — thinner, faster, opposite direction; parallax. */}
      <Animated.View
        style={[
          styles.fog,
          {
            opacity: heavy ? 0.22 : 0.12,
            transform: [{
              translateX: fogB.interpolate({
                inputRange: [0, 1],
                outputRange: [-width * 0.6, 0],
              }),
            }],
          },
        ]}
      >
        <View
          style={{
            width: width * 2,
            height: height,
            justifyContent: 'space-between',
          }}
        >
          {[0.0, 0.10, 0.04, 0.12, 0.0].map((alpha, i) => (
            <View key={i} style={{
              height: height / 5,
              backgroundColor: `rgba(80,40,120,${alpha})`,
            }} />
          ))}
        </View>
      </Animated.View>

      {/* 1. VIGNETTE — inset box-shadow draws a soft dark ring around the edges. */}
      <View
        style={[
          styles.vignette,
          {
            boxShadow: heavy
              ? 'inset 0 0 120px 30px rgba(2,4,12,0.85), inset 0 0 60px 6px rgba(0,0,0,0.55)'
              : 'inset 0 0 90px 18px rgba(2,4,12,0.55), inset 0 0 40px 4px rgba(0,0,0,0.30)',
          } as any,
        ]}
      />

      {/* 2. SCANLINES */}
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

      {/* 6. AMBIENT PARTICLES — slow rising motes / sparks. */}
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: p.startX,
            top: 0,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            // rise from below the viewport up past the top, with a gentle sway
            transform: [
              {
                translateY: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height + 20, -20],
                }),
              },
              {
                translateX: p.anim.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [0, p.sway, 0, -p.sway, 0],
                }),
              },
            ],
            opacity: p.anim.interpolate({
              // fade in, full, fade out
              inputRange: [0, 0.1, 0.85, 1],
              outputRange: [0, 1, 1, 0],
            }),
          }}
        />
      ))}

      {/* 3. AI SWEEP */}
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

      {/* 4. AMBIENT FLICKER */}
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
  fog: {
    position: 'absolute',
    top: 0, left: 0,
    bottom: 0,
    width: '200%',
  },
});
