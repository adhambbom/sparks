/**
 * SpiralStaircase — animated SVG tile representing a downward spiral staircase.
 * The center "swirl" rotates slowly to suggest descent. Pure decoration; the
 * containing tile is interactable through the existing onTileChange handler.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

type Props = {
  /** Tile size in px. */
  tile: number;
  /** Animation tick from the parent. */
  tick: number;
};

export default function SpiralStaircase({ tile, tick }: Props) {
  // Slow rotation — 1 turn every ~6 seconds at 10fps.
  const angle = (tick * 6) % 360;
  return (
    <View
      style={{ width: tile, height: tile, transform: [{ rotate: `${angle}deg` }] }}
      pointerEvents="none"
    >
      <Svg width={tile} height={tile} viewBox="0 0 32 32">
        <Defs>
          <RadialGradient id="pit" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#020208" />
            <Stop offset="60%" stopColor="#0c0d18" />
            <Stop offset="100%" stopColor="#1c2030" />
          </RadialGradient>
        </Defs>
        {/* Outer stone ring */}
        <Circle cx={16} cy={16} r={15} fill="#3a4150" />
        <Circle cx={16} cy={16} r={14} fill="#2a303a" />
        {/* Pit gradient */}
        <Circle cx={16} cy={16} r={12} fill="url(#pit)" />
        {/* Spiral arms — 4 stylised steps fanning around the centre */}
        <Path
          d="M 16 16 L 16 4 A 12 12 0 0 1 27.4 12 Z"
          fill="rgba(120,138,180,0.40)"
        />
        <Path
          d="M 16 16 L 27.4 12 A 12 12 0 0 1 22.6 26.4 Z"
          fill="rgba(120,138,180,0.28)"
        />
        <Path
          d="M 16 16 L 22.6 26.4 A 12 12 0 0 1 7.4 24.4 Z"
          fill="rgba(120,138,180,0.20)"
        />
        <Path
          d="M 16 16 L 7.4 24.4 A 12 12 0 0 1 4.6 8 Z"
          fill="rgba(120,138,180,0.12)"
        />
        {/* Inner darkness — the descent */}
        <Circle cx={16} cy={16} r={3.5} fill="#000" />
      </Svg>
    </View>
  );
}
