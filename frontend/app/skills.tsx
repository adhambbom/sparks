import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ABILITIES_LIST } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';

export default function SkillsScreen() {
  const { state, unlockAbility, saveToServer } = useGame();
  if (!state) return null;
  const player = state.player;

  const branches = [
    { id: 'cyber', label: 'CYBER-STRIKES', color: COLORS.cyber, desc: 'Robotics // Heavy energy & mech' },
    { id: 'mutant', label: 'PHASE-SHIFTING', color: COLORS.mutant, desc: 'Mutant // Psi & utility' },
    { id: 'techno', label: 'TECHNOMANCY', color: COLORS.techno, desc: 'AI manipulation // Hack & corrupt' },
  ];

  const onUnlock = async (id: string) => {
    unlockAbility(id);
    await saveToServer();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.textDim}>{'> SKILL_TREE_'}</PixelText>
        <PixelText size={22} color={COLORS.neonMagenta} glow bold>NEURAL_FORK</PixelText>
        <View style={styles.headerStats}>
          <PixelText size={11} color={COLORS.neonYellow} bold>SP: {player.skillPoints}</PixelText>
          <PixelText size={11} color={COLORS.text}>LV {player.level}</PixelText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {branches.map((b) => {
          const branchAbilities = ABILITIES_LIST.filter((a) => a.branch === b.id);
          return (
            <View key={b.id} style={[styles.branch, { borderColor: b.color }]}>
              <View style={styles.branchHeader}>
                <PixelText size={14} color={b.color} bold glow>{b.label}</PixelText>
                <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 2 }}>{b.desc}</PixelText>
              </View>
              {branchAbilities.map((ab) => {
                const owned = player.abilities.includes(ab.id);
                const meetsLevel = player.level >= ab.reqLevel;
                const meetsPrereq = !ab.prereq || player.abilities.includes(ab.prereq);
                const canUnlock = !owned && meetsLevel && meetsPrereq && player.skillPoints > 0;
                return (
                  <View key={ab.id} style={[styles.skill, { borderColor: owned ? b.color : COLORS.border }]}>
                    <View style={styles.skillRow}>
                      <View style={{ flex: 1 }}>
                        <PixelText size={12} color={owned ? b.color : COLORS.text} bold>
                          {owned ? '◆ ' : '◇ '}{ab.name.toUpperCase()}
                        </PixelText>
                        <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 2 }}>{ab.desc}</PixelText>
                        <View style={styles.metaRow}>
                          <PixelText size={9} color={COLORS.mp}>MP {ab.cost}</PixelText>
                          <PixelText size={9} color={COLORS.textDim}>· LV REQ {ab.reqLevel}</PixelText>
                          {ab.prereq && <PixelText size={9} color={COLORS.textDim}>· PRE: {ab.prereq.replace('_', ' ')}</PixelText>}
                        </View>
                      </View>
                      {!owned && (
                        <PixelButton
                          title={!meetsLevel ? `LV${ab.reqLevel}` : !meetsPrereq ? 'LOCK' : 'UNLOCK'}
                          onPress={() => onUnlock(ab.id)}
                          color={canUnlock ? b.color : COLORS.textDim}
                          disabled={!canUnlock}
                          size="sm"
                        />
                      )}
                      {owned && <PixelText size={11} color={b.color} bold>OWNED</PixelText>}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PixelButton title="◀ BACK" onPress={() => router.back()} color={COLORS.neonCyan} full size="lg" testID="skills-back" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderHi },
  headerStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scroll: { padding: 16, gap: 16 },
  branch: { borderWidth: 2, padding: 12 },
  branchHeader: { marginBottom: 10 },
  skill: { borderWidth: 1, padding: 10, marginVertical: 4 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
});
