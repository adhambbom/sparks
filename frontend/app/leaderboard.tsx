import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { api } from '../src/utils/api';

type Entry = { name: string; score: number; wave: number };

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/game/leaderboard');
        setEntries(data.leaderboard || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.textDim}>{'> NEXUS_HALL_OF_FAME_'}</PixelText>
        <PixelText size={22} color={COLORS.neonYellow} glow bold>LEADERBOARD</PixelText>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.neonCyan} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {entries.length === 0 ? (
            <PixelText size={11} color={COLORS.textDim} style={{ textAlign: 'center', marginTop: 30 }}>
              No scores yet. Be the first.
            </PixelText>
          ) : (
            entries.map((e, i) => (
              <View key={i} style={[styles.row, i < 3 && { borderColor: [COLORS.neonYellow, COLORS.neonCyan, COLORS.neonMagenta][i] }]}>
                <PixelText size={14} color={i === 0 ? COLORS.neonYellow : COLORS.text} bold style={{ width: 40 }}>
                  #{i + 1}
                </PixelText>
                <PixelText size={12} color={COLORS.text} bold style={{ flex: 1 }}>
                  {e.name?.toUpperCase() || 'CADET'}
                </PixelText>
                <View style={{ alignItems: 'flex-end' }}>
                  <PixelText size={12} color={COLORS.neonGreen} bold>{e.score}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>WAVE {e.wave}</PixelText>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
      <View style={styles.footer}>
        <PixelButton title="◀ BACK" onPress={() => router.back()} color={COLORS.neonCyan} full size="lg" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderHi },
  scroll: { padding: 16, gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
});
