import React from 'react';
import { TouchableOpacity, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS } from '../data/gameData';
import { PixelText } from './PixelText';
import { sfx } from '../utils/audio';

type Props = {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  testID?: string;
  style?: ViewStyle;
  silent?: boolean;
};

/**
 * Pixel-art glow button. Used everywhere — combat action grid, menus,
 * inventory. Sizing tuned for mobile readability:
 *   sm  → 3×2 combat action grid (compact, auto-fit text)
 *   md  → menus, dialogs
 *   lg  → primary "BACK / CONTINUE" buttons
 *
 * Polish rules:
 *  • Padding kept tight so 6-char cyber words ("STRIKE", "BREACH") never
 *    bleed into the 6px corner squares.
 *  • Text uses `autoFit` so long labels shrink rather than clip/overlap.
 *  • Inner padding `paddingHorizontal: 4` keeps text clear of corner glyphs.
 */
export function PixelButton({
  title,
  onPress,
  color = COLORS.neonCyan,
  disabled,
  size = 'md',
  full,
  testID,
  style,
  silent,
}: Props) {
  const padV = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const padH = size === 'sm' ? 8 : size === 'lg' ? 28 : 20;
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 18 : 14;

  const handlePress = () => {
    if (!silent) sfx.click();
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
      style={[
        styles.btn,
        {
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderColor: disabled ? COLORS.border : color,
          backgroundColor: disabled ? '#1a1a2e' : 'rgba(10,10,20,0.85)',
          opacity: disabled ? 0.5 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <View style={[styles.corner, styles.tl, { backgroundColor: disabled ? COLORS.border : color }]} />
      <View style={[styles.corner, styles.tr, { backgroundColor: disabled ? COLORS.border : color }]} />
      <View style={[styles.corner, styles.bl, { backgroundColor: disabled ? COLORS.border : color }]} />
      <View style={[styles.corner, styles.br, { backgroundColor: disabled ? COLORS.border : color }]} />
      <View style={styles.textWrap}>
        <PixelText
          size={fontSize}
          color={disabled ? COLORS.textDim : color}
          bold
          autoFit
          style={{ textAlign: 'center' }}
        >
          {title}
        </PixelText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  textWrap: {
    // Keep text inside the corner glyph margins so 6-char words never
    // collide with the L-shaped pixel corners.
    paddingHorizontal: 4,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 6,
    height: 6,
  },
  tl: { top: -1, left: -1 },
  tr: { top: -1, right: -1 },
  bl: { bottom: -1, left: -1 },
  br: { bottom: -1, right: -1 },
});
