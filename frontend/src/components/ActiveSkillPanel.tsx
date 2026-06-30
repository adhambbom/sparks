import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { COLORS, ABILITIES } from '../data/gameData';
import { ABILITY_ICONS, DEFAULT_ABILITY_ICON } from '../data/iconData';
import { PixelText } from './PixelText';
import { sfx } from '../utils/audio';

type Props = {
  visible: boolean;
  onClose: () => void;
  abilities: string[];
  playerName: string;
  level: number;
  syncLevel: number;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  xp: number; xpToNext: number;
  gold: number;
};

export function ActiveSkillPanel(p: Props) {
  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose}>
      <TouchableOpacity activeOpacity={1} onPress={p.onClose} style={styles.backdrop}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <PixelText size={14} color={COLORS.neonCyan} bold>{p.playerName.toUpperCase()}</PixelText>
              <PixelText size={9} color={COLORS.textDim}>LV {p.level} · SYNC {p.syncLevel}</PixelText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <PixelText size={11} color={COLORS.neonYellow} bold>{p.gold}G</PixelText>
              <PixelText size={9} color={COLORS.xp}>XP {p.xp}/{p.xpToNext}</PixelText>
            </View>
          </View>

          {/* Bars */}
          <View style={styles.barRow}>
            <PixelText size={9} color={COLORS.hp} bold style={{ width: 22 }}>HP</PixelText>
            <View style={[styles.bar, { backgroundColor: COLORS.hpBg, borderColor: COLORS.hp }]}>
              <View style={{ width: `${(p.hp / p.maxHp) * 100}%`, height: '100%', backgroundColor: COLORS.hp }} />
            </View>
            <PixelText size={9} color={COLORS.text} style={{ width: 60, textAlign: 'right' }}>{p.hp}/{p.maxHp}</PixelText>
          </View>
          <View style={styles.barRow}>
            <PixelText size={9} color={COLORS.mp} bold style={{ width: 22 }}>MP</PixelText>
            <View style={[styles.bar, { backgroundColor: COLORS.mpBg, borderColor: COLORS.mp }]}>
              <View style={{ width: `${(p.mp / p.maxMp) * 100}%`, height: '100%', backgroundColor: COLORS.mp }} />
            </View>
            <PixelText size={9} color={COLORS.text} style={{ width: 60, textAlign: 'right' }}>{p.mp}/{p.maxMp}</PixelText>
          </View>

          <View style={styles.divider} />

          <PixelText size={10} color={COLORS.neonMagenta} bold style={{ marginBottom: 8 }}>
            ◆ ACTIVE ABILITIES
          </PixelText>

          {/* Skill grid */}
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.grid}>
            {p.abilities.map((id) => {
              const ab = ABILITIES[id];
              if (!ab) return null;
              const icon = ABILITY_ICONS[id] || DEFAULT_ABILITY_ICON;
              return (
                <View key={id} style={[styles.skillCard, { borderColor: icon.border }]} testID={`skill-card-${id}`}>
                  <View style={[styles.iconBox, { backgroundColor: icon.bg, borderColor: icon.border }]}>
                    <PixelText size={22} color={icon.border} glow bold>{icon.glyph}</PixelText>
                  </View>
                  <PixelText size={10} color={COLORS.text} bold style={{ marginTop: 4, textAlign: 'center' }}>
                    {ab.name.toUpperCase()}
                  </PixelText>
                  <View style={styles.skillMeta}>
                    <PixelText size={8} color={COLORS.mp}>MP {ab.cost}</PixelText>
                    <PixelText size={8} color={COLORS.textDim}>LV {ab.reqLevel}</PixelText>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <PixelText size={9} color={COLORS.textDim}>TAP OUTSIDE TO CLOSE</PixelText>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 12 },
  panel: {
    backgroundColor: 'rgba(10,10,20,0.96)',
    borderWidth: 2, borderColor: COLORS.neonCyan,
    padding: 12,
    maxWidth: 420, alignSelf: 'center', width: '100%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: 6 },
  bar: { flex: 1, height: 12, borderWidth: 1, padding: 1, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' },
  skillCard: {
    width: '31%',
    borderWidth: 2,
    backgroundColor: 'rgba(20,20,40,0.8)',
    padding: 6,
    alignItems: 'center',
  },
  iconBox: {
    width: 44, height: 44,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  skillMeta: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 3 },
  footer: { alignItems: 'center', marginTop: 8 },
});
