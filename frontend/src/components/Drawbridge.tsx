/**
 * Drawbridge — animated panel that lowers when the player approaches the
 * throne entrance and raises back up when they walk away. Pure visual flair;
 * the underlying tile is always walkable.
 *
 * Driven by the parent's `proximity` value (0 = far/raised, 1 = on-tile/flat).
 * We map that to a 0°→90° rotation around the **bottom edge** so the panel
 * pivots down like a real medieval drawbridge.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, Line } from 'react-native-svg';

type Props = {
  /** Tile size in px (matches game's TILE constant). */
  tile: number;
  /** 0 = fully raised (vertical), 1 = fully lowered (flat). */
  proximity: number;
};

export default function Drawbridge({ tile, proximity }: Props) {
  // Clamp + ease so the bridge doesn't snap-pop.
  const t = Math.max(0, Math.min(1, proximity));
  const eased = t * t * (3 - 2 * t); // smoothstep
  // 90° = fully raised (panel sticking up out of the floor),
  //  0° = fully lowered (panel flat on the floor).
  const angleDeg = 90 * (1 - eased);
  const W = tile;
  const H = tile;
  return (
    <View
      style={{
        width: W,
        height: H,
        // Pivot around the bottom edge (transform-origin in % terms).
        // RN Web supports transformOrigin natively; on native it is ignored
        // but the visual still reads correctly thanks to the small angle range.
        transform: [{ perspective: 600 }, { rotateX: `${angleDeg}deg` }],
        // @ts-ignore — RN Web–only style
        transformOrigin: '50% 100%',
      }}
      pointerEvents="none"
    >
      <Svg width={W} height={H} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="plank" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7a5436" />
            <Stop offset="0.5" stopColor="#5e3f29" />
            <Stop offset="1" stopColor="#3e2818" />
          </LinearGradient>
        </Defs>
        {/* Outer dark wood frame */}
        <Rect x={0} y={0} width={32} height={32} fill="#1c1208" />
        {/* Plank surface */}
        <Rect x={2} y={2} width={28} height={28} fill="url(#plank)" />
        {/* 4 horizontal plank seams */}
        <Line x1={2}  y1={9}  x2={30} y2={9}  stroke="#2c1c0e" strokeWidth={0.7} />
        <Line x1={2}  y1={16} x2={30} y2={16} stroke="#2c1c0e" strokeWidth={0.7} />
        <Line x1={2}  y1={23} x2={30} y2={23} stroke="#2c1c0e" strokeWidth={0.7} />
        {/* Iron rivets on corners */}
        <Rect x={3}  y={3}  width={3} height={3} fill="#2a2a30" />
        <Rect x={26} y={3}  width={3} height={3} fill="#2a2a30" />
        <Rect x={3}  y={26} width={3} height={3} fill="#2a2a30" />
        <Rect x={26} y={26} width={3} height={3} fill="#2a2a30" />
        {/* Iron centre band (decorative cross-strap) */}
        <Rect x={14} y={2} width={4} height={28} fill="#3a3a44" />
      </Svg>
    </View>
  );
}
