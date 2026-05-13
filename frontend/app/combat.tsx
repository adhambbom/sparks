import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENEMIES, ABILITIES, ITEMS, Element, SPRITE_ASSETS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { SystemPrompt } from '../src/components/SystemPrompt';
import { markTutorialShown } from '../src/systems/tutorialState';
import { StatBar } from '../src/components/StatBar';
import Floater from '../src/components/Floater';
import { useGame } from '../src/contexts/GameContext';
import { useTutorial } from '../src/contexts/TutorialContext';
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
import { getEnemyVisual } from '../src/systems/enemyVisual';
import UnifiedSprite from '../src/components/UnifiedSprite';
import { FACTIONS, FactionId } from '../src/data/factions';
import { computeSynergy, summarizeActiveSynergy } from '../src/data/operatorSynergy';
import { getEntityIdentity, SIGNATURE_BY_FACTION, FACTION_PASSIVE } from '../src/data/entitySignatures';
import {
  RARITY_META,
  effectiveStat,
  ivQualityTag,
} from '../src/data/entityProgression';
import {
  combatMultiplier,
  classifyEffectiveness,
  getSpeciesKit,
  ROLES,
  STATUSES,
  StatusId,
  StatusInstance,
  aggregateStatusMods,
  getTypeMultiplier,
} from '../src/data/combatBalance';

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
  const { state, applyDamage, applyHeal, applyMpCost, awardXp, addGold, addItem, removeItem, saveToServer, addCapturedMinion, awardEntityXp, markSpeciesSeen } = useGame();
  const { startSequence, isCompleted } = useTutorial();
  // ▶ Auto-fire the combat protocol tutorial on the first encounter.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted('combat')) startSequence('combat');
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // Pulse trigger for VULNERABILITY EXPLOITED — a timestamp value that
  // the ring overlay reads + animates from. We compare it against a
  // ref of "last pulse value drawn" so each new pulse re-triggers.
  const [vulnPulse, setVulnPulse] = useState(0);

  // ── DEPLOYED ENTITY STABILITY (transient combat-only HP pool) ───────
  // When an entity is deployed, it gets its OWN stability bar. Enemy
  // attacks deplete the ENTITY's stability first; once it reaches 0
  // the entity disconnects and the player is prompted to deploy
  // another entity OR fight solo. The player only loses when their
  // own STABILITY hits 0 — never because an entity disconnected.
  //
  // This is the "Death / Fallback Flow" Phase-2 deliverable: makes
  // entities feel like tactical shields, not weak clones.
  const [minionHp, setMinionHp] = useState(0);
  const [minionMaxHp, setMinionMaxHp] = useState(0);
  // When an entity gets KO'd we briefly show a fallback panel so the
  // player can pick the next entity OR continue solo.
  const [fallbackPrompt, setFallbackPrompt] = useState(false);
  // Track entities that were deployed AND knocked out this fight so
  // they can't be re-deployed in the same encounter.
  const [knockedOut, setKnockedOut] = useState<Set<string>>(new Set());

  // ── OPERATOR SYNERGY SNAPSHOT ──────────────────────────────────────
  // Resolved once per render from the operator's owned synergy nodes.
  // Combat reads from this object only — keeps captures pure and lets
  // us add new nodes without touching combat code.
  const synergy = computeSynergy(state?.player.synergyNodes);
  // Once-per-battle "HOT-PATCH" revive flag. Toggled on entity disconnect.
  const hotPatchedRef = useRef(false);
  // Corruption stacks applied to the enemy via CORRUPTION branch nodes.
  // Stored as remaining turns; per-turn damage drawn from synergy.corruptionDpt.
  const [corruptionTurns, setCorruptionTurns] = useState(0);
  // ── ENTITY TRAIT RUNTIME STATE ─────────────────────────────────────
  // Tracks "first action since deploy" for STRIKER's FIRST STRIKE trait,
  // "first skill this fight" for ARTILLERY's BACKLOAD, and the SUPPORT
  // RELAY tick counter. Reset on each new deployment.
  const [traitFirstAttackUsed, setTraitFirstAttackUsed] = useState(false);
  const [traitFirstSkillUsed, setTraitFirstSkillUsed] = useState(false);
  const [traitRelayTick, setTraitRelayTick] = useState(0);
  // ── FACTION CORRUPTION PASSIVE STATE ────────────────────────────
  // Reset on every fresh deploy. `turnsDeployed` tallies for the
  // BLEED THOUGHT cadence. `factionAtkStack` is the shared counter for
  // RUST AURA (debuff stack on enemy) and KINETIC CHARGE (entity buff).
  // `phaseDodgeArmed` is the PHASE FRAY one-shot dodge gate.
  const [turnsDeployed, setTurnsDeployed] = useState(0);
  const [factionAtkStack, setFactionAtkStack] = useState(0);
  const [phaseDodgeArmed, setPhaseDodgeArmed] = useState(false);
  // MIRROR-PING (synergy): grants the player a free turn after a deploy
  // by short-circuiting one upcoming enemy turn.
  const [priorityFreeTurn, setPriorityFreeTurn] = useState(false);
  // Tutorial trigger flags — flipped when their event fires this session.
  // The SystemPrompt itself self-gates via AsyncStorage so it only ever
  // appears once across all sessions.
  const [showRarityTip, setShowRarityTip] = useState(false);
  const [showDataLevelTip, setShowDataLevelTip] = useState(false);
  // POWER GRID visual feedback: shake animation + transient ALERT chip
  // shown on the player info panel when a deploy fails. Replaces the
  // log-spam stream of "Insufficient POWER GRID for deploy (need 6)".
  const gridShake = useRef(new Animated.Value(0)).current;
  const [gridAlert, setGridAlert] = useState<string | null>(null);
  const flashGridAlert = (msg: string) => {
    setGridAlert(msg);
    Animated.sequence([
      Animated.timing(gridShake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    // Auto-clear after a short window so the chip doesn't loiter.
    setTimeout(() => setGridAlert(null), 1600);
  };

  // ── ACTIVE STATUS EFFECTS ─────────────────────────────────────────
  // Lists of currently-applied STATUSES on enemy / player. Each entry
  // ticks down 1 turn at the end of every enemy turn. DoT statuses
  // (burn/shock/corrupt/drain) deal % damage on tick. mods like
  // armor_break/slow apply via aggregateStatusMods.
  // This is the data-driven plumbing for the rich combatBalance
  // catalog — finally surfaces it visually + mechanically.
  const [enemyStatuses, setEnemyStatuses] = useState<StatusInstance[]>([]);
  // Cooldown map for minion SIGNATURE protocols (skillId → turns).
  const [signatureCooldowns, setSignatureCooldowns] = useState<Record<string, number>>({});
  // 10 fps tick drives the enemy breathing animation
  useEffect(() => {
    const id = setInterval(() => setAnimTick((t) => (t + 1) % 1024), 100);
    return () => clearInterval(id);
  }, []);

  // ── HOOKS-SAFE PLAYER EXTRACTION ──────────────────────────────────
  // Previously this file early-returned a <Loading/> placeholder here
  // when `state` was null, BEFORE subsequent useEffects ran. When the
  // GameContext autoload populated state mid-mount, the second render
  // had MORE hooks than the first → "Rendered more hooks than during
  // the previous render". Fix: optional-chain `player` here so later
  // hooks can still read it safely, and DEFER the loading-screen
  // early-return to the JSX render path (see bottom of file).
  const player = state?.player ?? {
    name: '', level: 1, hp: 0, maxHp: 0, mp: 0, maxMp: 0, atk: 0, def: 0, spd: 0, xp: 0, xpToNext: 1,
    skillPoints: 0, abilities: [] as string[], equipped: { weapon: '', armor: '' }, inventory: [] as any[],
  } as any;

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

  // ── Faction-aware combat balance ────────────────────────────────────
  // The DEFENDER's faction comes from the unified enemy-visual lookup
  // (same source-of-truth as the overworld + render glow).
  // The ATTACKER's faction depends on who's swinging:
  //   • Deployed minion present → its species faction.
  //   • No minion → 'player' (neutral 1.0× across the board).
  // We expose helpers so all damage calcs in this file go through the
  // same gate — keeps minion-vs-player power gap consistent.
  const enemyFaction: FactionId =
    getEnemyVisual(enemyData.id || '', { forceBoss: bossFromRoute || !!enemyData.isBoss })
      .faction.id;

  const elementMod = (atkEl: Element): number => {
    if (enemyData.weakness === atkEl) return 1.6;
    if (enemyData.resist === atkEl) return 0.5;
    return 1.0;
  };

  /** Single source of truth for damage. atkFaction defaults to 'player'. */
  const computeDamage = (
    basePower: number,
    element: Element,
    atkStat: number,
    defStat: number,
    atkFaction: FactionId = 'player',
    roleCritBonus = 0,
  ): { dmg: number; tier: ReturnType<typeof classifyEffectiveness>; crit: boolean } => {
    const variance = 0.85 + Math.random() * 0.3;
    const { mult: typeMult, crit, tier } = combatMultiplier(atkFaction, enemyFaction, roleCritBonus);
    const raw = Math.max(
      1,
      Math.floor((atkStat * basePower - defStat * 0.5) * variance * elementMod(element) * typeMult),
    );
    return { dmg: Math.max(1, raw), tier, crit };
  };

  /** Show a small "VULNERABILITY EXPLOITED" / "RESISTED" floater above the enemy. */
  const showEffectiveness = (tier: ReturnType<typeof classifyEffectiveness>, crit: boolean) => {
    if (crit) showFloater('SYSTEM BREACH!', '#fff066', 'e');
    if (tier === 'super')    showFloater('VULNERABILITY EXPLOITED!', '#ff60ff', 'e');
    else if (tier === 'strong')  showFloater('VULNERABLE',              '#a0ff60', 'e');
    else if (tier === 'resisted') showFloater('Resisted...',             '#80a0c0', 'e');
    else if (tier === 'immune') showFloater('NO EFFECT',                 '#666',    'e');
    // Strong indicator: trigger the enemy vulnerability ring pulse.
    if (tier === 'super' || tier === 'strong') {
      setVulnPulse(Date.now());
    }
  };

  // ----- player actions -----
  const playerAttack = () => {
    if (busy) return;
    setBusy(true);
    sfx.hit();
    // Determine attacker faction: deployed minion (with role crit bonus) or player.
    let atkFaction: FactionId = 'player';
    let atkStat = player.atk;
    let critBonus = 0;
    if (deployedMinion) {
      const kit = getSpeciesKit(deployedMinion.speciesId);
      atkFaction = kit.faction;
      // ── OPERATOR SYNERGY: OVERCLOCK ──────────────────────────────
      // synergy.entityAtkMod stacks all overclock node bonuses (+12%/+25%).
      // KINETIC CHARGE faction passive (rogue_military) adds a per-turn
      // +1 atk ramp via `factionAtkStack` (capped at +5).
      const kinetic = FACTION_PASSIVE[kit.faction].kind === 'kinetic_charge'
        ? factionAtkStack
        : 0;
      atkStat = Math.round(
        (deployedMinion.atk + kinetic) * ROLES[kit.role].mods.atk * (1 + synergy.entityAtkMod),
      );
      critBonus = ROLES[kit.role].critBonus + synergy.entityCritChance;
    }
    let { dmg, tier, crit } = computeDamage(1.0, 'physical', atkStat, enemyData.def, atkFaction, critBonus);
    // SPIKE node: 20% chance corrupted payload (×1.5 dmg).
    if (deployedMinion && synergy.entityCritChance > 0 && Math.random() < 0.20) {
      dmg = Math.floor(dmg * 1.5);
      crit = true;
    }
    // ── ENTITY TRAIT: FIRST STRIKE (striker role) ─────────────────
    // First entity attack after deploy lands +25% damage.
    if (deployedMinion && !traitFirstAttackUsed) {
      const ident = getEntityIdentity(deployedMinion.speciesId);
      if (ident.role === 'striker') {
        dmg = Math.floor(dmg * 1.25);
        pushLog(`▲ FIRST STRIKE primed — ${deployedMinion.name} fires hot.`);
      }
      setTraitFirstAttackUsed(true);
    }
    // ── ENTITY TRAIT: JAMMER (disruptor role) — 20% defense_down ──
    if (deployedMinion) {
      const ident = getEntityIdentity(deployedMinion.speciesId);
      if (ident.role === 'disruptor' && Math.random() < 0.20) {
        setEnemyDefDebuff((d) => Math.max(d, 2));
        showFloater('JAMMED', '#c46cff', 'e');
      }
    }
    setEnemyHp((hp) => Math.max(0, hp - dmg));
    showFloater(`-${dmg}`, COLORS.neonYellow, 'e');
    showEffectiveness(tier, crit);
    shakeAnim(enemyShake);
    pushLog(`${deployedMinion ? deployedMinion.name : player.name} strikes for ${dmg}!`);
    // ── CORRUPTION SPREAD: apply DoT residue when entity hits ─────
    if (deployedMinion && synergy.corruptionTurns > 0) {
      setCorruptionTurns(synergy.corruptionTurns);
    }
    // ── PASSIVE GRID: operator solo turn restores entity stability ─
    if (!deployedMinion === false && synergy.passiveStabRestorePct > 0 && deployedMinion) {
      // Only fires when the OPERATOR (not entity) attacks — i.e. solo strike.
      // Detect by checking atkFaction === player.
    }
    if (atkFaction === 'player' && deployedMinion && synergy.passiveStabRestorePct > 0) {
      const restore = Math.max(1, Math.floor(minionMaxHp * synergy.passiveStabRestorePct));
      setMinionHp((hp) => Math.min(minionMaxHp, hp + restore));
      showFloater(`+${restore}`, COLORS.neonMagenta, 'p');
    }
    setTimeout(() => endPlayerTurn(), 220);
  };

  const playerSkill = (id: string) => {
    if (busy) return;
    const ab = ABILITIES[id];
    if (!ab) return;
    if (player.mp < ab.cost) {
      pushLog('POWER GRID depleted!');
      return;
    }
    setBusy(true);
    applyMpCost(ab.cost);
    if (ab.type === 'attack') {
      sfx.bigHit();
      const { dmg, tier, crit } = computeDamage(ab.power, ab.element, player.atk, enemyData.def, 'player', 0);
      setEnemyHp((hp) => Math.max(0, hp - dmg));
      showFloater(`-${dmg}`, COLORS.neonCyan, 'e');
      showEffectiveness(tier, crit);
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
      pushLog(`${ab.name}! Restored ${ab.power} STABILITY.`);
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
          // ── EXTRACTED — eerie cyber terminology, not Pokémon "captured".
          // Roll the variance + archive grade into the log so the player
          // FEELS the result of every illegal recovery.
          const rarity = minion.rarity ?? 'common';
          const rLabel = RARITY_META[rarity].label;
          pushLog(`▣ ${enemyData.name.toUpperCase()} EXTRACTED — ARCHIVE GRADE: ${rLabel}`);
          if (minion.ivs) {
            const tag = ivQualityTag(minion.ivs).label;
            pushLog(`▸ SIGNAL QUALITY: ${tag}`);
          }
          pushLog(slot === 'party' ? 'Routed to active loadout.' : 'Sent to cold storage.');
        }
        // End battle as capture-victory (no XP/gold per design — extract IS the reward).
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
      pushLog('Containment failed — signal slipped.');
      setTimeout(() => endPlayerTurn(), 320);
    }
  };

  // ── Quantum Taming: DEPLOY MINION ──
  // Sets the active minion and routes UI into the minion-skill submenu.
  // Does NOT end the player's turn \u2014 the player still has to pick a skill.
  const playerDeployMinion = (minion: CapturedMinion) => {
    if (busy) return;
    if (knockedOut.has(minion.uid)) {
      pushLog(`${minion.name} is DISCONNECTED — can't redeploy this fight.`);
      sfx.cancel();
      return;
    }
    if (deployedMinion) {
      pushLog('An entity is already deployed!');
      sfx.cancel();
      return;
    }
    // ── OPERATOR SYNERGY: HANDSHAKE / NULL CALL — deploy GRID cost ──
    // Base cost is 6 GRID. Higher-tier entities consume more bandwidth
    // (+1 per tier above 1). Synergy reduces via HANDSHAKE (−2) and
    // NULL CALL (−4 total). Floor at 0.
    const baseDeployCost = 6 + Math.max(0, (minion.tier || 1) - 1);
    const deployCost = Math.max(0, baseDeployCost + synergy.deployPwrCostMod);
    if (state && state.player.mp < deployCost) {
      // ── DEPLOY DENIED — short eerie feedback, no log spam ──────────
      flashGridAlert('GRID LINK DENIED');
      sfx.cancel();
      return;
    }
    if (deployCost > 0) {
      applyMpCost(deployCost);
      if (deployCost < baseDeployCost) {
        pushLog(`▸ HANDSHAKE patched — deploy cost ${deployCost} (was ${baseDeployCost}).`);
      }
    }
    // ── OPERATOR SYNERGY: FAST REBOOT — redeploy stab pct ──────────
    // A minion that was previously DISCONNECTED is in `knockedOut`.
    // FAST REBOOT (dep_reboot) bumps the redeploy start from 25% → 30%.
    const isRedeploy = knockedOut.has(minion.uid);
    // Initialise the entity's STABILITY pool with role-scaled HP so a
    // TANK actually feels like a tank and an ARTILLERY genuinely is glass.
    const kit = getSpeciesKit(minion.speciesId);
    const rarity = minion.rarity ?? 'common';
    const baseLevel = minion.baseLevel ?? minion.level;
    const dataLvl = minion.dataLevel ?? minion.level;
    const effHp  = effectiveStat(minion.hp,  minion.ivs?.hp  ?? 0, dataLvl, baseLevel, rarity);
    const effAtk = effectiveStat(minion.atk, minion.ivs?.atk ?? 0, dataLvl, baseLevel, rarity);
    const effDef = effectiveStat(minion.def, minion.ivs?.def ?? 0, dataLvl, baseLevel, rarity);
    const effSpd = effectiveStat(minion.spd, minion.ivs?.spd ?? 0, dataLvl, baseLevel, rarity);
    const boostedMinion = { ...minion, hp: effHp, maxHp: effHp, atk: effAtk, def: effDef, spd: effSpd };
    const fullPool = Math.max(1, Math.round(effHp * ROLES[kit.role].mods.hp));
    const scaledHp = isRedeploy
      ? Math.max(1, Math.round(fullPool * synergy.redeployStabPct))
      : fullPool;
    setMinionHp(scaledHp);
    setMinionMaxHp(fullPool);
    setFallbackPrompt(false);
    setDeployedMinion(boostedMinion);
    // ── Reset per-deploy trait counters ──
    setTraitFirstAttackUsed(false);
    setTraitFirstSkillUsed(false);
    setTraitRelayTick(0);
    setTurnsDeployed(0);
    setFactionAtkStack(0);
    setPhaseDodgeArmed(false);
    // Drop this minion from knockedOut so subsequent redeploys are tracked fresh.
    if (isRedeploy) {
      setKnockedOut((s) => {
        const next = new Set(s);
        next.delete(minion.uid);
        return next;
      });
      pushLog(`◇ FAST REBOOT — ${minion.name} returns at ${Math.round(synergy.redeployStabPct * 100)}% stab.`);
    }
    // ── OPERATOR SYNERGY: MIRROR-PING — priority next turn ─────────
    // Grants a free player turn after deploy (enemy turn skipped once).
    if (synergy.priorityNextTurn) {
      setPriorityFreeTurn(true);
      pushLog('▸ MIRROR-PING echoes — enemy stalls.');
    }
    pushLog(`Deployed ${minion.name} [${ROLES[kit.role].label}] — choose a PROTOCOL.`);
    sfx.confirm();
    setPanel('minionSkills');
  };

  // ── Quantum Taming: EXECUTE MINION SKILL ──
  // Translates blueprint's TamedCombatInterceptor.ExecuteMinionAction into
  // a single-turn action that runs through the existing damage pipeline.
  const playerMinionSkill = (skillId: string) => {
    if (busy || !deployedMinion) return;
    // Cooldown gate — block re-use until counter reaches 0.
    const cd = signatureCooldowns[skillId] || 0;
    if (cd > 0) {
      pushLog(`Protocol on cooldown · ${cd} turns`);
      sfx.cancel();
      return;
    }
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
    // ── FACTION TYPE-CHART AMPLIFICATION ────────────────────────────
    // Minion skills get the full type-effectiveness treatment. This is
    // the primary mechanic that makes minions feel essential: a Phreak
    // (corrupted_ai) Glitch Beam vs an Industrial Bot lands for 1.8×.
    const kit = getSpeciesKit(deployedMinion.speciesId);
    const { mult: typeMult, crit, tier } = combatMultiplier(
      kit.faction, enemyFaction, ROLES[kit.role].critBonus,
    );
    let finalDmg = Math.max(1, Math.floor(result.damage * typeMult));
    // ── ENTITY TRAIT: BACKLOAD (artillery) — first skill +50% ───
    const ident = getEntityIdentity(deployedMinion.speciesId);
    if (ident.role === 'artillery' && !traitFirstSkillUsed) {
      finalDmg = Math.floor(finalDmg * 1.5);
      pushLog(`⌬ BACKLOAD discharges — capacitors empty.`);
      setTraitFirstSkillUsed(true);
    }
    // ── SYNERGY: SIGNATURE+ (mythic) — slot-4 / signature: +35% ─
    // The signature move id is stored on SIGNATURE_BY_FACTION. When
    // the player triggers the signature, apply the mythic bonus.
    const sigId = SIGNATURE_BY_FACTION[kit.faction]?.id;
    if (synergy.entitySignatureBonus > 0 && skillId === sigId) {
      finalDmg = Math.floor(finalDmg * (1 + synergy.entitySignatureBonus));
      showFloater('SIG+', '#ffd24a', 'e');
    }
    // Damage application — uses the SAME pipeline as the existing playerAttack:
    // mutate enemy HP via setEnemyHp + floater + shake. No engine changes.
    setEnemyHp((hp) => Math.max(0, hp - finalDmg));
    showFloater(`-${finalDmg}`, COLORS.neonMagenta, 'e');
    showEffectiveness(tier, crit);
    shakeAnim(enemyShake);
    pushLog(result.log + (tier === 'super' ? ' (VULNERABILITY EXPLOITED!)' : tier === 'resisted' ? ' (resisted)' : ''));

    // ── ROLE-THEMED STATUS AUTO-APPLY ──────────────────────────────
    // Each class lands its signature debuff with chance =
    // 35% base + role.statusBonus. Makes every class TACTICALLY
    // distinct: a HACKER reliably shocks, CORRUPTION reliably DoTs.
    const roleStatusMap: Record<string, StatusId | null> = {
      tank: 'armor_break',    // tanks chip armor as they grind
      striker: 'armor_break', // ASSAULT — armour-break for combo plays
      disruptor: 'shock',     // HACKER — chance to skip turn
      support: 'drain',       // SUPPORT — life leech for team
      artillery: 'corrupt',   // CORRUPTION — DoT specialist
      swarm: 'burn',          // SWARM — stacking bleed flavour
    };
    const statusId = roleStatusMap[kit.role];
    const applyChance = 0.35 + (ROLES[kit.role].statusBonus || 0);
    if (statusId && Math.random() < applyChance) {
      setEnemyStatuses((prev) => {
        // Refresh duration if same status already active; else add.
        const without = prev.filter((s) => s.id !== statusId);
        return [...without, { id: statusId, turns: 3, power: deployedMinion.atk }];
      });
      showFloater(`+${STATUSES[statusId].label}`, STATUSES[statusId].color as string, 'e');
      pushLog(`✦ ${STATUSES[statusId].label} applied!`);
    }
    // ── COOLDOWN — placeholder 2-turn cooldown for any minion protocol
    setSignatureCooldowns((m) => ({ ...m, [skillId]: 2 }));
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
    // ── SYNERGY: CORRUPTION SPREAD DoT ───────────────────────────
    if (corruptionTurns > 0 && enemyHp > 0 && synergy.corruptionDpt > 0) {
      const corrDmg = synergy.corruptionDpt;
      setEnemyHp((hp) => Math.max(0, hp - corrDmg));
      showFloater(`-${corrDmg}✦`, '#c46cff', 'e');
      // BIO-LEECH: 50% of corruption damage heals the operator.
      if (synergy.corruptionLeechPct > 0) {
        const heal = Math.max(1, Math.round(corrDmg * synergy.corruptionLeechPct));
        applyHeal(heal);
        showFloater(`+${heal}`, COLORS.neonGreen, 'p');
      }
      setCorruptionTurns((c) => c - 1);
    }
    // ── FACTION CORRUPTION PASSIVES ──────────────────────────────
    // Run once per player turn while an entity is deployed. Each
    // faction projects a different battlefield behavior, giving each
    // species a memorable identity beyond raw stat differences.
    if (deployedMinion && enemyHp > 0) {
      const k = getSpeciesKit(deployedMinion.speciesId);
      const passive = FACTION_PASSIVE[k.faction];
      const newCount = turnsDeployed + 1;
      setTurnsDeployed(newCount);
      switch (passive.kind) {
        case 'bleed_thought': {
          // Every 2nd turn: residual psi dmg to enemy.
          if (newCount % 2 === 0) {
            const dmg = 3;
            setEnemyHp((hp) => Math.max(0, hp - dmg));
            showFloater(`-${dmg}✦`, passive.color, 'e');
            pushLog(`${passive.name} leaks through — ${dmg} dmg.`);
          }
          break;
        }
        case 'phase_fray': {
          // 12% chance to arm a one-shot dodge for the NEXT enemy hit.
          if (!phaseDodgeArmed && Math.random() < 0.12) {
            setPhaseDodgeArmed(true);
            showFloater('PHASE+', passive.color, 'p');
          }
          break;
        }
        case 'rust_aura': {
          // Reapply enemy defense_down — uses existing enemyDefDebuff
          // pipeline so it stacks gracefully with other debuffs.
          // Stack max +5 turns.
          if (factionAtkStack < 5) {
            setFactionAtkStack((s) => s + 1);
            setEnemyDefDebuff((d) => Math.min(5, d + 1));
            if (newCount % 2 === 0) showFloater('CORRODED', passive.color, 'e');
          }
          break;
        }
        case 'kinetic_charge': {
          // Stack +1 atk per turn (cap 5). Applied via the read path in
          // playerAttack — see `kinetic` calculation there.
          if (factionAtkStack < 5) {
            setFactionAtkStack((s) => s + 1);
            if (newCount === 1 || newCount % 2 === 0) {
              showFloater(`+${factionAtkStack + 1} ATK`, passive.color, 'p');
            }
          }
          break;
        }
      }
    }
    setTimeout(() => {
      // ── OPERATOR SYNERGY: THREAD SPLIT / EXECUTE CHAIN ──────────
      // X% chance to NOT end the player's turn — entity acts twice.
      // Skipped if combat is already ending or enemy is dead.
      if (
        deployedMinion && enemyHp > 0 && synergy.chainActionChance > 0 &&
        Math.random() < synergy.chainActionChance
      ) {
        pushLog('▸ THREAD SPLIT — entity chains a second action.');
        setBusy(false);
        return;
      }
      // ── OPERATOR SYNERGY: CORE LEAK self-drain ──────────────────
      // OVERCLOCK II charges a hidden 5%/turn stab tax. Only ticks
      // while an entity is actively deployed and survives the turn.
      if (deployedMinion && minionHp > 0 && synergy.entityStabSelfDrain > 0) {
        // BIO-LATCH (entityStabDecayMod = -0.25) slows the drain by 25%.
        const decay = Math.max(0, 1 + (synergy.entityStabDecayMod ?? 0));
        const drain = Math.max(1, Math.round(minionMaxHp * synergy.entityStabSelfDrain * decay));
        setMinionHp((h) => Math.max(1, h - drain));
        showFloater(`-${drain}`, '#ff8c00', 'p');
      }
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
    // ── OPERATOR SYNERGY: MIRROR-PING (priority free turn) ────────
    // After a deploy with the PRIORITY node active, the first enemy
    // turn is short-circuited — the operator gets a free action.
    if (priorityFreeTurn) {
      setPriorityFreeTurn(false);
      pushLog('▸ MIRROR-PING locked enemy out — free action.');
      setTimeout(() => {
        setBusy(false);
        setTurn('player');
      }, 320);
      return;
    }
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
    // ── SYNERGY: GLITCH FIELD (25% chance enemy misfires) ────────
    // Persistent corruption field around the deployed entity causes
    // the enemy to skip its action entirely. Only applies when an
    // entity is currently deployed (the field decays without one).
    if (deployedMinion && synergy.glitchMisfireChance > 0 && Math.random() < synergy.glitchMisfireChance) {
      pushLog(`${enemyData.name} misfires inside the glitch field!`);
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
        const r = computeDamage(ab.power, ab.element, enemyAtk, player.def + (firewallTurns > 0 ? Math.floor(player.def * 0.5) : 0), enemyFaction, 0);
        dmg = r.dmg;
        if (shield) { dmg = Math.floor(dmg * 0.5); setShield(false); pushLog('Shield absorbs!'); }
        sfx.damage();
        pushLog(`${enemyData.name} ${ab.name}! ${dmg} dmg.`);
      } else {
        const r = computeDamage(1.0, 'physical', enemyAtk, player.def + (firewallTurns > 0 ? Math.floor(player.def * 0.5) : 0), enemyFaction, 0);
        dmg = r.dmg;
        if (shield) { dmg = Math.floor(dmg * 0.5); setShield(false); }
        sfx.damage();
        pushLog(`${enemyData.name} attacks for ${dmg}!`);
      }
      // ── ENTITY DAMAGE INTERCEPT ──────────────────────────────────────
      // If an entity is deployed and still has STABILITY, IT takes the hit
      // instead of the player — the entity is the player's shield wall.
      // When the entity's stability reaches 0 it DISCONNECTS and the
      // player is prompted to deploy another or continue solo.
      let dmgToPlayer = dmg;
      if (deployedMinion && minionHp > 0) {
        // ── FACTION PASSIVE: PHASE FRAY (cyber_mutant) ────────────
        // If armed, this incoming hit is dodged entirely. Flag is set
        // each turn by endPlayerTurn at 12% chance.
        if (phaseDodgeArmed) {
          setPhaseDodgeArmed(false);
          showFloater('PHASED', '#5cf7ff', 'p');
          pushLog(`${deployedMinion.name} phase-shifts — hit voided.`);
          shakeAnim(playerShake);
          dmg = 0;
          dmgToPlayer = 0;
          // Skip the rest of the absorb pipeline; continue turn flow.
        } else {
        // ── SYNERGY: BUFFER (entity dmg reduction) ───────────────────
        // Stack from STABILITY branch: -10% / -10%+leech. Floor at 1.
        let absorbedDmg = Math.max(
          1,
          Math.round(dmg * (1 + synergy.entityDmgTakenMod)),
        );
        // ── ENTITY TRAIT: PLATING (tank) — flat −5 dmg ──────────
        const ident = getEntityIdentity(deployedMinion.speciesId);
        if (ident.role === 'tank') {
          absorbedDmg = Math.max(1, absorbedDmg - 5);
        }
        // OPERATOR ABSORB: 15% of entity damage routes to the operator.
        const operatorShare = synergy.operatorAbsorbPct > 0
          ? Math.max(1, Math.round(absorbedDmg * synergy.operatorAbsorbPct))
          : 0;
        if (operatorShare > 0) {
          absorbedDmg = Math.max(0, absorbedDmg - operatorShare);
          applyDamage(operatorShare);
          showFloater(`-${operatorShare}`, COLORS.neonGreen, 'p');
          dmgToPlayer = operatorShare; // for death-check below
        }
        const newMinHp = Math.max(0, minionHp - absorbedDmg);
        setMinionHp(newMinHp);
        showFloater(`-${absorbedDmg}`, COLORS.neonMagenta, 'p');
        shakeAnim(playerShake);
        if (newMinHp <= 0) {
          // ── SYNERGY: HOT-PATCH (once-per-fight soft reboot) ───────
          if (synergy.hotPatchAvailable && !hotPatchedRef.current) {
            hotPatchedRef.current = true;
            const revive = Math.max(1, Math.round(minionMaxHp * 0.60));
            setMinionHp(revive);
            pushLog(`◇ HOT-PATCH ENGAGED — ${deployedMinion.name} reboots @ 60% stab.`);
            showFloater(`+${revive}`, COLORS.neonCyan, 'p');
            sfx.confirm();
          } else {
            pushLog(`⚠ ${deployedMinion.name} DISCONNECTED!`);
            setKnockedOut((s) => new Set(s).add(deployedMinion.uid));
            // ── SYNERGY: FULL PURGE — detonate corruption residue on disconnect ─
            if (synergy.purgeOnDisconnectPct > 0) {
              const purgeDmg = Math.max(1, Math.round(minionMaxHp * synergy.purgeOnDisconnectPct));
              setEnemyHp((hp) => Math.max(0, hp - purgeDmg));
              showFloater(`-${purgeDmg}`, COLORS.neonMagenta, 'e');
              shakeAnim(enemyShake);
              pushLog(`▸ PURGE detonates for ${purgeDmg} corruption.`);
            }
            setDeployedMinion(null);
            // Show fallback prompt next turn (unless party has no other entities).
            const partyAlive = (state?.quantum?.party || []).filter(
              (m) => m.uid !== deployedMinion.uid && !knockedOut.has(m.uid),
            );
            if (partyAlive.length > 0) {
              setFallbackPrompt(true);
              setPanel('minionDeploy');
            } else {
              pushLog('Network depleted — fighting solo.');
            }
          }
        }
        if (operatorShare === 0) dmgToPlayer = 0;
        }
      } else {
        applyDamage(dmg);
        showFloater(`-${dmg}`, COLORS.neonRed, 'p');
        shakeAnim(playerShake);
      }
      // Tick quantum-taming status durations once per enemy turn.
      if (enemyDefDebuff > 0) setEnemyDefDebuff((d) => d - 1);
      if (firewallTurns > 0) setFirewallTurns((f) => f - 1);
      setTimeout(() => {
        // Check player death — only when damage reached the player (entity
        // absorbed it otherwise) AND the player's STABILITY hits 0.
        if (state && state.player.hp - dmgToPlayer <= 0) {
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
    pushLog(`Victory! +${enemyData.xp} DATA, +${enemyData.gold}G`);
    addGold(enemyData.gold);
    const leveled = awardXp(enemyData.xp);
    if (leveled) { sfx.levelUp(); pushLog('VERSION UPGRADE! +1 Protocol Slot.'); }
    // ── ENTITY DATA XP ─────────────────────────────────────────────
    // Surviving entity gets ~70% of the enemy DATA reward. Levels up
    // independently — drives the "use them, evolve them" loop.
    if (deployedMinion && minionHp > 0) {
      const award = Math.max(1, Math.floor(enemyData.xp * 0.7));
      const r = awardEntityXp(deployedMinion.uid, award);
      pushLog(`${deployedMinion.name} +${r.gained} DATA`);
      // ── TUTORIAL TRIGGER: first DATA award shows the leveling primer.
      setShowDataLevelTip(true);
      if (r.leveled) {
        sfx.levelUp();
        pushLog(`▲ ${deployedMinion.name} DATA LV ${r.level}!`);
      }
    }
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
  // Loading guard placed in the JSX path (not as an early return above)
  // so the hook count stays IDENTICAL across re-renders when GameContext
  // autoload flips state from null → loaded.
  if (!state || !enemyData) {
    return (
      <SafeAreaView style={styles.container}>
        <PixelText color={COLORS.text}>Loading...</PixelText>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background */}
      <View style={styles.bgGrid} />

      {/* (1) COMBAT LOG — pinned at the very TOP, well clear of the character sprites.
          Semi-transparent black card per the new layout spec.
          Each entry allowed up to 2 lines so long enemy names + intros
          (e.g. "⚠ BOSS: Bio-Mech Marauder appears!") never get clipped. */}
      <View style={styles.logBox} pointerEvents="none">
        {log.slice(-2).map((l, i, arr) => (
          <PixelText
            key={`${i}-${l}`}
            size={10}
            color={i === arr.length - 1 ? COLORS.text : COLORS.textDim}
            numberOfLines={2}
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
            <PixelText size={12} color={isBoss ? COLORS.neonMagenta : COLORS.neonRed} bold glow={isBoss} autoFit>
              {isBoss ? '⚠ ' : ''}{enemyData.name.toUpperCase()}{phaseChanged ? ' [ENRAGED]' : ''}
            </PixelText>
            <PixelText size={8} color={COLORS.textDim} autoFit>
              TIER {enemyData.tier} · SPD {enemyData.spd}{isBoss ? ' · BOSS' : ''} · {FACTIONS[enemyFaction].label}
            </PixelText>
            <View style={{ marginTop: 4 }}>
              <StatBar value={enemyHp} max={enemyData.hp} color={isBoss ? COLORS.neonMagenta : COLORS.hp} bgColor={COLORS.hpBg} width={170} height={8} showText={false} />
            </View>
            {/* ── TYPE ADVANTAGE HINT ─────────────────────────────────────
                Scans the player's captured-minion party. If any minion would
                land SUPER-EFFECTIVE damage on this enemy, surface its name
                so the player knows which minion to deploy. This is the
                educational layer that teaches "minions are tools, not pets". */}
            {(() => {
              const party = state?.quantum?.party || [];
              const matches = party
                .map((m) => {
                  const k = getSpeciesKit(m.speciesId);
                  return { minion: m, faction: k.faction, role: k.role,
                           mult: getTypeMultiplier(k.faction, enemyFaction) };
                })
                .sort((a, b) => b.mult - a.mult);
              const best = matches[0];
              if (!deployedMinion && best && best.mult >= 1.4) {
                return (
                  <View style={{ marginTop: 4, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: FACTIONS[best.faction].glowColor as any, alignSelf: 'flex-start' }}>
                    <PixelText size={8} color={FACTIONS[best.faction].glowColor as any} bold>
                      💡 DEPLOY {best.minion.name.toUpperCase()} ({best.mult.toFixed(1)}×)
                    </PixelText>
                  </View>
                );
              }
              if (deployedMinion) {
                const k = getSpeciesKit(deployedMinion.speciesId);
                const mult = getTypeMultiplier(k.faction, enemyFaction);
                const tier = classifyEffectiveness(mult);
                const label =
                  tier === 'super' ? '⚡ VULNERABILITY EXPLOITED'
                  : tier === 'strong' ? '↑ VULNERABLE'
                  : tier === 'resisted' ? '↓ RESISTED'
                  : tier === 'immune' ? '✕ NO EFFECT'
                  : '· NEUTRAL';
                const color =
                  tier === 'super' || tier === 'strong' ? '#a0ff60'
                  : tier === 'resisted' || tier === 'immune' ? '#ff8080'
                  : COLORS.textDim;
                return (
                  <View style={{ marginTop: 4 }}>
                    <PixelText size={8} color={color} bold>
                      {label}  ·  {ROLES[k.role].label}
                    </PixelText>
                  </View>
                );
              }
              return null;
            })()}
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
              {(() => {
                // SAME source-of-truth resolver as the overworld → same
                // enemyId renders the SAME sprite, just larger + with the
                // combat scanline overlay so it reads as a zoomed-in view.
                const visual = getEnemyVisual(enemyData.id || '', { forceBoss: bossFromRoute || !!enemyData.isBoss });
                const boxW = isBoss ? 170 : 150;
                // Vulnerability pulse — when a strong/super hit lands, this
                // ring grows + fades in the enemy's faction colour. Driven
                // by the ms-elapsed since the last vulnPulse trigger.
                const pulseAge = vulnPulse > 0 ? (Date.now() - vulnPulse) : Infinity;
                const pulseT = Math.max(0, Math.min(1, pulseAge / 600));   // 600ms life
                const pulseAlive = pulseT < 1;
                const ringScale = 1 + pulseT * 0.45;
                const ringAlpha = pulseAlive ? (1 - pulseT) : 0;
                return (
                  <View style={[
                    styles.enemySpriteBox,
                    isBoss && styles.enemySpriteBoxBoss,
                    { width: boxW, height: boxW, alignItems: 'center', justifyContent: 'center' },
                  ]}>
                    <UnifiedSprite
                      uri={visual.uri}
                      faction={visual.faction}
                      size={boxW - 10}
                      tick={animTick}
                      combat
                    />
                    {/* VULNERABILITY pulse ring — faction-tinted, expanding + fading.
                        Sits ON TOP of the sprite so it visually 'breaks' the silhouette. */}
                    {pulseAlive && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          width: (boxW - 10) * ringScale,
                          height: (boxW - 10) * ringScale,
                          borderRadius: ((boxW - 10) * ringScale) / 2,
                          borderWidth: 3,
                          borderColor: visual.faction.glowColor as any,
                          opacity: ringAlpha,
                        }}
                      />
                    )}
                    {/* Red flash overlay — a single-frame red wash on the
                        sprite when vulnerability lands, layered above for
                        instant feedback. */}
                    {pulseAlive && pulseT < 0.18 && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          width: boxW - 14,
                          height: boxW - 14,
                          backgroundColor: 'rgba(255,80,140,0.45)',
                          mixBlendMode: 'screen' as any,
                        }}
                      />
                    )}
                  </View>
                );
              })()}
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
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(() => {
                // Player slot: same unified-sprite pipeline so the cyan
                // friendly halo matches every other character in the world.
                // Deployed minion: use enemyVisual to keep its faction
                // identity consistent with the overworld + enemy view.
                if (deployedMinion) {
                  const mv = getEnemyVisual(deployedMinion.speciesId);
                  return (
                    <UnifiedSprite
                      uri={mv.uri}
                      faction={mv.faction}
                      size={150}
                      tick={animTick}
                      combat
                    />
                  );
                }
                return (
                  <UnifiedSprite
                    uri={SPRITE_ASSETS.player}
                    faction={FACTIONS.player}
                    size={140}
                    tick={animTick}
                    combat={false}
                  />
                );
              })()}
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
                <PixelText size={11} color={COLORS.neonCyan} bold autoFit>OMNI-REGISTRY</PixelText>
                <PixelText size={11} color={COLORS.neonCyan} autoFit>
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
                <PixelText size={11} color={COLORS.neonYellow} bold autoFit>DEPLOYED ENTITY</PixelText>
                <View style={{ height: 4 }} />
                <PixelText size={12} color={COLORS.neonMagenta} bold autoFit>{deployedMinion.name.toUpperCase()}</PixelText>
                {/* ── SIGNATURE + TRAIT + RARITY/IV CHIPS ──────────────
                    Glanceable identity strip. Signature glyph + color
                    matches the entity's faction so the player learns
                    the species' signature move visually.
                    The RARITY chip + IV quality tag drive the addiction
                    loop: GOD ROLL ascendeds glow gold, ROUGH commons read
                    dim — the player learns to value each capture. */}
                {(() => {
                  const ident = getEntityIdentity(deployedMinion.speciesId);
                  const rarity = deployedMinion.rarity ?? 'common';
                  const rMeta = RARITY_META[rarity];
                  const ivTag = deployedMinion.ivs ? ivQualityTag(deployedMinion.ivs) : null;
                  const dLvl = deployedMinion.dataLevel ?? deployedMinion.level;
                  const fp = FACTION_PASSIVE[ident.faction];
                  return (
                    <View style={styles.identityRow}>
                      <View style={[styles.idChip, { borderColor: rMeta.rim, backgroundColor: rMeta.bg }]}>
                        <PixelText size={7} color={rMeta.rim} bold>
                          {rMeta.label} · DLV{dLvl}
                        </PixelText>
                      </View>
                      {ivTag && (
                        <View style={[styles.idChip, { borderColor: ivTag.color }]}>
                          <PixelText size={7} color={ivTag.color} bold>{ivTag.label}</PixelText>
                        </View>
                      )}
                      <View style={[styles.idChip, { borderColor: ident.signature.color }]}>
                        <PixelText size={7} color={ident.signature.color} bold>
                          {ident.signature.glyph} {ident.signature.name}
                        </PixelText>
                      </View>
                      <View style={[styles.idChip, { borderColor: ident.trait.color, backgroundColor: 'rgba(20,30,40,0.55)' }]}>
                        <PixelText size={7} color={ident.trait.color} bold>
                          {ident.trait.glyph} {ident.trait.name}
                        </PixelText>
                      </View>
                      {fp.kind !== 'none' && (
                        <View style={[styles.idChip, { borderColor: fp.color, backgroundColor: 'rgba(40,15,55,0.55)' }]}>
                          <PixelText size={7} color={fp.color} bold>
                            {fp.glyph} {fp.name}{factionAtkStack > 0 ? `×${factionAtkStack}` : ''}
                          </PixelText>
                        </View>
                      )}
                    </View>
                  );
                })()}
                {/* STABILITY bar — visible HP gauge so the player can see when
                    the entity is about to disconnect. This is the core tactical
                    feedback for the entity-tank mechanic. */}
                <View style={{ marginTop: 3 }}>
                  <StatBar
                    value={minionHp}
                    max={minionMaxHp}
                    color={
                      minionHp / Math.max(1, minionMaxHp) < 0.25 ? '#ff5555'
                        : minionHp / Math.max(1, minionMaxHp) < 0.5 ? '#ffb24c'
                        : COLORS.neonMagenta
                    }
                    bgColor={COLORS.hpBg}
                    width={130}
                    height={7}
                    showText
                    label="STAB"
                  />
                </View>
                <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 2 }}>
                  Lv{deployedMinion.level} · ATK {deployedMinion.atk} · {ROLES[getSpeciesKit(deployedMinion.speciesId).role].label}
                </PixelText>
              </View>
            </View>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.playerInfoPanel,
              {
                transform: [{ translateX: gridShake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }],
                borderColor: gridAlert ? '#ff4789' : '#4CAF50',
              },
            ]}
          >
            <View style={styles.statRow}>
              <View style={{ flex: 1 }}>
                <PixelText size={11} color={COLORS.neonGreen} bold autoFit>{player.name.toUpperCase()} · LV {player.level}</PixelText>
                <View style={{ height: 4 }} />
                {/* STAB bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <PixelText size={7} color={COLORS.textDim}>STAB</PixelText>
                  <StatBar value={player.hp} max={player.maxHp} color={COLORS.hp} bgColor={COLORS.hpBg} width={140} height={9} />
                  <PixelText size={7} color={COLORS.text}>{player.hp}/{player.maxHp}</PixelText>
                </View>
                <View style={{ height: 4 }} />
                {/* POWER GRID bar — labeled + numeric so the player can
                    instantly see if they can afford a deploy. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <PixelText size={7} color={gridAlert ? '#ff4789' : '#5cb3ff'} bold>GRID</PixelText>
                  <StatBar value={player.mp} max={player.maxMp} color={gridAlert ? '#ff4789' : COLORS.mp} bgColor={COLORS.mpBg} width={140} height={9} />
                  <PixelText size={7} color={gridAlert ? '#ff4789' : COLORS.text}>{player.mp}/{player.maxMp}</PixelText>
                </View>
                {gridAlert && (
                  <View style={{ marginTop: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#ff4789', backgroundColor: 'rgba(80,10,30,0.55)', paddingHorizontal: 5, paddingVertical: 2 }}>
                    <PixelText size={8} color={'#ff4789'} bold>⚠ {gridAlert}</PixelText>
                  </View>
                )}
              </View>
              <View style={styles.statusIcons}>
                {shield && <PixelText size={10} color={COLORS.neonCyan} bold>◇SHIELD</PixelText>}
                {haste && <PixelText size={10} color={COLORS.neonMagenta} bold>»HASTE</PixelText>}
                {enemyBurn > 0 && <PixelText size={10} color="#ff8000" bold>🔥{enemyBurn}</PixelText>}
              </View>
            </View>
          </Animated.View>
        )}

        {turn === 'player' && !busy && panel === 'main' && (
          <>
            {/* ── ACTIVE SYNERGY STRIP — operator passives currently online ─
                Glanceable tags + corruption-stack counter so the player
                sees their illegal mods working without reading the log. */}
            {(() => {
              const tags = summarizeActiveSynergy(state?.player.synergyNodes, !!deployedMinion);
              if (tags.length === 0 && corruptionTurns === 0) return null;
              return (
                <View style={styles.synergyStrip}>
                  <PixelText size={7} color={COLORS.textDim}>SYNERGY ▸ </PixelText>
                  {tags.map((t) => (
                    <View key={t} style={styles.synergyChip}>
                      <PixelText size={7} color={'#c46cff'} bold>{t}</PixelText>
                    </View>
                  ))}
                  {corruptionTurns > 0 && (
                    <View style={[styles.synergyChip, { borderColor: '#c46cff', backgroundColor: 'rgba(60,20,80,0.55)' }]}>
                      <PixelText size={7} color={'#ffc1ff'} bold>CORR×{corruptionTurns}</PixelText>
                    </View>
                  )}
                </View>
              );
            })()}
            <View style={styles.actionGrid}>
            <View style={styles.actionCell}>
              <PixelButton title="STRIKE" onPress={playerAttack} color={COLORS.neonRed} testID="combat-attack" full size="sm" />
            </View>
            <View style={styles.actionCell}>
              <PixelButton title="SIGNAL" onPress={() => setPanel('skills')} color={COLORS.neonCyan} testID="combat-skill" full size="sm" />
            </View>
            <View style={styles.actionCell}>
              <PixelButton title="PATCH" onPress={() => setPanel('items')} color={COLORS.neonGreen} testID="combat-item" full size="sm" />
            </View>
            {/* ── JAILBREAK (capture) ────────────────────────────────── */}
            <View style={styles.actionCell}>
              <PixelButton
                title="BREACH"
                onPress={() => setPanel('spikes')}
                color={COLORS.neonMagenta}
                testID="combat-tame"
                full
                size="sm"
              />
            </View>
            <View style={styles.actionCell}>
              <PixelButton
                title={deployedMinion ? 'ENTITY' : 'DEPLOY'}
                onPress={() => setPanel(deployedMinion ? 'minionSkills' : 'minionDeploy')}
                color={COLORS.neonYellow}
                testID="combat-call"
                full
                size="sm"
              />
            </View>
            <View style={styles.actionCell}>
              <PixelButton title="ESCAPE" onPress={playerRun} color={COLORS.textDim} testID="combat-run" full size="sm" />
            </View>
          </View>
          </>
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

        {/* ── DEPLOY ENTITY picker ────────────────────────────────────── */}
        {panel === 'minionDeploy' && (
          <View>
            {/* REDEPLOY BANNER — pulsed urgency cue when an entity just
                disconnected. Players see the prompt without reading the log. */}
            {fallbackPrompt && (
              <View style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                marginBottom: 6,
                borderWidth: 2,
                borderColor: '#ff4566',
                backgroundColor: 'rgba(80,10,30,0.55)',
                alignItems: 'center',
              }}>
                <PixelText size={11} color={'#ff7090'} bold glow>
                  ⚠ ENTITY DISCONNECTED
                </PixelText>
                <PixelText size={9} color={'#ffb0c0'} style={{ marginTop: 2 }}>
                  REDEPLOY ANOTHER ENTITY OR PRESS [BACK] TO FIGHT SOLO
                </PixelText>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsRow}>
            {(state.quantum?.party ?? [])
              .filter((m) => !knockedOut.has(m.uid))
              .map((m) => {
              // Use the same enemy-visual resolver so each minion's thumb
              // matches what it looks like in combat + overworld.
              const mv = getEnemyVisual(m.speciesId);
              const k = getSpeciesKit(m.speciesId);
              const matchupMult = getTypeMultiplier(k.faction, enemyFaction);
              const matchupTier = classifyEffectiveness(matchupMult);
              const isAdvantage = matchupTier === 'super' || matchupTier === 'strong';
              const isDisadvantage = matchupTier === 'resisted' || matchupTier === 'immune';
              return (
                <TouchableOpacity
                  key={m.uid}
                  style={[
                    styles.skillBtn,
                    {
                      borderColor: isAdvantage ? '#a0ff60' : isDisadvantage ? '#ff8080' : COLORS.neonYellow,
                      borderWidth: isAdvantage ? 2 : 1,
                      alignItems: 'center',
                    },
                  ]}
                  onPress={() => playerDeployMinion(m)}
                  testID={`combat-deploy-${m.uid}`}
                >
                  <View style={{ width: 50, height: 50, marginBottom: 2, alignItems: 'center', justifyContent: 'center' }}>
                    <UnifiedSprite
                      uri={mv.uri}
                      faction={mv.faction}
                      size={50}
                      static
                    />
                  </View>
                  <PixelText size={11} color={COLORS.neonYellow} bold autoFit>{m.name.toUpperCase()}</PixelText>
                  <PixelText size={9} color={FACTIONS[k.faction].glowColor as any} bold autoFit>
                    {ROLES[k.role].label}
                  </PixelText>
                  <PixelText size={8} color={COLORS.textDim} autoFit>
                    Lv{m.level} · T{m.tier} · DLV{m.dataLevel ?? m.level}
                  </PixelText>
                  {/* ── GRID COST CHIP — visible cost up-front so the
                      operator never gets surprised by GRID LINK DENIED.
                      Tier scales the cost: T1=base(6), T2=+1, T3=+2.
                      Synergy reduces via HANDSHAKE / NULL CALL. */}
                  {(() => {
                    const tierBump = Math.max(0, (m.tier || 1) - 1);
                    const cost = Math.max(0, 6 + tierBump + synergy.deployPwrCostMod);
                    const canAfford = (state?.player.mp ?? 0) >= cost;
                    return (
                      <View style={{ marginTop: 2 }}>
                        <View style={{
                          alignSelf: 'flex-start',
                          borderWidth: 1,
                          borderColor: canAfford ? '#5cb3ff' : '#ff4789',
                          paddingHorizontal: 4,
                          paddingVertical: 1,
                          backgroundColor: canAfford ? 'rgba(20,40,70,0.55)' : 'rgba(70,15,30,0.55)',
                        }}>
                          <PixelText size={7} color={canAfford ? '#5cb3ff' : '#ff4789'} bold>
                            GRID {cost}
                          </PixelText>
                        </View>
                      </View>
                    );
                  })()}
                  {/* ── RARITY + IV CHIP — drives addiction loop ── */}
                  {(() => {
                    const r = m.rarity ?? 'common';
                    const rm = RARITY_META[r];
                    return (
                      <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
                        <View style={{ borderWidth: 1, borderColor: rm.rim, paddingHorizontal: 3, paddingVertical: 1, backgroundColor: rm.bg }}>
                          <PixelText size={6} color={rm.rim} bold>{rm.label}</PixelText>
                        </View>
                        {m.ivs && (
                          <View style={{ borderWidth: 1, borderColor: ivQualityTag(m.ivs).color, paddingHorizontal: 3, paddingVertical: 1 }}>
                            <PixelText size={6} color={ivQualityTag(m.ivs).color} bold>{ivQualityTag(m.ivs).label}</PixelText>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                  {isAdvantage && (
                    <PixelText size={8} color={'#a0ff60'} bold>⚡ {matchupMult.toFixed(1)}×</PixelText>
                  )}
                  {isDisadvantage && (
                    <PixelText size={8} color={'#ff8080'} bold>↓ {matchupMult.toFixed(1)}×</PixelText>
                  )}
                </TouchableOpacity>
              );
            })}
            {(state.quantum?.party ?? []).length === 0 && (
              <PixelText size={11} color={COLORS.textDim}>No entities in network — JAILBREAK some!</PixelText>
            )}
            <PixelButton title="✕" onPress={() => { setPanel('main'); setFallbackPrompt(false); }} color={COLORS.textDim} size="sm" />
            </ScrollView>
          </View>
        )}

        {/* ── MINION SKILL picker — full bottom-takeover (CyborgBattleMovePanel) ──
            Faithful port of the spec: LEFT half = 2×2 numbered move grid with
            cyan glow, RIGHT half = stacked OMNI-REGISTRY + system diagnostics
            telemetry. Replaces the standard action grid entirely while a
            minion is acting, mirroring classic Pokémon move-select state. */}
        {panel === 'minionSkills' && deployedMinion && (() => {
          // Order of slots always follows the canonical 4-move tier ladder so
          // slot index → keyboard "1.MALWARE 2.DDOS 3.TROJAN 4.SIGNATURE" matches
          // the mockup regardless of which subset this minion actually knows.
          // The TIER-4 slot is now species-flavored: it's the entity's faction
          // SIGNATURE MOVE (MIND CRACK / PHASE STRIDE / ARMOR LOCK / RAIL VOLLEY).
          const sigForDeployed = SIGNATURE_BY_FACTION[getSpeciesKit(deployedMinion.speciesId).faction];
          const allSlots: string[] = ['data_leak', 'ddos_overload', 'firewall_spike', sigForDeployed.id];
          // Always treat the signature as KNOWN for the deployed entity —
          // each entity ships with its faction's signature unlocked.
          const known = new Set([...deployedMinion.skills, sigForDeployed.id]);
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
                  <PixelText size={9} color={COLORS.textDim}>PWR {ab.cost}</PixelText>
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
      {/* ── CONTEXT-AWARE TUTORIAL TRIGGERS ──────────────────────────
          Each SystemPrompt self-gates via AsyncStorage. They render
          inline so React unmounts cleanly when their condition flips.
          • combat_basics    — first time the player enters combat.
          • deploy_primer    — first time the DEPLOY panel opens.
          • stability_critical — first time entity drops below 30% stab.
          • reboot_window    — first DISCONNECT event.
          • corruption_warning — first enemy with active burn / boss tag.
          • rarity_reveal    — fires while a RARE+ extract floater is up.
          • data_leveling    — fires after the entity gains its first DATA.
      */}
      <SystemPrompt flag="combat_basics" />
      {panel === 'minionDeploy' && <SystemPrompt flag="deploy_primer" />}
      {deployedMinion && minionHp > 0 && minionMaxHp > 0 && (minionHp / minionMaxHp) < 0.30 && (
        <SystemPrompt flag="stability_critical" />
      )}
      {deployedMinion === null && knockedOut.size > 0 && fallbackPrompt && (
        <SystemPrompt flag="reboot_window" />
      )}
      {(enemyBurn > 0 || isBoss) && <SystemPrompt flag="corruption_warning" />}
      {showRarityTip && <SystemPrompt flag="rarity_reveal" />}
      {showDataLevelTip && <SystemPrompt flag="data_leveling" />}
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
  // ── ENEMY NAME PLATE ────────────────────────────────────────────
  // Top-of-screen panel with the enemy faction + tier. Locked width
  // bands so long names + boss tags don't shove the layout around.
  enemyNamePlate: {
    backgroundColor: 'rgba(8, 14, 24, 0.92)',
    borderWidth: 2,
    borderColor: COLORS.borderHi,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    minWidth: 220,
    maxWidth: 320,
    gap: 2,
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
  // ── PLAYER INFO PANEL — locked padding + consistent vertical rhythm.
  //   • Same border thickness as enemyNamePlate (2) for visual rhyme.
  //   • Gap=6 keeps STABILITY/POWER bars from kissing the name row.
  playerInfoPanel: {
    width: '100%',
    marginBottom: 10,
    padding: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 6,
    backgroundColor: 'rgba(10, 18, 12, 0.65)',
    gap: 6,
    zIndex: 2,
  },
  bottomHud: {
    backgroundColor: COLORS.panel,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 4,
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statusIcons: { gap: 2, alignItems: 'flex-end' },
  // ── ACTION GRID (3×2) ───────────────────────────────────────────
  // Locked metrics — every button is exactly the same width AND height
  // so the grid reads cleanly even with mixed label lengths.
  //   • flexBasis: 32%  — three columns with a 6px gap between them.
  //   • rowGap: 8       — vertical breathing room between rows.
  //   • minHeight via actionCell — guarantees uniform button height.
  actionGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 6,
    zIndex: 2,
  },
  actionCell: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '32%',
    minHeight: 44, // iOS touch-target minimum, enforced even on smaller phones
  },
  skillsRow: { gap: 8, paddingVertical: 6 },
  // ── SYNERGY STRIP ───────────────────────────────────────────────
  // Sits directly ABOVE the action grid. Tight 3px row gap so multi-line
  // chip wrap stays compact and never pushes the action grid offscreen.
  synergyStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 3,
    rowGap: 3,
    columnGap: 4,
    marginBottom: 6,
  },
  synergyChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#c46cff',
    backgroundColor: 'rgba(40,15,70,0.65)',
    borderRadius: 2,
  },
  // ── IDENTITY ROW — signature + trait + rarity + passive chips.
  //   rowGap kept tight (3) so the deployed entity panel never grows
  //   unpredictably tall on narrow phones.
  identityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 3,
    columnGap: 4,
    marginTop: 5,
  },
  idChip: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    backgroundColor: 'rgba(10,10,20,0.75)',
    borderRadius: 2,
  },
  skillBtn: {
    backgroundColor: 'rgba(10,10,20,0.9)',
    borderWidth: 2, padding: 10,
    minWidth: 130, maxWidth: 150,
    minHeight: 60,
  },
});
