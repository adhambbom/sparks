import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENEMIES, ABILITIES, ITEMS, Element, SPRITE_ASSETS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { StatBar } from '../src/components/StatBar';
import WalkingLegs from '../src/components/WalkingLegs';
import Floater from '../src/components/Floater';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';

type ActionPanel = 'main' | 'skills' | 'items';

const { width: SW } = Dimensions.get('window');

// ----- Enemy sprite picker -----
// We have two production PNGs (Scout & Juggernaut). Map every enemy to whichever
// archetype best fits, so combat visuals match the overworld aesthetic.
function getEnemySpriteUri(
  enemyId: string,
  e: { spd: number; def: number; hp: number; isBoss?: boolean },
): string {
  const SCOUT = SPRITE_ASSETS.enemyScout;
  const JUGGER = SPRITE_ASSETS.enemyJuggernaut;
  const overrides: Record<string, string> = {
    // Light / fast
    spider_bot: SCOUT,
    tinkerer_drone: SCOUT,
    tesla_drone: SCOUT,
    laser_wasp: SCOUT,
    crawler_fly: SCOUT,
    data_ghost: SCOUT,
    hover_sentry: SCOUT,
    clockwork_beast: SCOUT,
    bio_lizard: SCOUT,
    plasma_brain: SCOUT,
    neuro_crab: SCOUT,
    // Heavy / armored / bosses
    gear_golem: JUGGER,
    scrap_collector: JUGGER,
    piston_ogre: JUGGER,
    steam_mutant: JUGGER,
    armored_centipede: JUGGER,
    mutant_assembler: JUGGER,
    core_keeper: JUGGER,
    glitch_avatar: JUGGER,
    glitch_final: JUGGER,
    tentacle_mech: JUGGER,
    crawler_chimaera: JUGGER,
    multi_gynoid: JUGGER,
    spike_mutant: JUGGER,
    bio_serpent: JUGGER,
    generator_kin: JUGGER,
  };
  if (overrides[enemyId]) return overrides[enemyId];
  // Fallback heuristic
  if (e.isBoss || e.def >= 9 || e.hp >= 80) return JUGGER;
  return SCOUT;
}

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
  const [animTick, setAnimTick] = useState(0);
  // 10 fps tick drives the enemy breathing animation
  useEffect(() => {
    const id = setInterval(() => setAnimTick((t) => (t + 1) % 1024), 100);
    return () => clearInterval(id);
  }, []);

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

          {/* Hi-res PNG sprite + drop shadow + subtle idle bob.
              Boss enemies get a magenta glow ring; normal enemies use a dark elliptical ground shadow. */}
          <View style={styles.enemySpriteWrap}>
            {/* Ground shadow */}
            <View style={[
              styles.groundShadow,
              { width: enemyData.isBoss ? 130 : 110 },
            ]} pointerEvents="none" />
            {/* Sprite (idle bob) */}
            <Animated.View
              style={{
                transform: [{ translateY: Math.sin(animTick * 0.35) * 3 }],
              }}
            >
              <View style={[
                styles.enemySpriteBox,
                enemyData.isBoss && styles.enemySpriteBoxBoss,
                { width: enemyData.isBoss ? 180 : 156, height: enemyData.isBoss ? 180 : 156 },
              ]}>
                <Image
                  source={{ uri: getEnemySpriteUri(enemyId, enemyData) }}
                  style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* Animated rising damage numbers (centered above the enemy sprite) */}
            <View style={styles.floaterEAnchor} pointerEvents="none">
              {floaters.filter(f => f.side === 'e').map(f => (
                <Floater key={f.id} text={f.text} color={f.color} size={24} />
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Player — same identity as overworld: ADHAMB sprite + procedural legs.
            Scaled larger and mirrored horizontally so he faces the enemy on the right. */}
        <Animated.View style={[styles.playerBox, { transform: [{ translateX: playerShake }] }]}>
          <View style={styles.playerSprite}>
            {/* Ground shadow */}
            <View style={styles.playerGroundShadow} pointerEvents="none" />
            {/* Body (top 70%) — clipped + horizontally flipped so ADHAMB faces right toward the enemy.
                Subtle idle bob synced with the same animTick as the enemy. */}
            <Animated.View
              style={{
                transform: [{ translateY: Math.sin(animTick * 0.35 + Math.PI) * 2.5 }],
              }}
            >
              <View style={{ width: 110, height: 110, overflow: 'hidden' }}>
                <Image
                  source={{ uri: SPRITE_ASSETS.player }}
                  style={{
                    width: 110,
                    height: 158,
                    backgroundColor: 'transparent',
                    transform: [{ scaleX: -1 }],   // mirror so he faces the enemy
                  }}
                  resizeMode="contain"
                />
              </View>
              {/* Procedural human legs in idle combat-stance (frame 0 = both planted) */}
              <View style={{ position: 'absolute', left: 0, top: 100, width: 110, height: 60 }}>
                <WalkingLegs width={110} height={60} frame={0} style="human" />
              </View>
            </Animated.View>
            {/* Optional translucent shield aura when shield buff is up */}
            {shield && <View style={[styles.playerShielded, { width: 120, height: 170 }]} pointerEvents="none" />}
          </View>
          {/* Animated rising damage / heal numbers above the player */}
          <View style={styles.floaterPAnchor} pointerEvents="none">
            {floaters.filter(f => f.side === 'p').map(f => (
              <Floater key={f.id} text={f.text} color={f.color} size={20} />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Battle log — slim 2-line overlay just above the bottom HUD so it never crowds the stage. */}
      <View style={styles.logBox} pointerEvents="none">
        {log.slice(-2).map((l, i, arr) => (
          <PixelText
            key={`${i}-${l}`}
            size={10}
            color={i === arr.length - 1 ? COLORS.text : COLORS.textDim}
            numberOfLines={1}
          >
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
  // Wraps the enemy sprite + ground shadow together; positions the floater anchor.
  enemySpriteWrap: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  enemySpriteBox: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemySpriteBoxBoss: {
    // Subtle magenta glow ring for boss enemies
    shadowColor: COLORS.neonMagenta,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  // Dark elliptical ground shadow under each enemy sprite
  groundShadow: {
    position: 'absolute',
    bottom: -2,
    height: 14,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignSelf: 'center',
  },
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
  playerSprite: {
    width: 130,
    height: 170,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  playerGroundShadow: {
    position: 'absolute',
    bottom: 4,
    width: 90,
    height: 12,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignSelf: 'center',
  },
  playerHead: { width: 24, height: 24, backgroundColor: '#ffd5b3', borderWidth: 2, borderColor: '#000' },
  playerBody: { width: 36, height: 36, backgroundColor: COLORS.neonCyan, borderWidth: 2, borderColor: '#000', marginTop: -1 },
  playerShielded: { borderColor: COLORS.neonCyan, shadowColor: COLORS.neonCyan, shadowOpacity: 1, shadowRadius: 12 },

  // Anchors for the animated <Floater /> rising-numbers — positioned just above each target sprite.
  floaterEAnchor: {
    position: 'absolute',
    top: -4,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  floaterPAnchor: {
    position: 'absolute',
    top: -4,
    left: 0,
    width: 130,
    alignItems: 'center',
    zIndex: 50,
  },

  // Slim battle-log strip pinned just above the bottom HUD.
  logBox: {
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(10,10,20,0.72)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.neonCyan,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 30,
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
