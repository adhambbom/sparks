import React, { useState } from 'react';
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';

export default function CharacterCreateScreen() {
  const { createCharacter } = useGame();
  const [name, setName] = useState('Spark');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      await createCharacter(name.trim() || 'Spark');
      router.replace('/game');
    } catch (e: any) {
      setError(e.message || 'Failed to create character');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PixelText size={10} color={COLORS.neonGreen}>{'> AWAKENING_PROTOCOL_'}</PixelText>
          <PixelText size={28} color={COLORS.neonCyan} glow bold style={{ marginTop: 6 }}>THE SPARK</PixelText>
          <View style={styles.divider} />

          <View style={styles.lore}>
            <PixelText size={12} color={COLORS.text} style={{ lineHeight: 22 }}>
              You wake in the Nexus Institute. Your power is{' '}
              <PixelText size={12} color={COLORS.neonMagenta} bold>UNCLASSIFIED.</PixelText>
              {'\n\n'}Outside, the Glitch swarms the Old World.{'\n'}
              Inside, you choose what you become.
            </PixelText>
          </View>

          <View style={styles.field}>
            <PixelText size={10} color={COLORS.textDim}>YOUR NAME, CADET</PixelText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={20}
              placeholder="Spark"
              placeholderTextColor={COLORS.textDim}
              testID="char-name"
            />
          </View>

          <View style={styles.statBox}>
            <PixelText size={11} color={COLORS.neonYellow} bold>STARTING STATS</PixelText>
            <PixelText size={11} color={COLORS.text} style={{ marginTop: 6 }}>HP 80   MP 30</PixelText>
            <PixelText size={11} color={COLORS.text}>ATK 12  DEF 8  SPD 10</PixelText>
            <PixelText size={11} color={COLORS.neonGreen} style={{ marginTop: 4 }}>SYNC LV 1</PixelText>
          </View>

          {error ? <PixelText size={11} color={COLORS.neonRed} style={{ marginTop: 8 }}>! {error}</PixelText> : null}

          <View style={{ marginTop: 30, gap: 12 }}>
            <PixelButton title={loading ? 'IGNITING…' : 'IGNITE THE SPARK'} onPress={start} disabled={loading || !name.trim()} color={COLORS.neonCyan} size="lg" full testID="char-create-submit" />
            <PixelButton title="BACK" onPress={() => router.back()} color={COLORS.textDim} full />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  divider: { width: 80, height: 2, backgroundColor: COLORS.neonCyan, marginVertical: 14, opacity: 0.6 },
  lore: {
    backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginVertical: 14,
  },
  field: { marginVertical: 14 },
  input: {
    marginTop: 6,
    backgroundColor: COLORS.panel,
    borderWidth: 2, borderColor: COLORS.neonCyan,
    color: COLORS.neonCyan, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 22, letterSpacing: 2, textAlign: 'center',
  },
  statBox: {
    backgroundColor: COLORS.panelLight,
    borderWidth: 1, borderColor: COLORS.borderHi,
    padding: 14,
  },
});
