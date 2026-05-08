import React from 'react';
import { TouchableOpacity, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS } from '../data/gameData';
import { PixelText } from './PixelText';

type Props = {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  testID?: string;
  style?: ViewStyle;
};

export function PixelButton({ title, onPress, color = COLORS.neonCyan, disabled, size = 'md', full, testID, style }: Props) {
  const padV = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const padH = size === 'sm' ? 12 : size === 'lg' ? 28 : 20;
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
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
      <PixelText size={fontSize} color={disabled ? COLORS.textDim : color} bold style={{ textAlign: 'center' }}>
        {title}
      </PixelText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
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
