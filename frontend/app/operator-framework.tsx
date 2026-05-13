import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Alert, Easing } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';
import {
  SYNERGY_BRANCHES,
  SYNERGY_NODES,
  RARITY_VISUAL,
  SynergyBranchId,
  SynergyNode,
} from '../src/data/operatorSynergy';

/**
 * SYNERGY GRID — OPERATOR FRAMEWORK (v2)
 *
 * Visual upgrade per spec:
 *   • Branch tabs carry glyph + iconic color so each school feels distinct.
 *   • Nodes inherit rarity rim (common → rare → illegal → mythic gold).
 *   • Owned nodes pulse (Animated ring + glow).
 *   • Connecting glow lines (SVG) draw between prereq → unlocked nodes.
 *   • Important nodes (T3+/illegal/mythic) feel rare and powerful.
 *
 * Layout philosophy:
 *   We use a fixed-layout grid (4 tiers × 2-3 columns per tier) for the
 *   selected branch. Node centers are computed deterministically so the
 *   SVG can draw lines between them without measuring at runtime.
 */

const GRID_PAD = 12;
const NODE_W = 142;
const NODE_H = 78;
const TIER_GAP_Y = 18;
const COL_GAP_X = 10;

type Pos = { x: number; y: number; node: SynergyNode };

export default function OperatorFrameworkScreen() {
  const { state, unlockSynergyNode, saveToServer } = useGame();
  const [selectedBranch, setSelectedBranch] = useState<SynergyBranchId>('deployment');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // ── PULSE RING ──────────────────────────────────────────────────
  // One shared Animated value drives every owned-node pulse — cheap.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  // ── RULES OF HOOKS: declare ALL hooks BEFORE any early return ────
  // State can transition from `null` → loaded mid-mount thanks to the
  // GameProvider auto-load effect. If the loading-placeholder branch
  // returned BEFORE the useMemo calls below, React would see a
  // different hook count between renders and throw
  // "Rendered more hooks than during the previous render."
  // Fix: compute the memo'd inputs from a safe `player` fallback so the
  // hook list is identical regardless of state availability.
  const player = state?.player;
  const owned = useMemo(
    () => new Set(player?.synergyNodes ?? []),
    [player?.synergyNodes],
  );
  const points = player?.synergyPoints ?? 0;
  const branchNodes = useMemo(
    () => SYNERGY_NODES.filter((n) => n.branch === selectedBranch),
    [selectedBranch],
  );
  const branchData = SYNERGY_BRANCHES[selectedBranch];

  const positions: Pos[] = useMemo(() => {
    const out: Pos[] = [];
    for (let tier = 1; tier <= 4; tier++) {
      const inTier = branchNodes.filter((n) => n.tier === tier);
      const totalWidth = inTier.length * NODE_W + (inTier.length - 1) * COL_GAP_X;
      const startX = (320 - totalWidth) / 2 + GRID_PAD;
      const y = GRID_PAD + (tier - 1) * (NODE_H + TIER_GAP_Y);
      inTier.forEach((node, i) => {
        out.push({ x: startX + i * (NODE_W + COL_GAP_X), y, node });
      });
    }
    return out;
  }, [branchNodes]);

  const gridHeight = GRID_PAD * 2 + 4 * NODE_H + 3 * TIER_GAP_Y;
  const gridWidth = 320 + GRID_PAD * 2;

  const lines = useMemo(() => {
    const arr: { x1: number; y1: number; x2: number; y2: number; active: boolean }[] = [];
    for (const p of positions) {
      if (!p.node.prereq) continue;
      const parent = positions.find((q) => q.node.id === p.node.prereq);
      if (!parent) continue;
      arr.push({
        x1: parent.x + NODE_W / 2,
        y1: parent.y + NODE_H,
        x2: p.x + NODE_W / 2,
        y2: p.y,
        active: owned.has(parent.node.id) && owned.has(p.node.id),
      });
    }
    return arr;
  }, [positions, owned]);

  const selected = selectedNode ? SYNERGY_NODES.find((n) => n.id === selectedNode) ?? null : null;

  // ── NOW it is safe to early-return: all hooks above are unconditional.
  if (!state || !player) {
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.textDim} autoFit>{'> OPERATOR_FRAMEWORK_'}</PixelText>
        <PixelText size={20} color={COLORS.neonMagenta} glow bold autoFit>SYNERGY GRID</PixelText>
        <View style={styles.headerStats}>
          <View style={styles.spillPill}>
            <PixelText size={10} color={'#ffd24a'} bold>SP</PixelText>
            <PixelText size={10} color={'#ffd24a'} bold> {points}</PixelText>
          </View>
          <PixelText size={9} color={COLORS.neonCyan}>LV {player.level}</PixelText>
          <PixelText size={9} color={COLORS.textDim}>NODES {owned.size}/{SYNERGY_NODES.length}</PixelText>
        </View>
        <PixelText size={8} color={COLORS.textDim} style={{ marginTop: 4 }} numberOfLines={2}>
          Operator passives BUFF the deployed entity. Stack branches to build an illegal combat framework.
        </PixelText>
      </View>

      {/* ── BRANCH TABS ────────────────────────────────────────── */}
      <View style={styles.tabsRow}>
        {Object.entries(SYNERGY_BRANCHES).map(([id, b]) => {
          const isActive = selectedBranch === id;
          // Count owned nodes for this branch — gives a sense of progress.
          const ownedInBranch = SYNERGY_NODES.filter(
            (n) => n.branch === id && owned.has(n.id),
          ).length;
          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.7}
              onPress={() => { sfx.click(); setSelectedBranch(id as SynergyBranchId); setSelectedNode(null); }}
              style={[
                styles.tab,
                {
                  borderColor: isActive ? b.rimColor : COLORS.border,
                  backgroundColor: isActive ? 'rgba(10,10,20,0.95)' : 'rgba(10,10,20,0.55)',
                  shadowColor: isActive ? b.rimColor : 'transparent',
                  shadowOpacity: isActive ? 0.8 : 0,
                  shadowRadius: isActive ? 8 : 0,
                },
              ]}
            >
              <PixelText size={14} color={isActive ? b.color : COLORS.textDim} bold>{b.glyph}</PixelText>
              <PixelText size={8} color={isActive ? b.color : COLORS.textDim} bold autoFit style={{ marginTop: 2 }}>
                {b.label}
              </PixelText>
              {ownedInBranch > 0 && (
                <View style={[styles.tabPip, { backgroundColor: b.color }]}>
                  <PixelText size={7} color="#000" bold>{ownedInBranch}</PixelText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── SCROLLABLE BRANCH GRID ─────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.scroll} horizontal={false}>
        <View style={[styles.branchHeader, { borderColor: branchData.rimColor }]}>
          <PixelText size={14} color={branchData.color} bold glow>{branchData.glyph} {branchData.label}</PixelText>
          <PixelText size={8} color={COLORS.textDim}>{branchData.sub}</PixelText>
        </View>

        {/* The grid itself: SVG (connecting lines) + absolute-positioned node cards. */}
        <View style={{ width: gridWidth, height: gridHeight, alignSelf: 'center' }}>
          <Svg width={gridWidth} height={gridHeight} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="activeLink" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={branchData.color} stopOpacity={0.95} />
                <Stop offset="100%" stopColor={branchData.color} stopOpacity={0.55} />
              </LinearGradient>
            </Defs>
            {lines.map((l, i) => (
              <Line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.active ? branchData.color : '#2a2a40'}
                strokeWidth={l.active ? 3 : 1}
                strokeDasharray={l.active ? undefined : '3,4'}
                strokeLinecap="round"
              />
            ))}
          </Svg>

          {/* Tier labels (T1..T4) gutter on left */}
          {[1, 2, 3, 4].map((tier) => (
            <View
              key={`label-${tier}`}
              style={{
                position: 'absolute',
                left: 0,
                top: GRID_PAD + (tier - 1) * (NODE_H + TIER_GAP_Y) + NODE_H / 2 - 8,
              }}
            >
              <PixelText size={8} color={COLORS.textDim}>T{tier}</PixelText>
            </View>
          ))}

          {/* Node cards */}
          {positions.map(({ x, y, node }) => (
            <NodeCard
              key={node.id}
              x={x}
              y={y}
              node={node}
              isOwned={owned.has(node.id)}
              isCanBuy={
                !owned.has(node.id) &&
                player.level >= node.reqLevel &&
                (!node.prereq || owned.has(node.prereq)) &&
                points > 0
              }
              isLocked={
                !owned.has(node.id) &&
                (player.level < node.reqLevel || (!!node.prereq && !owned.has(node.prereq)))
              }
              pulseValue={pulse}
              onPress={() => { sfx.click(); setSelectedNode(node.id); }}
              isSelected={selectedNode === node.id}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── INSPECTOR PANEL ────────────────────────────────────── */}
      {selected && (() => {
        const isOwned = owned.has(selected.id);
        const meetsLv = player.level >= selected.reqLevel;
        const meetsPre = !selected.prereq || owned.has(selected.prereq);
        const canBuy = !isOwned && meetsLv && meetsPre && points > 0;
        const branchColor = SYNERGY_BRANCHES[selected.branch].color;
        const rarity = RARITY_VISUAL[selected.rarity];
        return (
          <View style={[styles.inspector, { borderColor: rarity.rim, backgroundColor: 'rgba(8,8,16,0.95)' }]}>
            <View style={styles.inspectorHeader}>
              <View style={{ flex: 1 }}>
                <PixelText size={12} color={branchColor} bold autoFit>{selected.name}</PixelText>
                <PixelText size={8} color={rarity.rim} bold>{rarity.label} · T{selected.tier} · LV{selected.reqLevel}</PixelText>
              </View>
              {isOwned && <PixelText size={10} color={branchColor} bold glow>◆ OWNED</PixelText>}
            </View>
            <PixelText size={9} color={COLORS.text} style={{ marginTop: 6 }} numberOfLines={3}>
              {selected.flavor}
            </PixelText>
            <View style={[styles.effectRow, { borderColor: branchColor }]}>
              <PixelText size={9} color={branchColor} bold>▸ {selected.effectText}</PixelText>
            </View>
            {selected.prereq && !meetsPre && (
              <PixelText size={8} color={'#ff8080'} style={{ marginTop: 4 }}>
                REQUIRES: {SYNERGY_NODES.find(x => x.id === selected.prereq)?.name ?? selected.prereq}
              </PixelText>
            )}
            <View style={styles.inspectorRow}>
              <PixelButton title="CLOSE" onPress={() => { sfx.click(); setSelectedNode(null); }} color={COLORS.textDim} size="sm" />
              {!isOwned && (
                <PixelButton
                  title={!meetsLv ? `LV${selected.reqLevel}` : !meetsPre ? 'LOCKED' : 'JACK IN'}
                  onPress={() => onUnlock(selected.id)}
                  color={canBuy ? rarity.rim : COLORS.textDim}
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

/**
 * NodeCard — owned cards pulse + glow with branch color. Locked cards
 * appear desaturated. Rarity drives rim color so mythic capstones glow gold.
 */
function NodeCard({
  x,
  y,
  node,
  isOwned,
  isCanBuy,
  isLocked,
  pulseValue,
  isSelected,
  onPress,
}: {
  x: number;
  y: number;
  node: SynergyNode;
  isOwned: boolean;
  isCanBuy: boolean;
  isLocked: boolean;
  pulseValue: Animated.Value;
  isSelected: boolean;
  onPress: () => void;
}) {
  const branch = SYNERGY_BRANCHES[node.branch];
  const rarity = RARITY_VISUAL[node.rarity];

  // Pulse parameters scale with rarity (mythic pulses 2× as wide).
  const pulseScale = pulseValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + 0.06 * rarity.pulse] });
  const pulseOpacity = pulseValue.interpolate({ inputRange: [0, 1], outputRange: [0.25 * rarity.pulse, 0.05] });

  const rim = isOwned ? branch.color : isCanBuy ? rarity.rim : '#2a2a40';
  const bgColor = isOwned
    ? rarity.bgGlow !== 'transparent' ? rarity.bgGlow : 'rgba(20,30,40,0.85)'
    : isCanBuy
    ? 'rgba(14,18,28,0.85)'
    : 'rgba(10,10,18,0.55)';

  const nameColor = isOwned ? branch.color : isLocked ? COLORS.textDim : COLORS.text;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: NODE_W,
        height: NODE_H,
      }}
    >
      {/* Pulse ring — visible only when owned + rarity > common */}
      {isOwned && rarity.pulse > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -4,
            top: -4,
            width: NODE_W + 8,
            height: NODE_H + 8,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: rarity.rim,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          }}
        />
      )}

      <View
        style={[
          styles.nodeCard,
          {
            borderColor: rim,
            backgroundColor: bgColor,
            borderWidth: isOwned ? 2 : isSelected ? 2 : 1,
            shadowColor: isOwned ? branch.color : 'transparent',
            shadowOpacity: isOwned ? 0.6 : 0,
            shadowRadius: isOwned ? 6 : 0,
            opacity: isLocked ? 0.5 : 1,
          },
        ]}
      >
        {/* Corner glyph: ◆ owned · ◇ unlockable · ✕ locked */}
        <View style={styles.nodeCorner}>
          <PixelText size={9} color={rim} bold>
            {isOwned ? '◆' : isLocked ? '✕' : '◇'}
          </PixelText>
        </View>
        {/* Rarity tag */}
        <View style={[styles.rarityTag, { backgroundColor: rim }]}>
          <PixelText size={6} color="#000" bold>{rarity.label}</PixelText>
        </View>
        <PixelText size={10} color={nameColor} bold autoFit style={{ marginTop: 14 }}>{node.name}</PixelText>
        <PixelText size={7} color={COLORS.textDim} autoFit style={{ marginTop: 4 }}>
          LV{node.reqLevel}{node.prereq ? ' · LINK' : ''}
        </PixelText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderHi },
  headerStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 },
  spillPill: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#ffd24a',
    backgroundColor: 'rgba(40,30,5,0.6)',
  },
  tabsRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 6, paddingVertical: 6 },
  tab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowOffset: { width: 0, height: 0 },
  },
  tabPip: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 8, paddingBottom: 12 },
  branchHeader: { borderWidth: 2, padding: 10, marginBottom: 10, marginHorizontal: 4 },
  nodeCard: {
    width: NODE_W,
    height: NODE_H,
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  nodeCorner: { position: 'absolute', top: 3, left: 5 },
  rarityTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  inspector: {
    margin: 10,
    padding: 12,
    borderWidth: 2,
  },
  inspectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  effectRow: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderLeftWidth: 2,
    backgroundColor: 'rgba(20,30,50,0.5)',
  },
  inspectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 },
  footer: { padding: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
});
