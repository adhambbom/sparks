// ============================================================
// REGISTRY \u2014 Quantum Taming compendium
// Lists every species the player has seen and which are captured.
// Tap a captured species to see stats / skills. Modular: reads from
// state.quantum (added by the GameContext slice) and ENEMIES.
// ============================================================
import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENEMIES } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';
import { MAX_PARTY } from '../src/systems/QuantumStorage';
import { sfx } from '../src/utils/audio';

export default function RegistryScreen() {
  const { state, swapPartyMinion, releaseMinion } = useGame();
  if (!state) {
    return (
      <SafeAreaView style={styles.container}>
        <PixelText color={COLORS.text}>Loading...</PixelText>
      </SafeAreaView>
    );
  }
  const q = state.quantum ?? { party: [], extendedStorage: [], seenSpecies: [], capturedSpecies: [] };
  const totalSpecies = Object.keys(ENEMIES).length;
  const seenCount = q.seenSpecies.length;
  const capturedCount = q.capturedSpecies.length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <View>
          <PixelText size={16} color={COLORS.neonCyan} bold glow>QUANTUM REGISTRY</PixelText>
          <PixelText size={9} color={COLORS.textDim}>
            Seen {seenCount}/{totalSpecies} \u00b7 Captured {capturedCount}/{totalSpecies}
          </PixelText>
        </View>
        <PixelButton title="\u2190 BACK" onPress={() => { sfx.cancel(); router.back(); }} color={COLORS.textDim} size="sm" />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* ── PARTY (top) ─────────────────────────────────────────── */}
        <PixelText size={12} color={COLORS.neonYellow} bold>NANO-COMPUTER \u00b7 ACTIVE PARTY ({q.party.length}/{MAX_PARTY})</PixelText>
        {q.party.length === 0 && (
          <PixelText size={10} color={COLORS.textDim} style={{ marginTop: 4 }}>
            No minions deployed. Quarantine foes in battle to fill these slots.
          </PixelText>
        )}
        {q.party.map((m, i) => (
          <View key={m.uid} style={styles.minionCard}>
            <View style={styles.minionRow}>
              <PixelText size={11} color={COLORS.neonYellow} bold>{i + 1}. {m.name.toUpperCase()}</PixelText>
              <PixelText size={9} color={COLORS.textDim}>Lv{m.level} \u00b7 Tier {m.tier}</PixelText>
            </View>
            <PixelText size={9} color={COLORS.text}>HP {m.maxHp} \u00b7 ATK {m.atk} \u00b7 DEF {m.def} \u00b7 SPD {m.spd}</PixelText>
            <PixelText size={9} color={COLORS.neonMagenta} style={{ marginTop: 2 }}>
              Skills: {m.skills.join(', ')}
            </PixelText>
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => { sfx.cancel(); releaseMinion(m.uid); }}
                style={styles.releaseBtn}
              >
                <PixelText size={9} color={COLORS.neonRed}>RELEASE</PixelText>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* ── EXTENDED STORAGE ──────────────────────────────────── */}
        {q.extendedStorage.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <PixelText size={12} color={COLORS.neonCyan} bold>EXTENDED STORAGE ({q.extendedStorage.length})</PixelText>
            <PixelText size={9} color={COLORS.textDim}>Tap SWAP to bring a minion into the active party.</PixelText>
            {q.extendedStorage.map((m, i) => (
              <View key={m.uid} style={styles.minionCard}>
                <View style={styles.minionRow}>
                  <PixelText size={11} color={COLORS.neonCyan} bold>{m.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>Lv{m.level} \u00b7 Tier {m.tier}</PixelText>
                </View>
                <PixelText size={9} color={COLORS.text}>HP {m.maxHp} \u00b7 ATK {m.atk} \u00b7 DEF {m.def}</PixelText>
                {q.party.length > 0 && (
                  <View style={styles.actionRow}>
                    {q.party.map((p, pIdx) => (
                      <TouchableOpacity
                        key={p.uid}
                        onPress={() => { sfx.confirm(); swapPartyMinion(pIdx, i); }}
                        style={styles.swapBtn}
                      >
                        <PixelText size={9} color={COLORS.neonGreen}>SWAP w/ {p.name}</PixelText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── SEEN BUT NOT CAPTURED ─────────────────────────────── */}
        <View style={{ marginTop: 18 }}>
          <PixelText size={12} color={COLORS.textDim} bold>FIELD LOG \u00b7 ENCOUNTERED</PixelText>
          {q.seenSpecies.filter((id) => !q.capturedSpecies.includes(id)).length === 0 && (
            <PixelText size={10} color={COLORS.textDim} style={{ marginTop: 4 }}>
              All encountered species captured. Hunt new ones.
            </PixelText>
          )}
          {q.seenSpecies
            .filter((id) => !q.capturedSpecies.includes(id))
            .map((id) => {
              const e = ENEMIES[id];
              if (!e) return null;
              return (
                <View key={id} style={[styles.minionCard, { opacity: 0.65 }]}>
                  <PixelText size={11} color={COLORS.text} bold>??? {e.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>
                    Tier {e.tier} \u00b7 Not yet captured.
                  </PixelText>
                </View>
              );
            })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderColor: COLORS.border,
  },
  body: { padding: 14, paddingBottom: 32 },
  minionCard: {
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 10,
    marginTop: 8,
  },
  minionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  swapBtn: {
    borderWidth: 1,
    borderColor: COLORS.neonGreen,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  releaseBtn: {
    borderWidth: 1,
    borderColor: COLORS.neonRed,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
});
