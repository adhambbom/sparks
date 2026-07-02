import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENCOUNTER_POOLS, ENEMIES } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { StatBar } from '../src/components/StatBar';
import { useGame } from '../src/contexts/GameContext';
import { api } from '../src/utils/api';

function poolForWave(wave: number): string[] {
  if (wave <= 3) return ENCOUNTER_POOLS.arena_t1;
  if (wave <= 6) return ENCOUNTER_POOLS.arena_t2;
  if (wave <= 9) return ENCOUNTER_POOLS.arena_t3;
  if (wave <= 12) return ENCOUNTER_POOLS.arena_t4;
  return ENCOUNTER_POOLS.arena_boss;
}

export default function ArenaScreen() {
  const params = useLocalSearchParams<{ wave?: string; result?: string }>();
  const { state, applyHeal, applyMpCost, saveToServer, saveCheckpoint, setState } = useGame();
  const [wave, setWave] = useState<number>(parseInt(params.wave || '1') || 1);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'lobby' | 'incoming' | 'done'>('lobby');

  useEffect(() => {
    if (params.result === 'win' && state) {
      // returned victorious from combat — proceed to next wave
      const newScore = score + 100 * wave;
      setScore(newScore);
      const next = wave + 1;
      // Heal 30% between waves
      const heal = Math.floor(state.player.maxHp * 0.3);
      applyHeal(heal);
      const mpRefund = Math.min(15, state.player.maxMp - state.player.mp);
      if (mpRefund > 0) applyMpCost(-mpRefund);
      // Update best wave
      if (state.world.arenaBestWave < wave) {
        const ns = { ...state, world: { ...state.world, arenaBestWave: wave } };
        setState(ns);
      }
      saveCheckpoint();
      setWave(next);
      setPhase('lobby');
      // submit cumulative score
      api.post('/game/arena-score', { waves_completed: wave, score: newScore }).catch(() => {});
    }
  }, []);

  const startWave = () => {
    setPhase('incoming');
    const pool = poolForWave(wave);
    const enemyId = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => {
      router.replace({ pathname: '/combat', params: { enemyId, mode: 'arena', arenaWave: String(wave) } });
    }, 800);
  };

  const exitArena = async () => {
    if (score > 0) {
      try { await api.post('/game/arena-score', { waves_completed: wave - 1, score }); } catch {}
    }
    router.replace('/game');
  };

  if (!state) return null;
  const player = state.player;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.neonRed}>{'> OUTSIDE_ARENA_'}</PixelText>
        <PixelText size={22} color={COLORS.neonRed} glow bold>HORDE MODE</PixelText>
        <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 4 }}>{'"Survive. The Glitch never stops."'}</PixelText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.waveCard}>
          <PixelText size={11} color={COLORS.textDim}>NEXT WAVE</PixelText>
          <PixelText size={48} color={COLORS.neonRed} glow bold style={{ textAlign: 'center', marginVertical: 6 }}>
            {wave.toString().padStart(2, '0')}
          </PixelText>
          <PixelText size={11} color={COLORS.text} style={{ textAlign: 'center' }}>
            ENEMY POOL · TIER {wave <= 3 ? 1 : wave <= 6 ? 2 : wave <= 9 ? 3 : 4}
          </PixelText>
          <View style={styles.poolRow}>
            {poolForWave(wave).slice(0, 3).map((id) => (
              <PixelText key={id} size={9} color={COLORS.neonYellow}>
                ◇ {ENEMIES[id]?.name}
              </PixelText>
            ))}
          </View>
        </View>

        <View style={styles.stats}>
          <PixelText size={11} color={COLORS.neonYellow} bold>YOUR STATUS</PixelText>
          <View style={{ marginTop: 8 }}>
            <StatBar label="HP" value={player.hp} max={player.maxHp} color={COLORS.hp} bgColor={COLORS.hpBg} width={260} height={12} />
            <View style={{ height: 8 }} />
            <StatBar label="MP" value={player.mp} max={player.maxMp} color={COLORS.mp} bgColor={COLORS.mpBg} width={260} height={12} />
          </View>
          <View style={styles.statSplit}>
            <PixelText size={11} color={COLORS.neonGreen} bold>SCORE: {score}</PixelText>
            <PixelText size={11} color={COLORS.neonCyan} bold>BEST: {state.world.arenaBestWave}</PixelText>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <PixelButton
            title={phase === 'incoming' ? 'INCOMING…' : `START WAVE ${wave}`}
            onPress={startWave}
            disabled={phase !== 'lobby' || player.hp <= 0}
            color={COLORS.neonRed}
            size="lg"
            full
            testID="arena-start-wave"
          />
          <View style={{ height: 8 }} />
          <PixelButton
            title="LEADERBOARD"
            onPress={() => router.push('/leaderboard')}
            color={COLORS.neonYellow}
            full
          />
          <View style={{ height: 8 }} />
          <PixelButton
            title="◀ RETREAT TO ACADEMY"
            onPress={exitArena}
            color={COLORS.textDim}
            full
            testID="arena-exit"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 16, borderBottomWidth: 2, borderBottomColor: COLORS.neonRed, backgroundColor: COLORS.panel },
  scroll: { padding: 16 },
  waveCard: {
    backgroundColor: COLORS.panel,
    borderWidth: 2, borderColor: COLORS.neonRed,
    padding: 16,
    shadowColor: COLORS.neonRed, shadowOpacity: 0.5, shadowRadius: 10,
  },
  poolRow: { marginTop: 14, alignItems: 'center', gap: 4 },
  stats: {
    backgroundColor: COLORS.panelLight,
    borderWidth: 1, borderColor: COLORS.borderHi,
    padding: 14, marginTop: 16,
  },
  statSplit: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});
