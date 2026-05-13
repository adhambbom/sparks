import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';
import {
  SYNERGY_BRANCHES,
  SYNERGY_NODES,
  SynergyBranchId,
} from '../src/data/operatorSynergy';

/**
 * OPERATOR FRAMEWORK screen.
 *
 * The "rogue AI deployment loadout" — passive nodes the operator
 * invests in. Each node permanently buffs whatever entity is currently
 * deployed in combat. Tone is intentionally cold + illegal:
 *   "BUILD ILLEGAL COMBAT FRAMEWORK"
 *
 * Layout (mobile-first):
 *   • Header  → SYNERGY POINTS available + Lv
 *   • Branch  → 5 horizontal panels, each scrolls vertically with 4 tier rows
 *   • Node    → tap to inspect; tap UNLOCK to commit a synergy point
 */
export default function OperatorFrameworkScreen() {
  const { state, unlockSynergyNode, saveToServer } = useGame();
  const [selectedBranch, setSelectedBranch] = useState<SynergyBranchId>('deployment');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  if (!state) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <PixelText size={14} color={COLORS.neonMagenta} bold glow autoFit>SYNERGY GRID</PixelText>
          <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 12, textAlign: 'center' }}>
            Loading operator state…
          </PixelText>
          <View style={{ height: 20 }} />
          <PixelButton title="◀ BACK" onPress={() => router.back()} color={COLORS.neonCyan} size="md" />
        </View>
      </SafeAreaView>
    );
  }
  const player = state.player;
  const owned = useMemo(() => new Set(player.synergyNodes ?? []), [player.synergyNodes]);
  const points = player.synergyPoints ?? 0;

  const onUnlock = async (id: string) => {
    sfx.confirm();
    const ok = unlockSynergyNode(id);
    if (!ok) {
      Alert.alert('UNLOCK FAILED', 'No synergy points available.');
      return;
    }
    await saveToServer();
  };

  const branchNodes = SYNERGY_NODES.filter((n) => n.branch === selectedBranch);
  const branchData = SYNERGY_BRANCHES[selectedBranch];

  const selected = selectedNode
    ? SYNERGY_NODES.find((n) => n.id === selectedNode) ?? null
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.textDim} autoFit>{'> OPERATOR_FRAMEWORK_'}</PixelText>
        <PixelText size={20} color={COLORS.neonMagenta} glow bold autoFit>SYNERGY GRID</PixelText>
        <View style={styles.headerStats}>
          <PixelText size={10} color={COLORS.neonYellow} bold>SP: {points}</PixelText>
          <PixelText size={10} color={COLORS.neonCyan}>LV {player.level}</PixelText>
          <PixelText size={10} color={COLORS.textDim}>NODES: {owned.size}/{SYNERGY_NODES.length}</PixelText>
        </View>
        <PixelText size={8} color={COLORS.textDim} style={{ marginTop: 4 }}>
          Operator nodes BUFF the deployed entity. Stack branches to build your illegal combat framework.
        </PixelText>
      </View>

      {/* Branch tabs */}
      <View style={styles.tabsRow}>
        {Object.entries(SYNERGY_BRANCHES).map(([id, b]) => {
          const isActive = selectedBranch === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => { sfx.click(); setSelectedBranch(id as SynergyBranchId); setSelectedNode(null); }}
              style={[
                styles.tab,
                {
                  borderColor: isActive ? b.color : COLORS.border,
                  backgroundColor: isActive ? 'rgba(10,10,20,0.95)' : 'rgba(10,10,20,0.55)',
                },
              ]}
            >
              <PixelText size={9} color={isActive ? b.color : COLORS.textDim} bold autoFit>
                {b.label}
              </PixelText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Nodes */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.branchBox, { borderColor: branchData.color }]}>
          <PixelText size={11} color={branchData.color} bold autoFit>{branchData.label}</PixelText>
          <PixelText size={8} color={COLORS.textDim} autoFit>{branchData.sub}</PixelText>
        </View>
        {[1, 2, 3, 4].map((tier) => (
          <View key={tier} style={styles.tierRow}>
            <View style={styles.tierLabel}>
              <PixelText size={8} color={COLORS.textDim}>T{tier}</PixelText>
            </View>
            <View style={styles.tierNodes}>
              {branchNodes.filter((n) => n.tier === tier).map((n) => {
                const isOwned = owned.has(n.id);
                const meetsLv = player.level >= n.reqLevel;
                const meetsPre = !n.prereq || owned.has(n.prereq);
                const canBuy = !isOwned && meetsLv && meetsPre && points > 0;
                const stateColor = isOwned
                  ? branchData.color
                  : canBuy
                  ? COLORS.text
                  : COLORS.textDim;
                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => { sfx.click(); setSelectedNode(n.id); }}
                    style={[
                      styles.nodeBox,
                      {
                        borderColor: isOwned
                          ? branchData.color
                          : canBuy
                          ? COLORS.borderHi
                          : COLORS.border,
                        borderWidth: isOwned ? 2 : 1,
                        backgroundColor: isOwned
                          ? 'rgba(20,30,40,0.85)'
                          : 'rgba(10,10,20,0.6)',
                      },
                    ]}
                  >
                    <PixelText size={9} color={stateColor} bold autoFit>
                      {isOwned ? '◆' : canBuy ? '◇' : '✕'} {n.name}
                    </PixelText>
                    <PixelText size={7} color={COLORS.textDim} autoFit>
                      LV{n.reqLevel}{n.prereq ? ' · LINKED' : ''}
                    </PixelText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Inspector panel — shows when a node is selected */}
      {selected && (() => {
        const isOwned = owned.has(selected.id);
        const meetsLv = player.level >= selected.reqLevel;
        const meetsPre = !selected.prereq || owned.has(selected.prereq);
        const canBuy = !isOwned && meetsLv && meetsPre && points > 0;
        const branchColor = SYNERGY_BRANCHES[selected.branch].color;
        return (
          <View style={[styles.inspector, { borderColor: branchColor }]}>
            <View style={styles.inspectorHeader}>
              <PixelText size={12} color={branchColor} bold autoFit>{selected.name}</PixelText>
              <PixelText size={9} color={COLORS.textDim}>T{selected.tier} · LV{selected.reqLevel}</PixelText>
            </View>
            <PixelText size={9} color={COLORS.text} style={{ marginTop: 4 }}>
              {selected.desc}
            </PixelText>
            <PixelText size={9} color={branchColor} style={{ marginTop: 4 }}>
              ▸ {selected.effectText}
            </PixelText>
            {selected.prereq && !meetsPre && (
              <PixelText size={8} color={'#ff8080'} style={{ marginTop: 4 }}>
                REQUIRES: {SYNERGY_NODES.find(x => x.id === selected.prereq)?.name ?? selected.prereq}
              </PixelText>
            )}
            <View style={styles.inspectorRow}>
              <PixelButton
                title="CLOSE"
                onPress={() => { sfx.click(); setSelectedNode(null); }}
                color={COLORS.textDim}
                size="sm"
              />
              {isOwned ? (
                <PixelText size={10} color={branchColor} bold>OWNED</PixelText>
              ) : (
                <PixelButton
                  title={!meetsLv ? `LV${selected.reqLevel}` : !meetsPre ? 'LOCKED' : 'UNLOCK'}
                  onPress={() => onUnlock(selected.id)}
                  color={canBuy ? branchColor : COLORS.textDim}
                  disabled={!canBuy}
                  size="sm"
                />
              )}
            </View>
          </View>
        );
      })()}

      <View style={styles.footer}>
        <PixelButton title="◀ BACK" onPress={() => router.back()} color={COLORS.neonCyan} full size="md" testID="opframe-back" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderHi },
  headerStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8 },
  tabsRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  scroll: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  branchBox: { borderWidth: 2, padding: 10, marginBottom: 6 },
  tierRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginVertical: 2 },
  tierLabel: { width: 24, paddingTop: 8 },
  tierNodes: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nodeBox: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 100,
    flex: 1,
  },
  inspector: {
    margin: 10,
    padding: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(10,10,20,0.9)',
  },
  inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 },
  footer: { padding: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
});
