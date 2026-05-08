import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENEMIES, ABILITIES, ITEMS, HOUSES, Element } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { StatBar } from '../src/components/StatBar';
import { Sprite } from '../src/components/Sprite';
import { useGame } from '../src/contexts/GameContext';

type ActionPanel = 'main' | 'skills' | 'items';

const { width: SW } = Dimensions.get('window');

export default function CombatScreen() {
  const params = useLocalSearchParams<{ enemyId: string; mode?: string; arenaWave?: string }>();
  const { state, applyDamage, applyHeal, applyMpCost, awardXp, addGold, addItem, removeItem, saveToServer } = useGame();
  const [enemyId] = useState<string>(params.enemyId || 'spider_bot');
  const enemyData = ENEMIES[enemyId];
  const [enemyHp, setEnemyHp] = useState(enemyData?.hp || 30);
  const [enemyAtk, setEnemyAtk] = useState(enemyData?.atk || 5);
  const [enemyAbilities, setEnemyAbilities] = useState<string[]>(enemyData?.abilities || ['power_strike']);
  const [phaseChanged, setPhaseChanged] = useState(false);
  const [phaseFlash, setPhaseFlash] = useState(false);
  const [log, setLog] = useState<string[]>([
    enemyData?.isBoss ? `⚠ BOSS: ${enemyData?.name} appears!` : `A wild ${enemyData?.name} appears!`,
  ]);
  const [panel, setPanel] = useState<ActionPanel>('main');
  const [turn, setTurn] = useState<'player' | 'enemy' | 'end'>('player');
  const [busy, setBusy] = useState(false);
  const [shield, setShield] = useState(false); // player has data shield
  const [enemyBurn, setEnemyBurn] = useState(0); // burn turns
  const [haste, setHaste] = useState(false);
  const enemyShake = useRef(new Animated.Value(0)).current;
  const playerShake = useRef(new Animated.Value(0)).current;
  const [floaters, setFloaters] = useState<{ id: number; text: string; color: string; side: 'p' | 'e' }[]>([]);
  const flId = useRef(0);

  if (!state || !enemyData) {
    return (
      <SafeAreaView style={styles.container}>
        <PixelText color={COLORS.text}>Loading...</PixelText>
      </SafeAreaView>
    );
  }
  const player = state.player;

  // Determine first turn based on speed + boss intro SFX
  useEffect(() => {
    if (enemyData?.isBoss) sfx.bossPhase(); else sfx.encounter();
    if (player.spd < enemyData.spd) {
      setTimeout(() => enemyTurn(), 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boss phase change check - triggers once at 50% HP
  useEffect(() => {
    if (!enemyData?.isBoss || phaseChanged) return;
    if (enemyHp > 0 && enemyHp <= enemyData.hp * 0.5) {
      setPhaseChanged(true);
      setPhaseFlash(true);
      sfx.bossPhase();
      setEnemyAtk(Math.floor(enemyData.atk * 1.5));
      if (enemyData.phaseAbilities) setEnemyAbilities(enemyData.phaseAbilities);
      pushLog(`⚠ ${enemyData.name} ENRAGES! ATK +50%`);
      if (enemyData.phaseQuote) pushLog(`"${enemyData.phaseQuote}"`);
      setTimeout(() => setPhaseFlash(false), 1500);
    }
  }, [enemyHp, enemyData, phaseChanged]);

  // ----- helpers -----
  const pushLog = (s: string) => setLog((l) => [...l.slice(-3), s]);
  const showFloater = (text: string, color: string, side: 'p' | 'e') => {
    const id = ++flId.current;
    setFloaters((f) => [...f, { id, text, color, side }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
  };
  const shakeAnim = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const elementMod = (atkEl: Element): number => {
    if (enemyData.weakness === atkEl) return 1.6;
    if (enemyData.resist === atkEl) return 0.5;
    return 1.0;
  };

  const computeDamage = (basePower: number, element: Element, atkStat: number, defStat: number): number => {
    const variance = 0.85 + Math.random() * 0.3;
    const raw = Math.max(1, Math.floor((atkStat * basePower - defStat * 0.5) * variance * elementMod(element)));
    return Math.max(1, raw);
  };

  // ----- player actions -----
  const playerAttack = () => {
    if (busy) return;
    setBusy(true);
    sfx.hit();
    const dmg = computeDamage(1.0, 'physical', player.atk, enemyData.def);
    setEnemyHp((hp) => Math.max(0, hp - dmg));
    showFloater(`-${dmg}`, COLORS.neonYellow, 'e');
    shakeAnim(enemyShake);
    pushLog(`${player.name} strikes for ${dmg}!`);
    setTimeout(() => endPlayerTurn(), 700);
  };

  const playerSkill = (id: string) => {
    if (busy) return;
    const ab = ABILITIES[id];
    if (!ab) return;
    if (player.mp < ab.cost) {
      pushLog('Not enough MP!');
      return;
    }
    setBusy(true);
    applyMpCost(ab.cost);
    if (ab.type === 'attack') {
      sfx.bigHit();
      let dmg = computeDamage(ab.power, ab.element, player.atk, enemyData.def);
      setEnemyHp((hp) => Math.max(0, hp - dmg));
      showFloater(`-${dmg}`, COLORS.neonCyan, 'e');
      shakeAnim(enemyShake);
      pushLog(`${ab.name}! ${dmg} damage.`);
      if (ab.effect === 'burn') setEnemyBurn(3);
      if (ab.effect === 'drain') {
        applyHeal(Math.floor(dmg * 0.3));
        showFloater(`+${Math.floor(dmg * 0.3)}`, COLORS.neonGreen, 'p');
      }
    } else if (ab.type === 'heal') {
      sfx.heal();
      applyHeal(ab.power);
      showFloater(`+${ab.power}`, COLORS.neonGreen, 'p');
      pushLog(`${ab.name}! Restored ${ab.power} HP.`);
    } else if (ab.type === 'buff') {
      sfx.skill();
      if (ab.effect === 'shield') { setShield(true); pushLog('Data Shield up! 50% reduction.'); }
      if (ab.effect === 'haste') { setHaste(true); pushLog('Phase Step! Speed surge.'); }
      if (ab.effect === 'cleanse') {
        setHaste(true);
        pushLog('Time warp! Cleansed and hastened.');
      }
    }
    setPanel('main');
    setTimeout(() => endPlayerTurn(), 800);
  };

  const playerItem = (itemId: string) => {
    if (busy) return;
    const item = ITEMS[itemId];
    if (!item) return;
    setBusy(true);
    if (item.effect?.hp) { applyHeal(item.effect.hp); showFloater(`+${item.effect.hp}`, COLORS.neonGreen, 'p'); pushLog(`Used ${item.name}!`); }
    if (item.effect?.mp) {
      const amt = item.effect.mp;
      if (state) {
        // direct mp restore
        const cur = state.player.mp;
        applyMpCost(-Math.min(amt, state.player.maxMp - cur)); // negative cost = gain
      }
      pushLog(`Used ${item.name}!`);
    }
    removeItem(itemId, 1);
    setPanel('main');
    setTimeout(() => endPlayerTurn(), 600);
  };

  const playerRun = () => {
    if (busy) return;
    if (params.mode === 'arena') {
      pushLog('No retreat from the arena!');
      sfx.cancel();
      return;
    }
    if (enemyData.isBoss) {
      pushLog('No retreat from a boss!');
      sfx.cancel();
      return;
    }
    const succeed = Math.random() < 0.6 + (player.spd - enemyData.spd) * 0.04;
    if (succeed) {
      sfx.confirm();
      pushLog('Got away safely.');
      setTimeout(() => router.back(), 700);
    } else {
      setBusy(true);
      sfx.cancel();
      pushLog('Failed to escape!');
      setTimeout(() => endPlayerTurn(), 700);
    }
  };

  const endPlayerTurn = () => {
    // Burn DOT
    if (enemyBurn > 0 && enemyHp > 0) {
      const dot = Math.max(2, Math.floor(player.atk * 0.3));
      setEnemyHp((hp) => Math.max(0, hp - dot));
      showFloater(`-${dot}🔥`, '#ff8000', 'e');
      pushLog(`Burn deals ${dot}!`);
      setEnemyBurn((b) => b - 1);
    }
    setTimeout(() => {
      if (enemyHp <= 0) { onVictory(); return; }
      // If haste, player goes again
      if (haste) {
        setHaste(false);
        pushLog('Phase warp! Extra turn.');
        setBusy(false);
        setTurn('player');
        return;
      }
      enemyTurn();
    }, 200);
  };

  const enemyTurn = () => {
    setTurn('enemy');
    setBusy(true);
    setTimeout(() => {
      const abId = enemyAbilities[Math.floor(Math.random() * enemyAbilities.length)];
      const ab = ABILITIES[abId];
      let dmg = 0;
      if (ab && ab.type === 'attack') {
        dmg = computeDamage(ab.power, ab.element, enemyAtk, player.def);
        if (shield) { dmg = Math.floor(dmg * 0.5); setShield(false); pushLog('Shield absorbs!'); }
        applyDamage(dmg);
        sfx.damage();
        showFloater(`-${dmg}`, COLORS.neonRed, 'p');
        shakeAnim(playerShake);
        pushLog(`${enemyData.name} ${ab.name}! ${dmg} dmg.`);
      } else {
        dmg = computeDamage(1.0, 'physical', enemyAtk, player.def);
        if (shield) { dmg = Math.floor(dmg * 0.5); setShield(false); }
        applyDamage(dmg);
        sfx.damage();
        showFloater(`-${dmg}`, COLORS.neonRed, 'p');
        shakeAnim(playerShake);
        pushLog(`${enemyData.name} attacks for ${dmg}!`);
      }
      setTimeout(() => {
        // Check player death
        if (state && state.player.hp - dmg <= 0) {
          onDefeat();
          return;
        }
        setBusy(false);
        setTurn('player');
      }, 600);
    }, 700);
  };

  // ----- end states -----
  const onVictory = async () => {
    setTurn('end');
    sfx.victory();
    pushLog(`Victory! +${enemyData.xp} XP, +${enemyData.gold}G`);
    addGold(enemyData.gold);
    const leveled = awardXp(enemyData.xp);
    if (leveled) { sfx.levelUp(); pushLog('LEVEL UP! +1 Skill Point.'); }
    // Drops
    const drops: string[] = [];
    enemyData.drops?.forEach((d) => {
      if (Math.random() < d.chance) {
        addItem(d.itemId, 1);
        drops.push(ITEMS[d.itemId]?.name || d.itemId);
      }
    });
    if (drops.length) pushLog(`Loot: ${drops.join(', ')}`);
    await saveToServer();
    setTimeout(() => {
      if (params.mode === 'arena') {
        router.replace({ pathname: '/arena', params: { wave: params.arenaWave || '1', result: 'win' } });
      } else {
        router.back();
      }
    }, 1500);
  };

  const onDefeat = async () => {
    setTurn('end');
    sfx.defeat();
    pushLog('You collapsed...');
    setTimeout(() => router.replace('/gameover'), 1200);
  };

  // ----- render -----
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background */}
      <View style={styles.bgGrid} />

      {/* Battle stage */}
      <View style={styles.stage}>
        {/* Phase change flash */}
        {phaseFlash && <View style={styles.phaseFlash} pointerEvents="none" />}

        {/* Enemy */}
        <Animated.View style={[styles.enemyBox, { transform: [{ translateX: enemyShake }] }]}>
          <View style={styles.enemyHeaderRow}>
            <PixelText size={14} color={enemyData.isBoss ? COLORS.neonMagenta : COLORS.neonRed} bold glow={enemyData.isBoss}>
              {enemyData.isBoss ? '⚠ ' : ''}{enemyData.name.toUpperCase()}{phaseChanged ? ' [ENRAGED]' : ''}
            </PixelText>
          </View>
          <PixelText size={9} color={COLORS.textDim}>
            TIER {enemyData.tier} · SPD {enemyData.spd}{enemyData.isBoss ? ' · BOSS' : ''}
          </PixelText>
          <View style={{ marginTop: 6 }}>
            <StatBar value={enemyHp} max={enemyData.hp} color={enemyData.isBoss ? COLORS.neonMagenta : COLORS.hp} bgColor={COLORS.hpBg} width={240} height={10} showText={false} />
          </View>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            <Sprite index={enemyData.spriteIndex} size={140} glow={enemyData.isBoss} />
          </View>
          {floaters.filter(f => f.side === 'e').map(f => (
            <View key={f.id} style={styles.floater}>
              <PixelText size={20} color={f.color} bold glow>{f.text}</PixelText>
            </View>
          ))}
        </Animated.View>

        {/* Player */}
        <Animated.View style={[styles.playerBox, { transform: [{ translateX: playerShake }] }]}>
          <View style={styles.playerSprite}>
            <View style={styles.playerHead} />
            <View style={[styles.playerBody, { backgroundColor: HOUSES?.[(player.house as any) || 'obsidian']?.color || COLORS.neonCyan }, shield && styles.playerShielded]} />
          </View>
          {floaters.filter(f => f.side === 'p').map(f => (
            <View key={f.id} style={styles.floaterP}>
              <PixelText size={18} color={f.color} bold glow>{f.text}</PixelText>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Log */}
      <View style={styles.logBox}>
        {log.slice(-3).map((l, i) => (
          <PixelText key={i} size={11} color={i === log.length - 1 ? COLORS.text : COLORS.textDim}>
            {l}
          </PixelText>
        ))}
      </View>

      {/* Bottom HUD with player bars + actions */}
      <View style={styles.bottomHud}>
        <View style={styles.statRow}>
          <View style={{ flex: 1 }}>
            <PixelText size={11} color={COLORS.neonCyan} bold>{player.name.toUpperCase()} · LV {player.level}</PixelText>
            <View style={{ height: 4 }} />
            <StatBar value={player.hp} max={player.maxHp} color={COLORS.hp} bgColor={COLORS.hpBg} width={150} height={9} />
            <View style={{ height: 4 }} />
            <StatBar value={player.mp} max={player.maxMp} color={COLORS.mp} bgColor={COLORS.mpBg} width={150} height={9} />
          </View>
          <View style={styles.statusIcons}>
            {shield && <PixelText size={10} color={COLORS.neonCyan} bold>◇SHIELD</PixelText>}
            {haste && <PixelText size={10} color={COLORS.neonMagenta} bold>»HASTE</PixelText>}
            {enemyBurn > 0 && <PixelText size={10} color="#ff8000" bold>🔥{enemyBurn}</PixelText>}
          </View>
        </View>

        {turn === 'player' && !busy && panel === 'main' && (
          <View style={styles.actionGrid}>
            <PixelButton title="ATTACK" onPress={playerAttack} color={COLORS.neonRed} testID="combat-attack" />
            <PixelButton title="SKILL" onPress={() => setPanel('skills')} color={COLORS.neonCyan} testID="combat-skill" />
            <PixelButton title="ITEM" onPress={() => setPanel('items')} color={COLORS.neonGreen} testID="combat-item" />
            <PixelButton title="RUN" onPress={playerRun} color={COLORS.textDim} testID="combat-run" />
          </View>
        )}

        {panel === 'skills' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
            {player.abilities.map((id) => {
              const ab = ABILITIES[id];
              if (!ab) return null;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.skillBtn, { borderColor: COLORS.neonCyan, opacity: player.mp < ab.cost ? 0.4 : 1 }]}
                  disabled={player.mp < ab.cost}
                  onPress={() => playerSkill(id)}
                  testID={`combat-skill-${id}`}
                >
                  <PixelText size={11} color={COLORS.neonCyan} bold>{ab.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>MP {ab.cost}</PixelText>
                  <PixelText size={9} color={COLORS.text} style={{ marginTop: 3 }}>{ab.desc}</PixelText>
                </TouchableOpacity>
              );
            })}
            <PixelButton title="✕" onPress={() => setPanel('main')} color={COLORS.textDim} size="sm" />
          </ScrollView>
        )}

        {panel === 'items' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
            {player.inventory.filter(i => ITEMS[i.id]?.type === 'consumable').map((inv) => {
              const it = ITEMS[inv.id];
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.skillBtn, { borderColor: COLORS.neonGreen }]}
                  onPress={() => playerItem(inv.id)}
                  testID={`combat-item-${inv.id}`}
                >
                  <PixelText size={11} color={COLORS.neonGreen} bold>{it.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>x{inv.qty}</PixelText>
                  <PixelText size={9} color={COLORS.text} style={{ marginTop: 3 }}>{it.desc}</PixelText>
                </TouchableOpacity>
              );
            })}
            {player.inventory.filter(i => ITEMS[i.id]?.type === 'consumable').length === 0 && (
              <PixelText size={11} color={COLORS.textDim}>No usable items.</PixelText>
            )}
            <PixelButton title="✕" onPress={() => setPanel('main')} color={COLORS.textDim} size="sm" />
          </ScrollView>
        )}

        {(turn === 'enemy' || busy) && turn !== 'end' && (
          <View style={{ alignItems: 'center', padding: 12 }}>
            <PixelText size={12} color={COLORS.neonYellow} glow>...</PixelText>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  bgGrid: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.bgDark,
  },
  stage: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  enemyBox: { alignItems: 'center', minHeight: 240 },
  enemyHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  phaseFlash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,45,212,0.25)',
    zIndex: 10,
  },
  playerBox: {
    alignItems: 'flex-start',
    paddingLeft: 24,
    marginTop: -40,
  },
  playerSprite: { width: 60, height: 80, alignItems: 'center' },
  playerHead: { width: 24, height: 24, backgroundColor: '#ffd5b3', borderWidth: 2, borderColor: '#000' },
  playerBody: { width: 36, height: 36, backgroundColor: COLORS.neonCyan, borderWidth: 2, borderColor: '#000', marginTop: -1 },
  playerShielded: { borderColor: COLORS.neonCyan, shadowColor: COLORS.neonCyan, shadowOpacity: 1, shadowRadius: 12 },
  floater: { position: 'absolute', top: 30, alignSelf: 'center' },
  floaterP: { position: 'absolute', top: -10, left: 50 },
  logBox: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(10,10,20,0.85)',
    borderWidth: 1, borderColor: COLORS.borderHi,
    padding: 8, minHeight: 60,
  },
  bottomHud: {
    backgroundColor: COLORS.panel,
    borderTopWidth: 2, borderTopColor: COLORS.neonCyan,
    padding: 12,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusIcons: { gap: 2, alignItems: 'flex-end' },
  actionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    justifyContent: 'space-between',
  },
  skillsRow: { gap: 8, paddingVertical: 6 },
  skillBtn: {
    backgroundColor: 'rgba(10,10,20,0.9)',
    borderWidth: 2, padding: 10,
    minWidth: 130, maxWidth: 150,
  },
});
