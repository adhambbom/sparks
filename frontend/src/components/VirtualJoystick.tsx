import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';
import { COLORS } from '../data/gameData';

const SIZE = 120;
const KNOB = 50;
const RADIUS = (SIZE - KNOB) / 2;

type Props = {
  onMove: (dx: number, dy: number) => void; // normalized -1..1
  onEnd: () => void;
};

export function VirtualJoystick({ onMove, onEnd }: Props) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const startRef = useRef({ x: 0, y: 0 });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = { x: 0, y: 0 };
      },
      onPanResponderMove: (_e: GestureResponderEvent, g) => {
        const dx = Math.max(-RADIUS, Math.min(RADIUS, g.dx));
        const dy = Math.max(-RADIUS, Math.min(RADIUS, g.dy));
        const dist = Math.hypot(dx, dy);
        let nx = dx, ny = dy;
        if (dist > RADIUS) {
          nx = (dx / dist) * RADIUS;
          ny = (dy / dist) * RADIUS;
        }
        setKnob({ x: nx, y: ny });
        onMove(nx / RADIUS, ny / RADIUS);
      },
      onPanResponderRelease: () => {
        setKnob({ x: 0, y: 0 });
        onEnd();
      },
      onPanResponderTerminate: () => {
        setKnob({ x: 0, y: 0 });
        onEnd();
      },
    }),
  ).current;

  return (
    <View style={styles.base} {...responder.panHandlers} testID="virtual-joystick">
      <View style={styles.ring} />
      <View
        style={[
          styles.knob,
          { transform: [{ translateX: knob.x }, { translateY: knob.y }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.borderHi,
    backgroundColor: 'rgba(20,20,40,0.5)',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: COLORS.neonCyan,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: COLORS.neonCyan,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
});
