import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { HOUSES_SHEET_URL } from '../data/gameData';

// The houses sheet has 4 columns. Each column shows:
//   - Top banner (~10%)
//   - Big character art (~65%)
//   - Sprite variants strip (~17%)
//   - Trait label (~8%)
// We display the BIG character portion of one column.

const COLS = 4;
const TOP_FRACTION = 0.11; // ratio of cell height that is banner (skip)
const CHAR_FRACTION = 0.66; // ratio of cell height that is the big art

type Props = {
  index: number; // 0..3
  width?: number;
  height?: number; // height of art region we display
  glow?: boolean;
};

export function HouseCharacter({ index, width = 140, height = 220, glow }: Props) {
  // Source aspect: each cell is roughly square-ish, but the full sheet is wider than tall (~1:1 or 4:3)
  // Without exact dimensions we use a stable ratio: each cell ~ width:cell_h = 1:1.3
  const cellHeightForArt = height / CHAR_FRACTION; // ~ full cell height in display units
  const sheetW = width * COLS;
  const sheetH = cellHeightForArt; // displaying just one row of cells

  // Crop offsets:
  const offsetX = -index * width;
  const offsetY = -cellHeightForArt * TOP_FRACTION;

  return (
    <View style={[styles.box, { width, height }, glow && styles.glow]}>
      <Image
        source={{ uri: HOUSES_SHEET_URL }}
        style={{
          width: sheetW,
          height: sheetH,
          left: offsetX,
          top: offsetY,
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
    shadowColor: '#fff',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});
