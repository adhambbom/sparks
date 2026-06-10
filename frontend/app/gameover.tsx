import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';

export default function GameOverScreen() {
  const { state, restoreCheckpoint } = useGame();
  const [pulse, setPulse] = useState(0);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    sfx.defeat();
    const t = setInterval(() => setPulse((p) => (p + 1) % 100), 100);
    return () => clearInterval(t);
  }, []);

  const tryAgain = async () => {
    setRestoring(true);
    const s = await restoreCheckpoint();
    if (s) {
      router.replace('/game');
    } else {
      // No checkpoint — back to character creation
      router.replace('/character-create');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.glitchBg} />
      <View style={styles.center}>
        <PixelText size={10} color={COLORS.neonRed} style={{ marginBottom: 10, opacity: pulse > 50 ? 1 : 0.3 }}>
          {'// SIGNAL_LOST //'}
        </PixelText>
        <PixelText size={48} color={COLORS.neonRed} glow bold style={styles.title}>GAME</PixelText>
        <PixelText size={48} color={COLORS.neonRed} glow bold style={styles.title}>OVER</PixelText>

        <View style={styles.divider} />

        <PixelText size={12} color={COLORS.text} style={{ textAlign: 'center', marginVertical: 14, lineHeight: 22 }}>
          The Glitch claimed you, Spark.{'\n'}
          But your last checkpoint remains.
        </PixelText>

        {state && (
          <View style={styles.lastSave}>
            <PixelText size={9} color={COLORS.textDim}>LAST CHECKPOINT</PixelText>
            <PixelText size={11} color={COLORS.neonCyan}>
              {state.player.name.toUpperCase()} · LV {state.player.level}
            </PixelText>
          </View>
        )}

        <View style={styles.actions}>
          <PixelButton
            title={restoring ? 'RESTORING…' : '↻ TRY AGAIN'}
            onPress={tryAgain}
            disabled={restoring}
            color={COLORS.neonGreen}
            size="lg"
            full
            testID="gameover-retry"
          />
          <View style={{ height: 10 }} />
          <PixelButton
            title="QUIT TO TITLE"
            onPress={() => router.replace('/')}
            color={COLORS.textDim}
            full
            testID="gameover-quit"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0a0e' },
  glitchBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1a0a0e',
  },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  title: { letterSpacing: 6, lineHeight: 50 },
  divider: { width: 200, height: 2, backgroundColor: COLORS.neonRed, marginTop: 20, opacity: 0.6 },
  lastSave: {
    backgroundColor: 'rgba(10,10,20,0.8)',
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginVertical: 20,
    alignItems: 'center', minWidth: 240,
  },
  actions: { width: '100%', maxWidth: 320, marginTop: 10 },
});
