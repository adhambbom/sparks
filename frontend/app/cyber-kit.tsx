// ============================================================
// CYBER ASSET KIT — Showcase / preview of the MVP modular art
// pipeline. Reachable from MENU → HOW TO PLAY or directly via
// /cyber-kit. Lets you see every code-drawn tile and prop in
// one place before wiring them into game.tsx.
// ============================================================
import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { CYBER } from '../src/data/cyberPalette';
import { PixelText } from '../src/components/PixelText';
import CyberTile, { CyberTileKind } from '../src/components/cyber/CyberTile';
import CyberProp, { CyberPropKind } from '../src/components/cyber/CyberProp';
import { AtmosphereLayer } from '../src/components/AtmosphereLayer';

const TILE_KINDS: { id: CyberTileKind; label: string }[] = [
  { id: 'pavement', label: 'PAVEMENT' },
  { id: 'corruption', label: 'CORRUPTION' },
  { id: 'road-marking', label: 'ROAD' },
  { id: 'transition', label: 'TRANSITION' },
  { id: 'toxic-pool', label: 'TOXIC' },
];

const PROP_KINDS: { id: CyberPropKind; label: string }[] = [
  { id: 'barrel-radioactive', label: 'RAD BARREL' },
  { id: 'barrel-energy', label: 'ENERGY BARREL' },
  { id: 'crate', label: 'CRATE' },
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'generator', label: 'GENERATOR' },
  { id: 'debris-pile', label: 'DEBRIS' },
  { id: 'car-wreck', label: 'CAR WRECK' },
  { id: 'fence', label: 'FENCE' },
  { id: 'gate-locked', label: 'LOCKED GATE' },
  { id: 'pipe-vertical', label: 'PIPE' },
  { id: 'warning-sign', label: 'WARNING' },
];

export default function CyberKitShowcase() {
  const TILE_SIZE = 48;
  const PROP_SIZE = 56;
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <PixelText size={12} color={COLORS.textDim}>◀ BACK</PixelText>
        </TouchableOpacity>
        <PixelText size={14} color={COLORS.neonCyan} glow bold>CYBER ASSET KIT — MVP</PixelText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
        {/* ── DEMO STREET — composed scene from primitives ─────────── */}
        <Section title="LIVE DEMO STREET">
          <View style={[styles.demoStreet, { width: TILE_SIZE * 8 }]}>
            {/* 6 rows × 8 cols of tiles */}
            {Array.from({ length: 6 }).map((_, y) => (
              <View key={`r-${y}`} style={{ flexDirection: 'row' }}>
                {Array.from({ length: 8 }).map((__, x) => {
                  const isRoad = y === 2 || y === 3;
                  const isCorrupt = (x === 6 && y >= 4) || (x === 7 && y >= 4);
                  const isTrans = (x === 5 && y === 4);
                  const kind: CyberTileKind = isCorrupt ? 'corruption'
                    : isTrans ? 'transition'
                    : isRoad ? (x === 3 ? 'road-marking' : 'pavement')
                    : 'pavement';
                  return (
                    <View key={`c-${x}-${y}`} style={{ width: TILE_SIZE, height: TILE_SIZE }}>
                      <CyberTile kind={kind} size={TILE_SIZE} x={x} y={y} />
                    </View>
                  );
                })}
              </View>
            ))}
            {/* Props placed on top */}
            <View style={{ position: 'absolute', left: TILE_SIZE * 1, top: TILE_SIZE * 0 }}>
              <CyberProp kind="car-wreck" size={TILE_SIZE * 1.6} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 0, top: TILE_SIZE * 4 }}>
              <CyberProp kind="barrel-radioactive" size={TILE_SIZE} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 1, top: TILE_SIZE * 4 }}>
              <CyberProp kind="barrel-energy" size={TILE_SIZE} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 2, top: TILE_SIZE * 5 }}>
              <CyberProp kind="debris-pile" size={TILE_SIZE} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 3, top: TILE_SIZE * 4 }}>
              <CyberProp kind="terminal" size={TILE_SIZE} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 4, top: TILE_SIZE * 5 }}>
              <CyberProp kind="warning-sign" size={TILE_SIZE} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 6, top: TILE_SIZE * 0 }}>
              <CyberProp kind="generator" size={TILE_SIZE} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 7, top: TILE_SIZE * 0 }}>
              <CyberProp kind="gate-locked" size={TILE_SIZE} />
            </View>
            <View style={{ position: 'absolute', left: TILE_SIZE * 5, top: TILE_SIZE * 1, flexDirection: 'row' }}>
              <CyberProp kind="fence" size={TILE_SIZE} />
              <CyberProp kind="fence" size={TILE_SIZE} />
            </View>
            {/* Atmospheric overlay — proves the AtmosphereLayer composes correctly. */}
            <AtmosphereLayer width={TILE_SIZE * 8} height={TILE_SIZE * 6} intensity="heavy" />
          </View>
          <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 6, textAlign: 'center' }}>
            ↑ Composed entirely from 5 tile types + 11 props + atmosphere layer ↑
          </PixelText>
        </Section>

        {/* ── TILE PALETTE ────────────────────────────────────────── */}
        <Section title="FLOOR TILE PALETTE (5 kinds × 4 variants each)">
          {TILE_KINDS.map((t) => (
            <View key={t.id} style={styles.row}>
              <PixelText size={9} color={COLORS.textDim} style={{ width: 100 }}>{t.label}</PixelText>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 1, 2, 3].map((v) => (
                  <View key={v} style={{ width: TILE_SIZE, height: TILE_SIZE }}>
                    <CyberTile kind={t.id} size={TILE_SIZE} variant={v} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Section>

        {/* ── PROP PALETTE ───────────────────────────────────────── */}
        <Section title="PROP LIBRARY (11 modular props)">
          <View style={styles.propGrid}>
            {PROP_KINDS.map((p) => (
              <View key={p.id} style={styles.propCell}>
                <View style={styles.propBg}>
                  <CyberProp kind={p.id} size={PROP_SIZE} />
                </View>
                <PixelText size={7} color={COLORS.textDim} style={{ marginTop: 4 }}>{p.label}</PixelText>
              </View>
            ))}
          </View>
        </Section>

        {/* ── PALETTE SWATCHES ────────────────────────────────────── */}
        <Section title="LOCKED PALETTE — 24 COLOURS">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(CYBER).map(([name, hex]) => (
              <View key={name} style={[styles.swatch, { backgroundColor: hex }]}>
                <PixelText size={6} color="#fff" style={styles.swatchLabel}>{name}</PixelText>
              </View>
            ))}
          </View>
        </Section>

        <PixelText size={8} color={COLORS.textDim} style={{ textAlign: 'center', marginTop: 16 }}>
          ⓘ Zero PNGs · 0 KB bundle cost · 100% scalable / GPU-friendly SVG
        </PixelText>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <PixelText size={10} color={COLORS.neonCyan} bold style={{ marginBottom: 8 }}>{title}</PixelText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04040a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.neonCyan,
    backgroundColor: 'rgba(8,10,24,0.92)',
  },
  section: {
    marginBottom: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(6,8,20,0.6)',
  },
  demoStreet: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    alignSelf: 'center',
    boxShadow: '0 0 18px rgba(0,240,255,0.35)',
  } as any,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  propGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  propCell: {
    alignItems: 'center',
    width: 70,
  },
  propBg: {
    backgroundColor: CYBER.pavement1,
    padding: 4,
    borderWidth: 1,
    borderColor: CYBER.pavement0,
  },
  swatch: {
    width: 50,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  swatchLabel: { textShadowColor: '#000', textShadowRadius: 2 } as any,
});
