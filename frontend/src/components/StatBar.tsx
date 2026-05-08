import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../data/gameData';
import { PixelText } from './PixelText';

type Props = {
  label?: string;
  value: number;
  max: number;
  color: string;
  bgColor?: string;
  width?: number;
  height?: number;
  showText?: boolean;
};

export function StatBar({ label, value, max, color, bgColor = '#000', width = 140, height = 12, showText = true }: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={{ width }}>
      {label && (
        <PixelText size={10} color={color} bold style={{ marginBottom: 2 }}>
          {label}
        </PixelText>
      )}
      <View style={[styles.outer, { width, height, backgroundColor: bgColor, borderColor: color }]}>
        <View style={{ width: width * pct - 4, height: height - 4, backgroundColor: color, borderRadius: 1 }} />
      </View>
      {showText && (
        <PixelText size={9} color={COLORS.text} style={{ marginTop: 2, textAlign: 'right' }}>
          {Math.round(value)}/{max}
        </PixelText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1,
    padding: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
});
