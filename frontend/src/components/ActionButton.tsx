import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { COLORS } from '../data/gameData';
import { PixelText } from './PixelText';

type Props = {
  label: string;
  color?: string;
  onPress: () => void;
  position: 'A' | 'B';
  testID?: string;
};

export function ActionButton({ label, color = COLORS.neonMagenta, onPress, position, testID }: Props) {
  const offset = position === 'A' ? 100 : 24;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      testID={testID}
      style={[
        styles.btn,
        { right: offset, borderColor: color, shadowColor: color },
      ]}
    >
      <View style={[styles.inner, { backgroundColor: color }]} />
      <PixelText size={20} color="#fff" glow style={{ position: 'absolute' }}>
        {label}
      </PixelText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    bottom: 60,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    backgroundColor: 'rgba(10,10,20,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  inner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.35,
  },
});
