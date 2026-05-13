import React from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';
import { COLORS } from '../data/gameData';

type Props = TextProps & {
  size?: number;
  color?: string;
  glow?: boolean;
  bold?: boolean;
  /** When true, single-line + shrink-to-fit width. Default false. */
  autoFit?: boolean;
};

/**
 * PressStart2P pixel text. Single-source-of-truth typography for the game.
 *
 * Polish rules applied:
 *  • letterSpacing=0 (was 1 before — caused crowded layouts on small phones)
 *  • Optional `autoFit` to shrink long names (enemy/entity/player) into
 *    their container without clipping.
 *  • textShadow still doubles as drop-shadow for readability over busy
 *    cyberpunk backgrounds.
 */
export function PixelText({
  size = 14,
  color = COLORS.text,
  glow,
  bold,
  autoFit,
  style,
  children,
  numberOfLines,
  ...rest
}: Props) {
  const fitProps = autoFit
    ? {
        numberOfLines: 1 as const,
        adjustsFontSizeToFit: true,
        minimumFontScale: 0.7,
        ellipsizeMode: 'tail' as const,
      }
    : { numberOfLines };

  return (
    <Text
      {...rest}
      {...fitProps}
      style={[
        styles.base,
        {
          fontSize: size,
          color,
          fontWeight: bold ? '900' : '700',
          textShadowColor: glow ? color : 'rgba(0,0,0,0.8)',
          textShadowRadius: glow ? 8 : 0,
          textShadowOffset: { width: glow ? 0 : 1, height: glow ? 0 : 1 },
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
