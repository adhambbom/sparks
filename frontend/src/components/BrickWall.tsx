import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * BrickWall — a pure React Native pixel-art brick texture for solid wall tiles.
 *
 * Theme: "Worn & Industrial". Dark, gritty, weathered bricks with mortar lines
 * and subtle moss/rust speckles. NO neon, NO circuitry — the tech is invisible
 * so the glowing AI eyes pop visually.
 *
 * Renders edge-to-edge inside the parent Tile View. The brick layout is
 * staggered (offset on alternate rows) like real brickwork.
 */
type Props = {
  size: number;        // tile size in px
  variant?: number;    // optional 0..3, slightly varies stains for visual diversity
};

// Palette — dark, low-saturation, slightly varied so adjacent tiles don't look identical
const MORTAR = '#0a0810';            // near-black mortar lines
const BRICK_BASE = '#2a2530';        // mid grey-violet base
const BRICK_DARKER = '#1f1a25';      // shadowed brick
const BRICK_LIGHTER = '#332c3a';     // highlighted brick (light from above)
const MOSS = 'rgba(74, 110, 60, 0.35)';   // dim mossy green
const RUST = 'rgba(140, 60, 30, 0.35)';   // dim rust orange
const HIGHLIGHT_TOP = 'rgba(255, 255, 255, 0.06)';  // very subtle top edge highlight

export default function BrickWall({ size, variant = 0 }: Props) {
  // 4 brick rows × 4 columns; rows alternate offset by half-brick width
  const rows = 4;
  const cols = 4;
  const brickH = size / rows;
  const brickW = size / cols;
  const half = brickW / 2;

  // Pseudo-random brick shading using variant + index
  const shade = (r: number, c: number) => {
    const seed = (variant * 13 + r * 7 + c * 5) % 7;
    if (seed === 0 || seed === 5) return BRICK_DARKER;
    if (seed === 3) return BRICK_LIGHTER;
    return BRICK_BASE;
  };

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      {/* Mortar layer (background — every gap shows through) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: MORTAR }]} />

      {/* Brick rows */}
      {Array.from({ length: rows }).map((_, r) => {
        const isOffset = r % 2 === 1;
        return (
          <View
            key={`row-${r}`}
            style={{
              position: 'absolute',
              left: 0,
              top: r * brickH,
              right: 0,
              height: brickH,
              flexDirection: 'row',
            }}
          >
            {/* On odd rows, half-brick at left edge */}
            {isOffset && (
              <View
                style={{
                  width: half - 1,
                  height: brickH - 1,
                  marginLeft: 0,
                  marginTop: 1,
                  backgroundColor: shade(r, -1),
                }}
              />
            )}
            {Array.from({ length: cols - (isOffset ? 1 : 0) }).map((_, c) => (
              <View
                key={`brick-${r}-${c}`}
                style={{
                  width: brickW - 1,
                  height: brickH - 1,
                  marginLeft: 1,
                  marginTop: 1,
                  backgroundColor: shade(r, c),
                }}
              />
            ))}
            {/* On odd rows, half-brick at right edge */}
            {isOffset && (
              <View
                style={{
                  width: half - 1,
                  height: brickH - 1,
                  marginLeft: 1,
                  marginTop: 1,
                  backgroundColor: shade(r, cols),
                }}
              />
            )}
          </View>
        );
      })}

      {/* Subtle top highlight on each brick row (light from above) */}
      {Array.from({ length: rows }).map((_, r) => (
        <View
          key={`hl-${r}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: r * brickH + 1,
            height: 1,
            backgroundColor: HIGHLIGHT_TOP,
          }}
        />
      ))}

      {/* Stains: 1 moss + 1 rust speckle per tile, position based on variant */}
      <View
        style={{
          position: 'absolute',
          left: ((variant * 11) % size),
          top: ((variant * 17 + 8) % (size - 4)),
          width: 4,
          height: 3,
          backgroundColor: MOSS,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: ((variant * 19 + 12) % (size - 3)),
          top: ((variant * 23 + 4) % (size - 3)),
          width: 3,
          height: 2,
          backgroundColor: RUST,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    position: 'relative',
  },
});
