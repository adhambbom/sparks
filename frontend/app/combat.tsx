import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENEMIES, ABILITIES, ITEMS, Element, SPRITE_ASSETS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { StatBar } from '../src/components/StatBar';
import Floater from '../src/components/Floater';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';
// ── Quantum Taming (modular extension) ────────────────────────────────
// These modules attach capture + minion-deploy behaviour without altering
// the existing turn loop or enemy logic.
import {
  rollQuarantine,
  buildCapturedMinion,
  SPIKE_MULTIPLIER,
  CapturedMinion,
} from '../src/systems/QuantumStorage';
import { executeMinionSkill, getMinionSkillView } from '../src/systems/TamedCombat';
import { resolveMinionSpriteUri, hasMinionSprite } from '../src/systems/DynamicMinionRenderer';
import { ENEMIES as _ENEMIES } from '../src/data/gameData';

/** Resolve the *deployed minion* sprite uri:
 *  1. Prefer the per-variant Quantum-Minion sheet (phreak/vrghost/mech) if mapped.
 *  2. Fallback to the species' boss/scout silhouette from the regular enemy
 *     atlas so legacy captures (e.g. tinkerer_drone, gear_golem) still SWAP
 *     the player sprite instead of silently falling back to ADHAMB.
 *  Returns null only when speciesId is completely unknown. */
function resolveDeployedMinionUri(speciesId: string): string | null {
  if (hasMinionSprite(speciesId)) return resolveMinionSpriteUri(speciesId);
  const e = (_ENEMIES as any)[speciesId];
  if (!e) return null;
  return e.isBoss || (e.tier ?? 1) >= 3
    ? SPRITE_ASSETS.enemyJuggernaut
    : SPRITE_ASSETS.enemyScout;
}

type ActionPanel = 'main' | 'skills' | 'items' | 'spikes' | 'minionDeploy' | 'minionSkills';

const { width: SW } = Dimensions.get('window');

// ----- Enemy sprite picker -----
// MUST match the overworld's rule exactly so the enemy you bumped into in
// game.tsx still looks the same in the battle screen:
//     overworld:   `roamer.boss ? Juggernaut : Scout`
// Combat receives the boss flag via the `boss` route param ('1' / '0'), with
// `enemyData.isBoss` (from the data file) used as a fallback for boss-tile
// encounters that don't go through the roamer system.
function getEnemySpriteUri(
  bossFromRoute: boolean,
  e: { id?: string; isBoss?: boolean },
): string {
  // Dynamic sprite lookup: if the enemy's id matches one of the Quantum
  // Minion species (phreak_1..mech_4), pull the matching sliced sprite
  // from the backend sheet instead of the legacy 2-sprite fallback.
  if (e?.id && hasMinionSprite(e.id)) {
    const uri = resolveMinionSpriteUri(e.id);
    if (uri) return uri;
  }
  return (bossFromRoute || e.isBoss) ? SPRITE_ASSETS.enemyJuggernaut : SPRITE_ASSETS.enemyScout;
}

export default function CombatScreen() {
  const params = useLocalSearchParams<{ enemyId: string; mode?: string; arenaWave?: string; boss?: string }>();
  // Did the overworld flag this encounter as a mini-boss roamer? If so we use
  // the Juggernaut sprite to match what was rendered in the castle screen.
  const bossFromRoute = params.boss === '1' || params.mode === 'boss';
  const { state, applyDamage, applyHeal, applyMpCost, awardXp, addGold, addItem, removeItem, saveToServer, addCapturedMinion, markSpeciesSeen } = useGame();
  const [enemyId] = useState<string>(params.enemyId || 'spider_bot');
  const enemyData = ENEMIES[enemyId];
  // Unified boss flag — true if either the data-file marks this enemy as a
  // boss OR the overworld passed boss=1 (mini-boss roamer / boss tile route).
  const isBoss = !!enemyData?.isBoss || bossFromRoute;
  const [enemyHp, setEnemyHp] = useState(enemyData?.hp || 30);
  const [enemyAtk, setEnemyAtk] = useState(enemyData?.atk || 5);
  const [enemyAbilities, setEnemyAbilities] = useState<string[]>(enemyData?.abilities || ['power_strike']);
  const [phaseChanged, setPhaseChanged] = useState(false);
  const [phaseFlash, setPhaseFlash] = useState(false);
  const [log, setLog] = useState<string[]>([
    isBoss ? `⚠ BOSS: ${enemyData?.name} appears!` : `A wild ${enemyData?.name} appears!`,
  ]);
  const [panel, setPanel] = useState<ActionPanel>('main');
  const [turn, setTurn] = useState<'player' | 'enemy' | 'end'>('player');
  const [busy, setBusy] = useState(false);
  const [shield, setShield] = useState(false); // player has data shield
  const [enemyBurn, setEnemyBurn] = useState(0); // burn turns
  const [haste, setHaste] = useState(false);
  // ── Quantum Taming state (additive — doesn't touch existing combat flow) ──
  // Active deployed minion: replaces the next player turn with minion skills.
  const [deployedMinion, setDeployedMinion] = useState<CapturedMinion | null>(null);
  // Per-battle DEF debuff from Data Leak (mirrors enemyBurn pattern).
  const [enemyDefDebuff, setEnemyDefDebuff] = useState(0); // turns remaining
  // Enemy stun (DDOS Overload) — when > 0, skip the enemy's next turn.
  const [enemyStun, setEnemyStun] = useState(0);
  // Self-buff: Firewall Spike grants +50% DEF for N turns.
  const [firewallTurns, setFirewallTurns] = useState(0);
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
    if (isBoss) sfx.bossPhase(); else sfx.encounter();
    if (player.spd < enemyData.spd) {
      setTimeout(() => enemyTurn(), 220);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boss phase change check - triggers once at 50% HP
  useEffect(() => {
    if (!isBoss || phaseChanged) return;
    if (enemyHp > 0 && enemyHp <= enemyData.hp * 0.5) {
      setPhaseChanged(true);
      setPhaseFlash(true);
      sfx.bossPhase();
      setEnemyAtk(Math.floor(enemyData.atk * 1.5));
      if (enemyData.phaseAbilities) setEnemyAbilities(enemyData.phaseAbilities);
      pushLog(`⚠ ${enemyData.name} ENRAGES! ATK +50%`);
      if (enemyData.phaseQuote) pushLog(`"${enemyData.phaseQuote}"`);
      setTimeout(() => setPhaseFlash(false), 750);
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
    setTimeout(() => endPlayerTurn(), 220);
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
    setTimeout(() => endPlayerTurn(), 260);
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
    setTimeout(() => endPlayerTurn(), 200);
  };

  // Mark species as encountered (for the Registry screen). Idempotent.
  useEffect(() => {
    if (enemyData?.id) markSpeciesSeen(enemyData.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerRun = () => {
    if (busy) return;
    if (params.mode === 'arena') {
      pushLog('No retreat from the arena!');
      sfx.cancel();
      return;
    }
    if (isBoss) {
      pushLog('No retreat from a boss!');
      sfx.cancel();
      return;
    }
    const succeed = Math.random() < 0.6 + (player.spd - enemyData.spd) * 0.04;
    if (succeed) {
      sfx.confirm();
      pushLog('Got away safely.');
      setTimeout(() => router.back(), 220);
    } else {
      setBusy(true);
      sfx.cancel();
      pushLog('Failed to escape!');
      setTimeout(() => endPlayerTurn(), 220);
    }
  };

  // ── Quantum Taming: QUARANTINE (spike consumption + capture roll) ──
  // Runs the rollQuarantine formula from QuantumStorage.ts and either:
  //   \u2022 success \u2192 ENEMIES[id] becomes a CapturedMinion in the player's party.
  //                 The battle ends as a half-victory (no XP/gold, but a new ally).
  //   \u2022 failure \u2192 spike is still consumed and the enemy gets a free turn,
  //                 mirroring Pokémon-style risk/reward.
  const playerQuarantine = (spikeId: string) => {
    if (busy) return;
    const spike = ITEMS[spikeId];
    if (!spike || spike.type !== 'spike') return;
    const inv = state.player.inventory.find((i) => i.id === spikeId);
    if (!inv || inv.qty <= 0) {
      pushLog('No spikes left!');
      sfx.cancel();
      return;
    }
    if (isBoss) {
      pushLog('Boss firewalls reject the spike!');
      sfx.cancel();
      return;
    }
    setBusy(true);
    sfx.skill();
    removeItem(spikeId, 1);
    const mult = SPIKE_MULTIPLIER[spikeId] ?? 1.0;
    const { success, chance } = rollQuarantine({
      currentHp: enemyHp,
      maxHp: enemyData.hp,
      multiplier: mult,
      isBoss,
    });
    pushLog(`${spike.name}! (${Math.round(chance * 100)}% chance)`);
    setPanel('main');
    if (success) {
      // Build the CapturedMinion from current battle stats, route into storage.
      const minion = buildCapturedMinion({
        speciesId: enemyData.id,
        currentHp: Math.max(1, enemyHp),
        enemyMaxHp: enemyData.hp,
        enemyAtk: enemyData.atk,
        enemyDef: enemyData.def,
        enemySpd: enemyData.spd,
        playerLevel: player.level,
      });
      setTimeout(() => {
        if (minion) {
          const { slot } = addCapturedMinion(minion);
          sfx.victory();
          pushLog(`★ Quarantined ${enemyData.name}!`);
          pushLog(slot === 'party' ? 'Added to active party.' : 'Sent to Extended Storage.');
        }
        // End battle as capture-victory (no XP/gold per design — capture IS the reward).
        setEnemyHp(0);
        setTurn('end');
        saveToServer();
        setTimeout(() => {
          if (params.mode === 'arena') {
            router.replace({ pathname: '/arena', params: { wave: params.arenaWave || '1', result: 'win' } });
          } else {
            router.back();
          }
        }, 700);
      }, 350);
    } else {
      sfx.cancel();
      pushLog('It broke free!');
      setTimeout(() => endPlayerTurn(), 320);
    }
  };

  // ── Quantum Taming: DEPLOY MINION ──
  // Sets the active minion and routes UI into the minion-skill submenu.
  // Does NOT end the player's turn \u2014 the player still has to pick a skill.
  const playerDeployMinion = (minion: CapturedMinion) => {
    if (busy) return;
    if (deployedMinion) {
      pushLog('A minion is already deployed!');
      sfx.cancel();
      return;
    }
    setDeployedMinion(minion);
    pushLog(`Deployed ${minion.name}! Choose a skill.`);
    sfx.confirm();
    setPanel('minionSkills');
  };

  // ── Quantum Taming: EXECUTE MINION SKILL ──
  // Translates blueprint's TamedCombatInterceptor.ExecuteMinionAction into
  // a single-turn action that runs through the existing damage pipeline.
  const playerMinionSkill = (skillId: string) => {
    if (busy || !deployedMinion) return;
    setBusy(true);
    const result = executeMinionSkill({
      minion: deployedMinion,
      skillId,
      enemy: { def: Math.max(0, enemyData.def - (enemyDefDebuff > 0 ? Math.floor(enemyData.def * 0.3) : 0)) },
    });
    // Audio
    if (result.sfxTag === 'bigHit') sfx.bigHit();
    else if (result.sfxTag === 'skill') sfx.skill();
    else sfx.hit();
    // Damage application — uses the SAME pipeline as the existing playerAttack:
    // mutate enemy HP via setEnemyHp + floater + shake. No engine changes.
    setEnemyHp((hp) => Math.max(0, hp - result.damage));
    showFloater(`-${result.damage}`, COLORS.neonMagenta, 'e');
    shakeAnim(enemyShake);
    pushLog(result.log);
    // Status modulation — wired into existing state slots:
    if (result.status === 'defense_down') {
      setEnemyDefDebuff(result.statusTurns);
      pushLog(`${enemyData.name}'s DEF dropped!`);
    } else if (result.status === 'stun') {
      setEnemyStun((s) => Math.max(s, result.statusTurns));
      pushLog(`${enemyData.name} is stunned!`);
    } else if (result.status === 'burn') {
      setEnemyBurn(result.statusTurns);
    } else if (result.status === 'firewall_up') {
      setFirewallTurns(result.statusTurns);
      pushLog('Firewall raised! DEF +50% for 2 turns.');
    }
    // The minion STAYS DEPLOYED across turns (matches the viewport-swap
    // mockup behaviour). Player presses ✕ RECALL on the skills panel to
    // bring the trainer back out, or the minion is auto-recalled on KO /
    // battle end.
    //
    // We INTENTIONALLY do NOT setPanel('main') here — keeping the cyborg
    // panel up means the next move is one tap away once the enemy turn ends.
    // The grid cells are visually disabled during `busy` so the player gets
    // clear feedback (see cyborgMoveCell render).
    setTimeout(() => endPlayerTurn(), 280);
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
    }, 60);
  };

  const enemyTurn = () => {
    // Quantum Taming: DDOS Overload may have stunned the enemy. Skip their turn.
    if (enemyStun > 0) {
      pushLog(`${enemyData.name} is stunned and skips a turn!`);
      setEnemyStun((s) => Math.max(0, s - 1));
      setTimeout(() => {
        setBusy(false);
        setTurn('player');
      }, 320);
      return;
    }
    setTurn('enemy');
    setBusy(true);
    setTimeout(() => {
      const abId = enemyAbilities[Math.floor(Math.random() * enemyAbilities.length)];
      const ab = ABILITIES[abId];
      let dmg = 0;
      if (ab && ab.type === 'attack') {
        dmg = computeDamage(ab.power, ab.element, enemyAtk, player.def + (firewallTurns > 0 ? Math.floor(player.def * 0.5) : 0));
        if (shield) { dmg = Math.floor(dmg * 0.5); setShield(false); pushLog('Shield absorbs!'); }
        applyDamage(dmg);
        sfx.damage();
        showFloater(`-${dmg}`, COLORS.neonRed, 'p');
        shakeAnim(playerShake);
        pushLog(`${enemyData.name} ${ab.name}! ${dmg} dmg.`);
      } else {
        dmg = computeDamage(1.0, 'physical', enemyAtk, player.def + (firewallTurns > 0 ? Math.floor(player.def * 0.5) : 0));
        if (shield) { dmg = Math.floor(dmg * 0.5); setShield(false); }
        applyDamage(dmg);
        sfx.damage();
        showFloater(`-${dmg}`, COLORS.neonRed, 'p');
        shakeAnim(playerShake);
        pushLog(`${enemyData.name} attacks for ${dmg}!`);
      }
      // Tick quantum-taming status durations once per enemy turn.
      if (enemyDefDebuff > 0) setEnemyDefDebuff((d) => d - 1);
      if (firewallTurns > 0) setFirewallTurns((f) => f - 1);
      setTimeout(() => {
        // Check player death
        if (state && state.player.hp - dmg <= 0) {
          onDefeat();
          return;
        }
        setBusy(false);
        setTurn('player');
      }, 200);
    }, 220);
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
    }, 500);
  };

  const onDefeat = async () => {
    setTurn('end');
    sfx.defeat();
    pushLog('You collapsed...');
    setTimeout(() => router.replace('/gameover'), 400);
  };

  // ----- render -----
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background */}
      <View style={styles.bgGrid} />

      {/* (1) COMBAT LOG — pinned at the very TOP, well clear of the character sprites.
          Semi-transparent black card per the new layout spec. */}
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

      {/* (2) BATTLE STAGE — Pokémon-Emerald diagonal positioning so the dialog/menu
          UI never overlaps the character sprites. Enemy floats TOP-LEFT, player
          ADHAMB floats BOTTOM-RIGHT. Stage uses absolute positioning inside a
          relative container. */}
      <View style={styles.stage}>
        {/* ── Cyborg battle background ────────────────────────────────────
            Layered effect: dark navy base → perspective horizon glow →
            faint scanline texture → cyan grid lines (vertical + horizontal).
            All overlays are pointerEvents="none" so combat hit-areas stay
            unaffected. Cheap to render: no images, no SVG — just <View>s. */}
        <View pointerEvents="none" style={styles.cyborgBgBase} />
        <View pointerEvents="none" style={styles.cyborgBgHorizon} />
        <View pointerEvents="none" style={styles.cyborgBgScan} />
        {/* Vertical grid lines */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={`vbg-${i}`}
            pointerEvents="none"
            style={[styles.cyborgGridV, { left: `${(i + 1) * (100 / 7)}%` }]}
          />
        ))}
        {/* Horizontal grid lines — denser near the "horizon" for depth. */}
        {[0.25, 0.4, 0.52, 0.62, 0.72, 0.82, 0.92].map((p, i) => (
          <View
            key={`hbg-${i}`}
            pointerEvents="none"
            style={[styles.cyborgGridH, { top: `${p * 100}%` }]}
          />
        ))}

        {/* Phase change flash */}
        {phaseFlash && <View style={styles.phaseFlash} pointerEvents="none" />}

        {/* ── Enemy: TOP-LEFT corner ───────────────────────────────────── */}
        <Animated.View style={[styles.enemyAnchor, { transform: [{ translateX: enemyShake }] }]}>
          {/* Compact nameplate card sitting flush left, above the sprite. */}
          <View style={styles.enemyNamePlate}>
            <PixelText size={12} color={isBoss ? COLORS.neonMagenta : COLORS.neonRed} bold glow={isBoss}>
              {isBoss ? '⚠ ' : ''}{enemyData.name.toUpperCase()}{phaseChanged ? ' [ENRAGED]' : ''}
            </PixelText>
            <PixelText size={8} color={COLORS.textDim}>
              TIER {enemyData.tier} · SPD {enemyData.spd}{isBoss ? ' · BOSS' : ''}
            </PixelText>
            <View style={{ marginTop: 4 }}>
              <StatBar value={enemyHp} max={enemyData.hp} color={isBoss ? COLORS.neonMagenta : COLORS.hp} bgColor={COLORS.hpBg} width={170} height={8} showText={false} />
            </View>
          </View>

          {/* Enemy sprite — anchored to the same top-left zone, below the plate. */}
          <View style={[styles.enemySpriteWrap, { zIndex: 10, alignItems: 'flex-start' }]}>
            <View style={[
              styles.groundShadow,
              { width: isBoss ? 120 : 100, alignSelf: 'flex-start', marginLeft: 18 },
            ]} pointerEvents="none" />
            <Animated.View
              style={{
                transform: [{ translateY: Math.sin(animTick * 0.35) * 3 }],
                zIndex: 10,
              }}
            >
              <View style={[
                styles.enemySpriteBox,
                isBoss && styles.enemySpriteBoxBoss,
                { width: isBoss ? 170 : 150, height: isBoss ? 170 : 150 },
              ]}>
                <Image
                  source={{ uri: getEnemySpriteUri(bossFromRoute, enemyData) }}
                  style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>
            {/* Floaters anchored above the enemy sprite */}
            <View style={styles.floaterEAnchor} pointerEvents="none">
              {floaters.filter(f => f.side === 'e').map(f => (
                <Floater key={f.id} text={f.text} color={f.color} size={24} />
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── BATTLE VIEWPORT SLOT (bottom-right) ──────────────────────────
            By design this slot is a "viewport" — it shows the PLAYER by
            default, but when a minion is deployed the slot is hijacked to
            render the active minion's sprite, mirroring the C# blueprint's
            `ActiveBattleViewport.SwitchViewportToMinion` behaviour. The
            player's HP bar moves to a smaller pill in the deploy header so
            the player is never invisible — just "off-field". */}
        <Animated.View style={[styles.playerAnchor, { transform: [{ translateX: playerShake }], zIndex: 10 }]}>
          <View style={styles.playerSprite}>
            <View style={styles.playerGroundShadow} pointerEvents="none" />
            <Animated.View
              style={{
                // When a minion is deployed we slightly enlarge the slot so
                // the captured creature reads as the new active fighter.
                width: deployedMinion ? 150 : 130,
                height: deployedMinion ? 180 : 175,
                transform: [{ translateY: Math.sin(animTick * 0.35 + Math.PI) * 2.5 }],
                zIndex: 10,
              }}
            >
              {/* Dynamic source: minion sprite if deployed, otherwise the player.
                  `resolveDeployedMinionUri` falls back through Quantum sheet →
                  enemy atlas → null so any captured species swaps the slot. */}
              <Image
                source={{
                  uri: (deployedMinion && resolveDeployedMinionUri(deployedMinion.speciesId)) ||
                       SPRITE_ASSETS.player,
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'transparent',
                }}
                resizeMode="contain"
              />
            </Animated.View>
            {shield && <View style={[styles.playerShielded, { width: 140, height: 185 }]} pointerEvents="none" />}
          </View>
          {/* Floaters anchored above the slot (player OR minion). */}
          <View style={styles.floaterPAnchor} pointerEvents="none">
            {floaters.filter(f => f.side === 'p').map(f => (
              <Floater key={f.id} text={f.text} color={f.color} size={20} />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* (3) BOTTOM PANEL — three modes:
              1. Default → player stats card
              2. Minion deployed (any non-skill panel) → "OMNI-REGISTRY / DEPLOYED MINION" header
              3. Minion deployed + skills panel → full CyborgBattleMovePanel takeover (the
                 player/deploy header is hidden so the move grid + diagnostics fill the bottom)
              + (4) ACTION MENU directly underneath (suppressed in mode 3). */}
      <View style={styles.bottomHud}>
        {panel === 'minionSkills' && deployedMinion ? null : deployedMinion ? (
          // ── DEPLOYED-MINION HEADER (matches uploaded UI mockup) ──────────
          // Left col  → OMNI-REGISTRY + species line label (e.g. "Phreak").
          // Right col → DEPLOYED MINION + minion name (yellow accent).
          //             Mini HP/MP bars retained for the off-field player so
          //             they can still gauge their resources at a glance.
          <View style={[styles.playerInfoPanel, { borderColor: COLORS.neonYellow }]}>
            <View style={styles.deployHeaderRow}>
              <View style={{ flex: 1 }}>
                <PixelText size={11} color={COLORS.neonCyan} bold>OMNI-REGISTRY</PixelText>
                <PixelText size={11} color={COLORS.neonCyan}>
                  {(deployedMinion.speciesId.split('_')[0] || 'minion').toUpperCase()}
                </PixelText>
                <View style={{ height: 4 }} />
                {/* Off-field player resources (smaller bars) */}
                <PixelText size={8} color={COLORS.textDim}>
                  TRAINER {player.name.toUpperCase()} (RESERVE)
                </PixelText>
                <StatBar value={player.hp} max={player.maxHp} color={COLORS.hp} bgColor={COLORS.hpBg} width={120} height={6} />
                <View style={{ height: 2 }} />
                <StatBar value={player.mp} max={player.maxMp} color={COLORS.mp} bgColor={COLORS.mpBg} width={120} height={6} />
              </View>
              <View style={{ flex: 1, paddingLeft: 8, borderLeftWidth: 2, borderColor: COLORS.border }}>
                <PixelText size={11} color={COLORS.neonYellow} bold>DEPLOYED</PixelText>
                <PixelText size={11} color={COLORS.neonYellow} bold>MINION:</PixelText>
                <View style={{ height: 4 }} />
                <PixelText size={11} color={COLORS.neonMagenta} bold>{deployedMinion.name.toUpperCase()}</PixelText>
                <PixelText size={9} color={COLORS.textDim}>
                  Lv{deployedMinion.level} · ATK {deployedMinion.atk} · DEF {deployedMinion.def}
                </PixelText>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.playerInfoPanel}>
            <View style={styles.statRow}>
              <View style={{ flex: 1 }}>
                <PixelText size={11} color={COLORS.neonGreen} bold>{player.name.toUpperCase()} · LV {player.level}</PixelText>
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
          </View>
        )}

        {turn === 'player' && !busy && panel === 'main' && (
          <View style={styles.actionGrid}>
            <View style={styles.actionCell}>
              <PixelButton title="ATTACK" onPress={playerAttack} color={COLORS.neonRed} testID="combat-attack" full />
            </View>
            <View style={styles.actionCell}>
              <PixelButton title="SKILL" onPress={() => setPanel('skills')} color={COLORS.neonCyan} testID="combat-skill" full />
            </View>
            <View style={styles.actionCell}>
              <PixelButton title="ITEM" onPress={() => setPanel('items')} color={COLORS.neonGreen} testID="combat-item" full />
            </View>
            {/* ── Quantum Taming buttons ────────────────────────────────── */}
            <View style={styles.actionCell}>
              <PixelButton
                title="TAME"
                onPress={() => setPanel('spikes')}
                color={COLORS.neonMagenta}
                testID="combat-tame"
                full
              />
            </View>
            <View style={styles.actionCell}>
              <PixelButton
                title={deployedMinion ? 'MINION' : 'CALL'}
                onPress={() => setPanel(deployedMinion ? 'minionSkills' : 'minionDeploy')}
                color={COLORS.neonYellow}
                testID="combat-call"
                full
              />
            </View>
            <View style={styles.actionCell}>
              <PixelButton title="RUN" onPress={playerRun} color={COLORS.textDim} testID="combat-run" full />
            </View>
          </View>
        )}

        {/* ── QUARANTINE spike picker ─────────────────────────────────── */}
        {panel === 'spikes' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
            {player.inventory.filter(i => ITEMS[i.id]?.type === 'spike').map((inv) => {
              const it = ITEMS[inv.id];
              const mult = SPIKE_MULTIPLIER[inv.id] ?? 1.0;
              const preview = Math.round(Math.max(0.02, Math.min(0.98, 0.5 * mult * (1 - enemyHp / Math.max(1, enemyData.hp)))) * 100);
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.skillBtn, { borderColor: COLORS.neonMagenta }]}
                  onPress={() => playerQuarantine(inv.id)}
                  testID={`combat-spike-${inv.id}`}
                >
                  <PixelText size={11} color={COLORS.neonMagenta} bold>{it.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>x{inv.qty} · ~{preview}%</PixelText>
                  <PixelText size={9} color={COLORS.text} style={{ marginTop: 3 }}>{it.desc}</PixelText>
                </TouchableOpacity>
              );
            })}
            {player.inventory.filter(i => ITEMS[i.id]?.type === 'spike').length === 0 && (
              <PixelText size={11} color={COLORS.textDim}>No containment spikes. Buy from Jax.</PixelText>
            )}
            <PixelButton title="✕" onPress={() => setPanel('main')} color={COLORS.textDim} size="sm" />
          </ScrollView>
        )}

        {/* ── DEPLOY MINION picker ────────────────────────────────────── */}
        {panel === 'minionDeploy' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
            {(state.quantum?.party ?? []).map((m) => {
              // Dynamic sprite thumb so the player sees the exact captured variant.
              const thumb = hasMinionSprite(m.speciesId) ? resolveMinionSpriteUri(m.speciesId) : null;
              return (
                <TouchableOpacity
                  key={m.uid}
                  style={[styles.skillBtn, { borderColor: COLORS.neonYellow, alignItems: 'center' }]}
                  onPress={() => playerDeployMinion(m)}
                  testID={`combat-deploy-${m.uid}`}
                >
                  {thumb ? (
                    <Image
                      source={{ uri: thumb }}
                      style={{ width: 44, height: 44, marginBottom: 2 }}
                      resizeMode="contain"
                    />
                  ) : null}
                  <PixelText size={11} color={COLORS.neonYellow} bold>{m.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={COLORS.textDim}>Lv{m.level} · T{m.tier}</PixelText>
                  <PixelText size={9} color={COLORS.text} style={{ marginTop: 3 }}>ATK {m.atk} · {m.skills.length} skills</PixelText>
                </TouchableOpacity>
              );
            })}
            {(state.quantum?.party ?? []).length === 0 && (
              <PixelText size={11} color={COLORS.textDim}>No minions in party. Quarantine some!</PixelText>
            )}
            <PixelButton title="✕" onPress={() => setPanel('main')} color={COLORS.textDim} size="sm" />
          </ScrollView>
        )}

        {/* ── MINION SKILL picker — full bottom-takeover (CyborgBattleMovePanel) ──
            Faithful port of the spec: LEFT half = 2×2 numbered move grid with
            cyan glow, RIGHT half = stacked OMNI-REGISTRY + system diagnostics
            telemetry. Replaces the standard action grid entirely while a
            minion is acting, mirroring classic Pokémon move-select state. */}
        {panel === 'minionSkills' && deployedMinion && (() => {
          // Order of slots always follows the canonical 4-move tier ladder so
          // slot index → keyboard "1.MALWARE 2.DDOS 3.TROJAN 4.SYSTEM" matches
          // the mockup regardless of which subset this minion actually knows.
          const allSlots: string[] = ['data_leak', 'ddos_overload', 'firewall_spike', 'packet_storm'];
          const known = new Set(deployedMinion.skills);
          // Live diagnostics derived from runtime state:
          const integrityPct = Math.round((player.hp / Math.max(1, player.maxHp)) * 100);
          const coreTemp =
            firewallTurns > 0 ? 'FROZEN' :
            integrityPct < 30 ? 'CRITICAL' :
            integrityPct < 60 ? 'ELEVATED' : 'OPTIMAL';
          const linkStatus = busy ? 'BUFFERING' : 'ACTIVE';
          return (
            <View style={styles.cyborgPanel}>
              {/* LEFT — 2 rows of 2 cells (explicit grid avoids the flex/aspectRatio
                  overlap bug that caused move labels to stack on top of each other). */}
              <View style={styles.cyborgMoveGrid}>
                {[0, 1].map((rowIdx) => (
                  <View key={rowIdx} style={styles.cyborgMoveRow}>
                    {[0, 1].map((colIdx) => {
                      const idx = rowIdx * 2 + colIdx;
                      const sId = allSlots[idx];
                      const sk = getMinionSkillView(sId);
                      const locked = !known.has(sId) || !sk;
                      // Disable taps while an action is animating so the player
                      // can clearly see they should wait — the cell stays in
                      // place between turns so the next move is one tap away
                      // the instant the enemy turn ends.
                      const waitingForTurn = busy || turn !== 'player';
                      const interactable = !locked && !waitingForTurn;
                      return (
                        <TouchableOpacity
                          key={sId}
                          disabled={!interactable}
                          onPress={() => sk && playerMinionSkill(sk.id)}
                          style={[
                            styles.cyborgMoveCell,
                            colIdx === 0 && styles.cyborgMoveCellRightBorder,
                            rowIdx === 0 && styles.cyborgMoveCellBottomBorder,
                            (locked || waitingForTurn) && styles.cyborgMoveCellLocked,
                          ]}
                          testID={`combat-minion-skill-${sId}`}
                        >
                          <PixelText size={9} color={interactable ? COLORS.neonGreen : COLORS.textDim} bold>
                            {idx + 1}.
                          </PixelText>
                          <PixelText
                            size={9}
                            color={interactable ? COLORS.neonGreen : COLORS.textDim}
                            bold
                            style={{ textAlign: 'center', marginTop: 1 }}
                          >
                            {sk ? sk.name.toUpperCase() : '— LOCKED —'}
                          </PixelText>
                          {!locked && sk && (
                            <PixelText size={7} color={COLORS.textDim} style={{ marginTop: 2 }}>
                              ×{sk.power}
                            </PixelText>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* RIGHT — stacked telemetry */}
              <View style={styles.cyborgRightCol}>
                {/* Top frame: OMNI-REGISTRY (smaller header to fit the narrow column) */}
                <View style={styles.cyborgRegistryFrame}>
                  <PixelText size={8} color={COLORS.neonGreen} bold>OMNI-REGISTRY</PixelText>
                  <PixelText size={9} color={COLORS.text}>Synthetica</PixelText>
                  <View style={{ height: 3 }} />
                  <PixelText size={7} color={COLORS.text} bold>DEPLOYED MINION:</PixelText>
                  <PixelText size={8} color={COLORS.text} numberOfLines={1}>
                    [{deployedMinion.name.toUpperCase()}]
                  </PixelText>
                </View>
                {/* Bottom frame: system diagnostics terminal */}
                <View style={styles.cyborgDiagFrame}>
                  <PixelText size={7} color={COLORS.neonGreen} numberOfLines={1}>
                    CORE: {coreTemp}
                  </PixelText>
                  <PixelText size={7} color={COLORS.neonGreen} numberOfLines={1}>
                    INTEGRITY: {integrityPct}%
                  </PixelText>
                  <PixelText size={7} color={COLORS.neonGreen} numberOfLines={1}>
                    LINK: {linkStatus}
                  </PixelText>
                  {enemyDefDebuff > 0 && (
                    <PixelText size={7} color={COLORS.neonMagenta} numberOfLines={1}>
                      INTRUSION ({enemyDefDebuff}T)
                    </PixelText>
                  )}
                  {enemyStun > 0 && (
                    <PixelText size={7} color={COLORS.neonMagenta} numberOfLines={1}>
                      LOCKDOWN ({enemyStun}T)
                    </PixelText>
                  )}
                </View>
                {/* RECALL button — always visible at the bottom of the panel */}
                <TouchableOpacity
                  style={styles.cyborgRecallBtn}
                  onPress={() => { setDeployedMinion(null); setPanel('main'); sfx.cancel(); }}
                >
                  <PixelText size={8} color={COLORS.neonRed} bold>✕ RECALL</PixelText>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

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
  // Stage now acts as a positioned container so the enemy/player can pin to opposite corners.
  stage: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    position: 'relative',
    overflow: 'hidden',  // clip cyborg-bg children to the stage bounds
  },
  // Enemy block — pinned TOP-LEFT (Pokemon-Emerald style).
  enemyAnchor: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 220,
    alignItems: 'flex-start',
    zIndex: 5,
  },
  enemyNamePlate: {
    backgroundColor: 'rgba(8, 14, 24, 0.85)',
    borderWidth: 2,
    borderColor: COLORS.borderHi,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    minWidth: 200,
  },
  // Player block — pinned BOTTOM-RIGHT, sitting just above the bottom HUD.
  playerAnchor: {
    position: 'absolute',
    right: 8,
    bottom: 0,
    alignItems: 'flex-end',
    zIndex: 6,
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
  // ── Deploy-mode bottom panel: two-column header per the
  //     ActiveBattleViewport mockup ("OMNI-REGISTRY" | "DEPLOYED MINION:").
  deployHeaderRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  // ─── Cyborg battle background (multi-layer effect) ─────────────────
  // Sits behind every combat element via absolute positioning. Pure-View
  // implementation (no images, no SVG) → zero asset cost, scales perfectly.
  cyborgBgBase: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: '#03060f',  // deep cyber navy
  },
  // Bright horizon ring fades into the dark — fakes a vanishing-point glow.
  cyborgBgHorizon: {
    position: 'absolute',
    left: 0, right: 0,
    top: '38%',
    height: 90,
    backgroundColor: COLORS.neonCyan,
    opacity: 0.06,
  },
  // Subtle scanline tint band — gives the CRT look without per-pixel cost.
  cyborgBgScan: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0, 255, 255, 0.02)',
    opacity: 0.7,
  },
  // Cyan grid verticals — 6 lines evenly spread.
  cyborgGridV: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0, 200, 255, 0.18)',
  },
  // Cyan grid horizontals — denser near the "horizon" for perspective.
  cyborgGridH: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 200, 255, 0.16)',
  },
  // ─── Cyborg Battle Move Panel (full takeover when picking minion skills) ───
  // Left half: 2×2 numbered move grid via explicit rows (each row = 50% height,
  // each cell = 50% width). Avoids the flex-wrap+aspectRatio overlap bug.
  // Right half: stacked OMNI-REGISTRY card + diagnostic terminal frame.
  cyborgPanel: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    minHeight: 180,
  },
  cyborgMoveGrid: {
    flex: 1.15,
    flexDirection: 'column',
    backgroundColor: '#001a2a',
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    // Cyan glow ring per mockup
    shadowColor: COLORS.neonCyan,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  cyborgMoveRow: {
    flex: 1,
    flexDirection: 'row',
  },
  cyborgMoveCell: {
    flex: 1,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    // Inner divider lines (only on first col / first row cells) give the
    // segmented HUD look without overlapping siblings.
  },
  cyborgMoveCellRightBorder: {
    borderRightWidth: 1.5,
    borderRightColor: COLORS.neonCyan,
  },
  cyborgMoveCellBottomBorder: {
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.neonCyan,
  },
  cyborgMoveCellLocked: {
    opacity: 0.4,
  },
  cyborgRightCol: {
    flex: 1,
    gap: 6,
    minHeight: 180,
  },
  cyborgRegistryFrame: {
    backgroundColor: '#0a1a0a',
    borderWidth: 2,
    borderColor: COLORS.neonGreen,
    padding: 6,
    minHeight: 56,
    shadowColor: COLORS.neonGreen,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  cyborgDiagFrame: {
    flex: 1,
    backgroundColor: '#0a1a0a',
    borderWidth: 2,
    borderColor: COLORS.neonGreen,
    padding: 6,
    shadowColor: COLORS.neonGreen,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  cyborgRecallBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.neonRed,
    paddingVertical: 5,
    alignItems: 'center',
    backgroundColor: '#1a0a0a',
    shadowColor: COLORS.neonRed,
    shadowOpacity: 0.6,
    shadowRadius: 4,
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
    width: 160,
    height: 210,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  playerGroundShadow: {
    position: 'absolute',
    bottom: 4,
    width: 110,
    height: 13,
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

  // (1) Combat-log card pinned at the very TOP of the screen — semi-transparent
  //     black bg, rounded, full width, well clear of the character sprites.
  logBox: {
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 38,
    zIndex: 1,
  },
  // (3) Player-info panel: green-outlined stats card per the new layout spec.
  playerInfoPanel: {
    width: '100%',
    marginBottom: 10,
    padding: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 6,
    backgroundColor: 'rgba(10, 18, 12, 0.55)',
    zIndex: 2,
  },
  bottomHud: {
    backgroundColor: COLORS.panel,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statusIcons: { gap: 2, alignItems: 'flex-end' },
  // (4) Action menu — 3×2 grid (6 buttons: ATTACK/SKILL/ITEM // TAME/CALL/RUN).
  //     RN-Web has no `display: grid`, so we fake it with flex-wrap + 32%-width cells.
  actionGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    zIndex: 2,
  },
  actionCell: {
    width: '32.5%',
  },
  skillsRow: { gap: 8, paddingVertical: 6 },
  skillBtn: {
    backgroundColor: 'rgba(10,10,20,0.9)',
    borderWidth: 2, padding: 10,
    minWidth: 130, maxWidth: 150,
  },
});
