import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { SPRITE_SHEET_URL } from '../data/gameData';

// Sprite sheet is a 5x5 grid (25 sprites). Each cell has a label below the sprite.
// We crop only the upper sprite portion of each cell.
const COLS = 5;
const ROWS = 5;
// Cell aspect: sprite occupies the upper ~78% of the cell (rest is label)
const SPRITE_FRACTION = 0.78;

type Props = {
  index: number; // 0-24
  size?: number;
  glow?: boolean;
};

export function Sprite({ index, size = 96, glow }: Props) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);

  // Each row is taller than wide because of label area
  const cellHSrc = size / SPRITE_FRACTION; // logical height of full cell at our scale
  const sheetW = size * COLS;
  const sheetH = cellHSrc * ROWS;

  return (
    <View style={[styles.box, { width: size, height: size }, glow && styles.glow]}>
      <Image
        source={{ uri: SPRITE_SHEET_URL }}
        style={{
          width: sheetW,
          height: sheetH,
          left: -col * size,
          top: -row * cellHSrc,
          position: 'absolute',
        }}
        resizeMode="stretch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  glow: {
    shadowColor: '#00f0ff',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
