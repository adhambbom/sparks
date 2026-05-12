// ============================================================
// REGISTRY — Quantum Taming compendium
// Lists every species the player has seen and which are captured.
// Tap a captured species to see stats / skills. Modular: reads from
// state.quantum (added by the GameContext slice) and ENEMIES.
// ============================================================
import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENEMIES } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';
import { MAX_PARTY } from '../src/systems/QuantumStorage';
import { resolveMinionSpriteUri, hasMinionSprite } from '../src/systems/DynamicMinionRenderer';
import { sfx } from '../src/utils/audio';

/** Renders the dynamic minion sprite resolved by speciesId, or a placeholder
 *  glyph when no art is mapped for that id (legacy enemies). */
function MinionThumb({ speciesId, size = 56 }: { speciesId: string; size?: number }) {
  const uri = hasMinionSprite(speciesId) ? resolveMinionSpriteUri(speciesId) : null;
  if (!uri) {
    return (
      <View style={[styles.thumbFallback, { width: size, height: size }]}>
        <PixelText size={10} color={COLORS.textDim}>?</PixelText>
      </View>
    );
  }
  return (
    <View style={[styles.thumbWrap, { width: size, height: size }]}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </View>
  );
}

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
            Seen {seenCount}/{totalSpecies} · Captured {capturedCount}/{totalSpecies}
          </PixelText>
        </View>
        <PixelButton title="← BACK" onPress={() => { sfx.cancel(); router.back(); }} color={COLORS.textDim} size="sm" />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* ── PARTY (top) ─────────────────────────────────────────── */}
        <PixelText size={12} color={COLORS.neonYellow} bold>
          NANO-COMPUTER · ACTIVE PARTY ({q.party.length}/{MAX_PARTY})
        </PixelText>
        {q.party.length === 0 && (
          <PixelText size={10} color={COLORS.textDim} style={{ marginTop: 4 }}>
            No minions deployed. Quarantine foes in battle to fill these slots.
          </PixelText>
        )}
        {q.party.map((m, i) => (
          <View key={m.uid} style={styles.minionCard}>
            <View style={styles.cardRow}>
              <MinionThumb speciesId={m.speciesId} size={64} />
              <View style={styles.cardBody}>
                <View style={styles.minionRow}>
                  <PixelText size={11} color={COLORS.neonYellow} bold>{i + 1}. {m.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>Lv{m.level} · Tier {m.tier}</PixelText>
                </View>
                <PixelText size={9} color={COLORS.text}>HP {m.maxHp} · ATK {m.atk} · DEF {m.def} · SPD {m.spd}</PixelText>
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
                <View style={styles.cardRow}>
                  <MinionThumb speciesId={m.speciesId} size={56} />
                  <View style={styles.cardBody}>
                    <View style={styles.minionRow}>
                      <PixelText size={11} color={COLORS.neonCyan} bold>{m.name.toUpperCase()}</PixelText>
                      <PixelText size={9} color={COLORS.textDim}>Lv{m.level} · Tier {m.tier}</PixelText>
                    </View>
                    <PixelText size={9} color={COLORS.text}>HP {m.maxHp} · ATK {m.atk} · DEF {m.def}</PixelText>
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
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── SEEN BUT NOT CAPTURED ─────────────────────────────── */}
        <View style={{ marginTop: 18 }}>
          <PixelText size={12} color={COLORS.textDim} bold>FIELD LOG · ENCOUNTERED</PixelText>
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
                  <View style={styles.cardRow}>
                    <MinionThumb speciesId={id} size={48} />
                    <View style={styles.cardBody}>
                      <PixelText size={11} color={COLORS.text} bold>??? {e.name.toUpperCase()}</PixelText>
                      <PixelText size={9} color={COLORS.textDim}>
                        Tier {e.tier} · Not yet captured.
                      </PixelText>
                    </View>
                  </View>
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
  // Card layout: sprite thumb on the left, info column on the right
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardBody: { flex: 1 },
  thumbWrap: {
    backgroundColor: '#0a0a14',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallback: {
    backgroundColor: '#0a0a14',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
