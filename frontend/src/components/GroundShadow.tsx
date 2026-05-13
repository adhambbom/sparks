// ============================================================
// GROUND SHADOW — A small soft ellipse that sits directly under
// any sprite to "ground" it on the floor plane. Code-only, no
// assets, ~5 pixels tall. Drop one of these as the first child
// of any sprite View and the world stops feeling like floating
// chess pieces.
// ============================================================
import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  /** Width of the parent tile / sprite in CSS px. */
  size: number;
  /** Vertical offset from the sprite's centre to the ground plane. */
  offsetY?: number;
  /** Visual weight — 'soft' for NPCs, 'hard' for enemies / heavy props. */
  variant?: 'soft' | 'hard';
};

export default function GroundShadow({ size, offsetY = 0, variant = 'soft' }: Props) {
  const w = size * (variant === 'hard' ? 0.62 : 0.56);
  const h = w * 0.30;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          width: w,
          height: h,
          left: (size - w) / 2,
          top: offsetY,
          opacity: variant === 'hard' ? 0.55 : 0.40,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    backgroundColor: '#000',
    borderRadius: 999,
    // Cheap blur on web; native React Native ignores boxShadow blur on a flat
    // shape but this still looks fine because the ellipse has rounded edges.
    boxShadow: '0 0 6px rgba(0,0,0,0.5)',
  } as any,
});
