import React from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';
import { COLORS } from '../data/gameData';

type Props = TextProps & {
  size?: number;
  color?: string;
  glow?: boolean;
  bold?: boolean;
};

export function PixelText({ size = 14, color = COLORS.text, glow, bold, style, children, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        {
          fontSize: size,
          color,
          fontWeight: bold ? '900' : '700',
          textShadowColor: glow ? color : 'rgba(0,0,0,0.8)',
          textShadowRadius: glow ? 8 : 0,
          textShadowOffset: { width: glow ? 0 : 1, height: glow ? 0 : 1 },
          letterSpacing: 1,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'PressStart2P_400Regular',
    letterSpacing: 0,
  },
});
