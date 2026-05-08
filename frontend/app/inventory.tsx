import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ITEMS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useGame } from '../src/contexts/GameContext';

export default function InventoryScreen() {
  const { state, equip, applyHeal, removeItem, saveToServer } = useGame();
  if (!state) return null;
  const player = state.player;

  const equippedW = ITEMS[player.equipped.weapon];
  const equippedA = ITEMS[player.equipped.armor];

  const onUseOrEquip = async (id: string) => {
    const item = ITEMS[id];
    if (!item) return;
    if (item.type === 'weapon') equip('weapon', id);
    else if (item.type === 'armor') equip('armor', id);
    else if (item.type === 'consumable') {
      if (item.effect?.hp) applyHeal(item.effect.hp);
      removeItem(id, 1);
    }
    await saveToServer();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.textDim}>{'> NEURAL_INVENTORY_'}</PixelText>
        <PixelText size={22} color={COLORS.neonCyan} glow bold>EQUIP</PixelText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.slot}>
          <PixelText size={10} color={COLORS.textDim}>WEAPON</PixelText>
          <PixelText size={14} color={COLORS.neonRed} bold>{equippedW?.name.toUpperCase() || 'NONE'}</PixelText>
          <PixelText size={9} color={COLORS.text}>+{equippedW?.effect?.atk || 0} ATK</PixelText>
        </View>
        <View style={styles.slot}>
          <PixelText size={10} color={COLORS.textDim}>ARMOR</PixelText>
          <PixelText size={14} color={COLORS.neonCyan} bold>{equippedA?.name.toUpperCase() || 'NONE'}</PixelText>
          <PixelText size={9} color={COLORS.text}>+{equippedA?.effect?.def || 0} DEF</PixelText>
        </View>

        <View style={styles.totals}>
          <PixelText size={10} color={COLORS.textDim}>TOTAL</PixelText>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <PixelText size={11} color={COLORS.neonRed} bold>ATK {player.atk}</PixelText>
            <PixelText size={11} color={COLORS.neonCyan} bold>DEF {player.def}</PixelText>
            <PixelText size={11} color={COLORS.neonYellow} bold>SPD {player.spd}</PixelText>
          </View>
        </View>

        <PixelText size={11} color={COLORS.neonYellow} bold style={{ marginTop: 16 }}>BACKPACK</PixelText>
        {player.inventory.length === 0 && (
          <PixelText size={11} color={COLORS.textDim} style={{ marginTop: 8 }}>No items.</PixelText>
        )}
        {player.inventory.map((inv) => {
          const item = ITEMS[inv.id];
          if (!item) return null;
          const isEquipped = (player.equipped.weapon === inv.id || player.equipped.armor === inv.id);
          return (
            <TouchableOpacity
              key={inv.id}
              style={[styles.invItem, isEquipped && { borderColor: COLORS.neonGreen }]}
              onPress={() => onUseOrEquip(inv.id)}
              disabled={isEquipped}
              testID={`inv-${inv.id}`}
            >
              <View style={[styles.iconBox, { backgroundColor: item.type === 'weapon' ? COLORS.neonRed : item.type === 'armor' ? COLORS.neonCyan : COLORS.neonGreen }]}>
                <PixelText size={10} color="#000" bold>{item.icon}</PixelText>
              </View>
              <View style={{ flex: 1 }}>
                <PixelText size={12} color={COLORS.text} bold>{item.name.toUpperCase()}</PixelText>
                <PixelText size={9} color={COLORS.textDim}>{item.desc}</PixelText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <PixelText size={11} color={COLORS.neonYellow} bold>x{inv.qty}</PixelText>
                <PixelText size={9} color={isEquipped ? COLORS.neonGreen : COLORS.text}>
                  {isEquipped ? 'EQUIPPED' : item.type === 'consumable' ? 'USE' : 'EQUIP'}
                </PixelText>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PixelButton title="◀ BACK" onPress={() => router.back()} color={COLORS.neonCyan} full size="lg" testID="inv-back" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderHi },
  scroll: { padding: 16 },
  slot: {
    backgroundColor: COLORS.panel, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 8,
  },
  totals: {
    backgroundColor: COLORS.panelLight, padding: 12,
    borderWidth: 1, borderColor: COLORS.borderHi,
    marginTop: 8,
  },
  invItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.panel, padding: 10,
    marginVertical: 4,
  },
  iconBox: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000' },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
});
