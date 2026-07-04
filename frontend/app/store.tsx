import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ITEMS, STORE_ITEMS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';

export default function StoreScreen() {
  const { state, addGold, addItem, saveToServer } = useGame();
  const [feedback, setFeedback] = useState('');

  if (!state) return null;
  const player = state.player;

  const buy = async (id: string) => {
    const item = ITEMS[id];
    if (!item || (item.cost ?? 0) > player.gold) {
      sfx.cancel();
      setFeedback('NOT ENOUGH CREDITS');
      setTimeout(() => setFeedback(''), 1500);
      return;
    }
    sfx.buy();
    addGold(-(item.cost || 0));
    addItem(id, 1);
    setFeedback(`+${item.name}`);
    setTimeout(() => setFeedback(''), 1200);
    await saveToServer();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.textDim}>{'> NEXUS_TECH_LAB_'}</PixelText>
        <View style={styles.headerRow}>
          <PixelText size={22} color={COLORS.neonYellow} glow bold>STORE</PixelText>
          <PixelText size={14} color={COLORS.neonYellow} bold>{player.gold}G</PixelText>
        </View>
        <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 4 }}>{'"Need an upgrade?" — Lyra'}</PixelText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {STORE_ITEMS.map((id) => {
          const item = ITEMS[id];
          const canAfford = player.gold >= (item.cost || 0);
          return (
            <View key={id} style={[styles.item, { borderColor: canAfford ? COLORS.borderHi : COLORS.border, opacity: canAfford ? 1 : 0.6 }]}>
              <View style={[styles.iconBox, { backgroundColor: item.type === 'weapon' ? COLORS.neonRed : item.type === 'armor' ? COLORS.neonCyan : COLORS.neonGreen }]}>
                <PixelText size={11} color="#000" bold>{item.icon}</PixelText>
              </View>
              <View style={{ flex: 1 }}>
                <PixelText size={12} color={COLORS.text} bold>{item.name.toUpperCase()}</PixelText>
                <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 2 }}>{item.desc}</PixelText>
                <PixelText size={9} color={COLORS.neonGreen} style={{ marginTop: 4 }}>
                  {item.type.toUpperCase()}{item.effect?.atk ? ` · +${item.effect.atk} ATK` : ''}{item.effect?.def ? ` · +${item.effect.def} DEF` : ''}
                </PixelText>
              </View>
              <TouchableOpacity
                style={[styles.buyBtn, { borderColor: canAfford ? COLORS.neonYellow : COLORS.border }]}
                onPress={() => buy(id)}
                disabled={!canAfford}
                testID={`store-buy-${id}`}
              >
                <PixelText size={11} color={COLORS.neonYellow} bold>{item.cost}G</PixelText>
                <PixelText size={9} color={COLORS.text}>BUY</PixelText>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {feedback ? (
        <View style={styles.toast}>
          <PixelText size={12} color={COLORS.neonGreen} bold glow>{feedback}</PixelText>
        </View>
      ) : null}

      <View style={styles.footer}>
        <PixelButton title="INVENTORY" onPress={() => router.push('/inventory')} color={COLORS.neonCyan} full />
        <View style={{ height: 8 }} />
        <PixelButton title="◀ EXIT STORE" onPress={() => router.back()} color={COLORS.textDim} full size="lg" testID="store-back" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderHi },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  scroll: { padding: 16, gap: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, padding: 10,
    backgroundColor: COLORS.panel,
  },
  iconBox: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
  },
  buyBtn: {
    borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center', minWidth: 60,
  },
  toast: {
    position: 'absolute', top: 100, alignSelf: 'center',
    backgroundColor: 'rgba(10,10,20,0.95)',
    borderWidth: 1, borderColor: COLORS.neonGreen,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
});
