// ============================================================
// VOID BACKDROP — A dark cyberpunk ambient layer that extends
// far beyond the playable map so the camera NEVER reveals a
// black void at the edges.
//
// This is a pure decorative layer. It sits BEHIND the tile grid
// (zIndex 0 in the world content) and is sized large enough to
// fill any plausible camera position. Visually it reads as
// "the ruined city stretches into the corrupted darkness"
// instead of the previous "the world is a small floating box".
//
// Implementation is intentionally simple: a few stacked tiled
// gradients + a few hard-coded "distant light" dots. No images,
// no SVG — keeps it cheap to render.
// ============================================================
import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  /** Total width of the playable map in pixels. */
  mapWidth: number;
  /** Total height of the playable map in pixels. */
  mapHeight: number;
  /** How far beyond the map to extend on each side, in pixels.
   *  20–30 × TILE is a safe value. */
  padding?: number;
};

export default function VoidBackdrop({ mapWidth, mapHeight, padding = 1200 }: Props) {
  const W = mapWidth + padding * 2;
  const H = mapHeight + padding * 2;

  // A handful of "distant infrastructure lights" scattered around the
  // perimeter. Deterministic positions so they don't move between
  // re-renders. Tuned to look like a sprawling ruined megacity.
  const lights = React.useMemo(() => {
    const out: { x: number; y: number; size: number; color: string; alpha: number }[] = [];
    // Bias points to the OUTER ring — we don't want lights on the playable map.
    const seedRng = (s: number) => {
      let x = s;
      return () => {
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
      };
    };
    const rng = seedRng(0xC0DE1);
    const PALETTE = [
      'rgba(120,80,255,0.45)',   // corrupted purple
      'rgba(255,80,160,0.40)',   // magenta
      'rgba(80,200,255,0.40)',   // cyan
      'rgba(255,200,60,0.30)',   // amber
      'rgba(255,255,255,0.18)',  // dim white
    ];
    for (let i = 0; i < 90; i++) {
      // Random position in the FULL extended area
      let x = rng() * W;
      let y = rng() * H;
      // Reject points that fall inside the playable map — those would
      // distract from gameplay. Outer ring only.
      const insidePlayable =
        x > padding - 50 && x < padding + mapWidth + 50 &&
        y > padding - 50 && y < padding + mapHeight + 50;
      if (insidePlayable) continue;
      out.push({
        x, y,
        size: 1 + Math.floor(rng() * 3),
        color: PALETTE[Math.floor(rng() * PALETTE.length)],
        alpha: 0.3 + rng() * 0.7,
      });
    }
    return out;
  }, [W, H, padding, mapWidth, mapHeight]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -padding,
        top: -padding,
        width: W,
        height: H,
        zIndex: -1,
      }}
    >
      {/* 1. Base dark-cyber gradient — outside-the-map ambient floor.
            Three stacked horizontal bands give a subtle "depth" haze:
            slightly purpler at top, neutral middle, slightly cyan at bottom. */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#06060e' }]} />
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: H * 0.4,
        backgroundColor: '#10081c',
        opacity: 0.55,
      }} />
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: H * 0.4,
        backgroundColor: '#02141c',
        opacity: 0.55,
      }} />

      {/* 2. Faint grid lines at large spacing — sells the "infinite ruined
            cybercity" feel without being noisy. */}
      {Array.from({ length: Math.ceil(W / 220) }).map((_, i) => (
        <View key={`v-${i}`} style={{
          position: 'absolute',
          left: i * 220,
          top: 0,
          width: 1,
          height: H,
          backgroundColor: 'rgba(120,140,200,0.06)',
        }} />
      ))}
      {Array.from({ length: Math.ceil(H / 220) }).map((_, i) => (
        <View key={`h-${i}`} style={{
          position: 'absolute',
          top: i * 220,
          left: 0,
          width: W,
          height: 1,
          backgroundColor: 'rgba(120,140,200,0.06)',
        }} />
      ))}

      {/* 3. Distant infrastructure lights — pinpricks of colour in the dark
            so the player feels like they're inside a bigger world. */}
      {lights.map((p, i) => (
        <View
          key={`light-${i}`}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size * 2,
            height: p.size * 2,
            borderRadius: p.size,
            backgroundColor: p.color,
            opacity: p.alpha,
          }}
        />
      ))}

      {/* 4. Soft inner shadow at the EDGE of the playable map — visually
            distinguishes the play area from the void without a hard line. */}
      <View
        style={{
          position: 'absolute',
          left: padding - 40,
          top: padding - 40,
          width: mapWidth + 80,
          height: mapHeight + 80,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          boxShadow: '0 0 90px 30px rgba(0,0,0,0.55)' as any,
        }}
      />
    </View>
  );
}
